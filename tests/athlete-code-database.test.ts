import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { HEADERS } from "@/lib/roster/csv";

// All identities, contact details and readings are fictional.
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111", player = "22222222-2222-4222-8222-222222222222";
const athlete = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
const mapping = (n = 1) => ({ athlete_id: athlete(n), old_code: `LOCAL-000${n}`, new_code: `PAC-000${n}` });
async function asUser<T>(user: string, run: () => Promise<T>) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  try { return await run(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
async function rename(rows: unknown = [mapping(1), mapping(2)], reviewed: boolean | null = true) {
  return (await db.query<{ result: { changed: number; unchanged: number } }>("select public.admin_rename_athlete_codes($1::jsonb,$2) result", [JSON.stringify(rows), reviewed])).rows[0].result;
}
function rosterRow(code = "LOCAL-0001", changes: Record<string, string> = {}) {
  return { ...Object.fromEntries(HEADERS.map(key => [key, ""])), athlete_code: code, first_name: "Fictional", last_name: "One", pacific_email: "fictional.one@example.com", jersey_number: "0", ...changes };
}
function reading(code = "LOCAL-0001", changes: Record<string, unknown> = {}) {
  const file_hash = "a".repeat(64), source_sheet = "Fictional", source_row = 2;
  return { observation_id: `observation:${JSON.stringify([file_hash, source_sheet, source_row, 0])}`, athlete_code: code, metric_key: "max_exit_velocity", measured_at: "2026-09-12", value: 0.30000000000000004, unit: "mph", source: "Fictional protocol", source_file: "fictional.csv", source_sheet, source_row, file_hash, ...changes };
}
async function importReading(rows = [reading()]) {
  return (await db.query<{ result: { created: number; unchanged: number } }>("select public.admin_import_performance($1::jsonb) result", [JSON.stringify(rows)])).rows[0].result;
}
async function stage(rows = [rosterRow()]) {
  const id = (await db.query<{ id: string }>("select public.stage_roster_import($1::jsonb,'2026-27','fictional.csv',$2) id", [JSON.stringify(rows), "b".repeat(64)])).rows[0].id;
  const preview = (await db.query<{ preview: { reject: number; create: number; update: number; unchanged: number; rows: { athlete_code: string }[] } }>("select preview from public.roster_imports where id=$1", [id])).rows[0].preview;
  return { id, preview };
}
async function codes() { return (await db.query<{ athlete_code: string }>("select athlete_code from public.athletes order by id")).rows.map(row => row.athlete_code); }

beforeAll(async () => {
  await db.exec("create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(file, directory), "utf8"));
  await db.query("insert into auth.users(id) values($1),($2)", [admin, player]);
  await db.query("insert into public.app_accounts(user_id,is_active) values($1,true),($2,true)", [admin, player]);
  await db.query("insert into public.account_roles(user_id,role) values($1,'admin'),($2,'player')", [admin, player]);
});
beforeEach(async () => {
  await db.exec("delete from public.audit_events; delete from public.roster_imports; delete from private.athlete_code_aliases; delete from public.performance_measurements; delete from public.performance_imports; delete from public.account_athletes; delete from public.athlete_seasons; delete from public.athletes; update public.app_accounts set is_active=true;");
  await db.query("insert into public.athletes(id,athlete_code,first_name,last_name,pacific_email) values($1,'LOCAL-0001','Fictional','One','fictional.one@example.com'),($2,'LOCAL-0002','Fictional','Two','fictional.two@example.com'),($3,'SYN-001','Fictional','Sample','fictional.sample@example.com')", [athlete(1), athlete(2), athlete(3)]);
  await db.query("insert into public.athlete_seasons(athlete_id,season,jersey_number) values($1,'2026-27',0),($2,'2026-27',null),($3,'2026',null)", [athlete(1), athlete(2), athlete(3)]);
  await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)", [player, athlete(1)]);
});
afterAll(async () => { await db.close(); });

describe("reviewed hosted PAC identity migration", () => {
  it("changes only the code and audit, preserving UUIDs, links, seasons and precise performance", async () => {
    await asUser(admin, () => importReading());
    const before = (await db.query<{ data: unknown }>("select jsonb_build_object('links',(select jsonb_agg(to_jsonb(x)) from public.account_athletes x),'seasons',(select jsonb_agg(to_jsonb(x) order by athlete_id) from public.athlete_seasons x),'readings',(select jsonb_agg(to_jsonb(x)) from public.performance_measurements x)) data")).rows[0].data;
    expect(await asUser(admin, () => rename())).toEqual({ changed: 2, unchanged: 0 });
    expect(await codes()).toEqual(["PAC-0001", "PAC-0002", "SYN-001"]);
    const after = (await db.query<{ data: unknown }>("select jsonb_build_object('links',(select jsonb_agg(to_jsonb(x)) from public.account_athletes x),'seasons',(select jsonb_agg(to_jsonb(x) order by athlete_id) from public.athlete_seasons x),'readings',(select jsonb_agg(to_jsonb(x)) from public.performance_measurements x)) data")).rows[0].data;
    expect(after).toEqual(before);
    expect(await asUser(admin, () => rename())).toEqual({ changed: 0, unchanged: 2 });
    expect((await db.query("select * from public.audit_events where event_type='athlete_code_changed'")).rows).toHaveLength(2);
    await asUser(player, async () => {
      expect((await db.query<{ athlete_code: string }>("select athlete_code from public.athletes")).rows).toEqual([{ athlete_code: "PAC-0001" }]);
      expect((await db.query("select * from public.performance_measurements")).rows).toHaveLength(1);
    });
  });
  it("denies anonymous, player, inactive administrator and unreviewed mapping changes", async () => {
    await db.exec("set role anon");
    try { await expect(rename()).rejects.toThrow("permission denied"); } finally { await db.exec("reset role"); }
    await asUser(player, async () => { await expect(rename()).rejects.toThrow("Active administrator"); });
    await asUser(admin, async () => { for (const reviewed of [false, null]) await expect(rename(undefined, reviewed)).rejects.toThrow("Review"); });
    await db.query("update public.app_accounts set is_active=false where user_id=$1", [admin]);
    await asUser(admin, async () => { await expect(rename()).rejects.toThrow("Active administrator"); });
    expect(await codes()).toEqual(["LOCAL-0001", "LOCAL-0002", "SYN-001"]);
  });
  it.each([
    [], {}, [mapping(), mapping()], [{ ...mapping(), new_code: "PAC-0002" }],
    [{ ...mapping(), athlete_id: athlete(2) }], [{ ...mapping(), athlete_id: "bad" }],
    [{ ...mapping(), old_code: "LOCAL-00001", new_code: "PAC-00001" }], [{ ...mapping(), extra: true }],
  ])("rejects malformed or stale mapping atomically %#", async invalid => {
    await asUser(admin, async () => { await expect(rename(invalid)).rejects.toThrow(); });
    expect(await codes()).toEqual(["LOCAL-0001", "LOCAL-0002", "SYN-001"]);
    expect((await db.query("select * from private.athlete_code_aliases")).rows).toEqual([]);
  });
  it("refuses a target collision before any mapping is applied", async () => {
    await db.query("update public.athletes set athlete_code='PAC-0002' where id=$1", [athlete(3)]);
    await asUser(admin, async () => { await expect(rename()).rejects.toThrow("conflicts"); });
    expect(await codes()).toEqual(["LOCAL-0001", "LOCAL-0002", "PAC-0002"]);
    expect((await db.query("select * from private.athlete_code_aliases")).rows).toEqual([]);
  });
  it("does not permit reuse or direct authenticated mutation of an old code", async () => {
    await asUser(admin, () => rename());
    await expect(db.query("insert into public.athletes(athlete_code,first_name,last_name) values('LOCAL-0001','Fictional','Collision')")).rejects.toThrow("cannot be assigned again");
    await asUser(admin, async () => {
      for (const sql of ["select * from private.athlete_code_aliases", "delete from private.athlete_code_aliases", "select private.canonical_athlete_code('LOCAL-0001')", "select private.plan_roster_original_codes('[]','2026-27')", "select private.import_performance_original_codes('[]')"]) await expect(db.query(sql)).rejects.toThrow("permission denied");
    });
  });
  it("rolls back aliases, codes and audit when audit storage rejects a later change", async () => {
    await db.exec("alter table public.audit_events add constraint fictional_audit_failure check (event_type<>'athlete_code_changed' or details->>'after'<>'PAC-0002')");
    try { await asUser(admin, async () => { await expect(rename()).rejects.toThrow("fictional_audit_failure"); }); }
    finally { await db.exec("alter table public.audit_events drop constraint fictional_audit_failure"); }
    expect(await codes()).toEqual(["LOCAL-0001", "LOCAL-0002", "SYN-001"]);
    expect((await db.query("select * from private.athlete_code_aliases")).rows).toEqual([]);
    expect((await db.query("select * from public.audit_events")).rows).toEqual([]);
  });
  it("resolves old roster aliases before preview, approval and duplicate detection", async () => {
    await asUser(admin, () => rename());
    await asUser(admin, async () => {
      const draft = await stage();
      expect(draft.preview).toMatchObject({ create: 0, reject: 0, unchanged: 1 });
      expect(draft.preview.rows[0].athlete_code).toBe("PAC-0001");
      await db.query("select public.approve_roster_import($1)", [draft.id]);
      expect((await stage([rosterRow(), rosterRow("PAC-0001")])).preview.reject).toBe(2);
      expect((await stage([rosterRow("LOCAL-0009")])).preview.reject).toBe(1);
      expect((await stage([rosterRow("PAC-0001", { first_name: "Fictional Different", last_name: "Different", pacific_email: "fictional.different@example.com" })])).preview.reject).toBe(1);
    });
    expect(await codes()).toEqual(["PAC-0001", "PAC-0002", "SYN-001"]);
  });
  it("permits ordinary name/email corrections when the remaining identity agrees", async () => {
    await asUser(admin, () => rename());
    await asUser(admin, async () => {
      const name = await stage([rosterRow("PAC-0001", { first_name: "Fictional Corrected" })]);
      expect(name.preview).toMatchObject({ update: 1, reject: 0 });
      const email = await stage([rosterRow("PAC-0001", { pacific_email: "fictional.corrected@example.com" })]);
      expect(email.preview).toMatchObject({ update: 1, reject: 0 });
    });
  });
  it("invalidates a pre-rename roster preview and preserves unchanged measurement reimports through either code", async () => {
    const draft = await asUser(admin, () => stage());
    await asUser(admin, () => importReading());
    await asUser(admin, () => rename());
    await asUser(admin, async () => {
      await expect(db.query("select public.approve_roster_import($1)", [draft.id])).rejects.toThrow("Roster changed after preview");
      for (const code of ["LOCAL-0001", "PAC-0001"]) expect(await importReading([reading(code)])).toMatchObject({ created: 0, unchanged: 1 });
      await expect(importReading([reading("LOCAL-0002")])).rejects.toThrow("Source observation already exists");
    });
    expect((await db.query("select * from public.performance_measurements")).rows).toHaveLength(1);
  });
});
