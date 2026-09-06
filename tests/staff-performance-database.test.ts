import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { prepareManualTesting, type ManualTestingInput } from "@/lib/manual-testing";
import { prepareReviewedPerformanceRows } from "@/lib/performance-import";
import type { TestingAthlete } from "@/lib/testing-checklist";
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111", coach = "22222222-2222-4222-8222-222222222222", otherCoach = "33333333-3333-4333-8333-333333333333", player = "44444444-4444-4444-8444-444444444444";
const athleteId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", fileHash = "a".repeat(64);
const row = (i = 1, changes: Record<string, unknown> = {}) => ({
  observation_id: `observation:${JSON.stringify([fileHash, "Fictional tests", i, 0])}`, athlete_code: "SYN-001", metric_key: "max_exit_velocity",
  measured_at: "2026-09-12", value: 0.30000000000000004, unit: "mph", source: "Fictional protocol", source_file: "fictional.csv", source_sheet: "Fictional tests", source_row: i, file_hash: fileHash, ...changes,
});
async function asUser<T>(id: string | null, run: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${id ? "authenticated" : "anon"}`); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
  try { return await run(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
async function save(rows: unknown = [row()]) { return (await db.query<{ receipt: { import_id: string; created: number; unchanged: number } }>("select public.admin_import_performance($1::jsonb) receipt", [JSON.stringify(rows)])).rows[0].receipt; }
async function report(hash: string | null = fileHash) { return (await db.query<{ data: Record<string, unknown>[] }>("select public.performance_report_measurements($1) data", [hash])).rows[0].data; }
async function count() { return (await db.query<{ n: number; receipts: number; audit: number }>("select (select count(*)::integer from public.performance_measurements) n,(select count(*)::integer from public.performance_imports) receipts,(select count(*)::integer from public.audit_events where event_type='performance_imported') audit")).rows[0]; }
beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(directory).filter(name => name.endsWith(".sql") && name <= "202609060006_staff_performance_imports.sql").sort()) await db.exec(readFileSync(new URL(file, directory), "utf8"));
  for (const [id, role] of [[admin, "admin"], [coach, "coach"], [otherCoach, "coach"], [player, "player"]]) {
    await db.query("insert into auth.users(id) values($1)", [id]); await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)", [id]); await db.query("insert into public.account_roles(user_id,role) values($1,$2)", [id, role]);
  }
  await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'SYN-001','Fictional','Player')", [athleteId]);
  await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)", [player, athleteId]);
});
beforeEach(async () => {
  await db.exec("delete from public.performance_measurements;delete from public.performance_imports;delete from public.audit_events where event_type='performance_imported';reset extra_float_digits;update public.app_accounts set is_active=true;");
});
afterAll(async () => { await db.close(); });
describe("manual testing through the existing staff import RPC", () => {
  const manualAthlete: TestingAthlete = { id: athleteId, athleteCode: "SYN-001", name: "Fictional Player", jerseyNumber: 0,
    primaryPosition: "CF", secondaryPosition: null, playerType: "position", rosterStatus: "active" };
  const manualInput = (): ManualTestingInput => ({ submissionId: "55555555-5555-4555-8555-555555555555", athleteCode: "SYN-001", testedOn: "2026-09-12", protocol: "Fictional testing station",
    rows: [{ metricKey: "height", unit: "ft-in", value: "", feet: "5", inches: "11.5" }, { metricKey: "weight", unit: "lb", value: "180.2" }] });
  async function reviewed(draft = manualInput()) {
    return prepareReviewedPerformanceRows((await prepareManualTesting(draft, manualAthlete, "2026-09-19")).measurements);
  }
  it.each([["Coach", coach], ["Admin session used by Coach view", admin]])("%s saves reviewed height and weight once, with idempotent retries and atomic conflict rejection", async (_label, actor) => {
    const rows = await reviewed();
    expect(await asUser(actor, () => save(rows))).toMatchObject({ created: 2, unchanged: 0 });
    expect(await asUser(actor, async () => save(await reviewed()))).toMatchObject({ created: 0, unchanged: 2 });
    const stored = (await db.query<{ metric_key: string; unit: string; value: number; source: string; imported_by: string }>("select metric_key,unit,value,source,imported_by from public.performance_measurements order by metric_key")).rows;
    expect(stored).toEqual([
      { metric_key: "height", unit: "in", value: 71.5, source: "Manual testing · Fictional testing station", imported_by: actor },
      { metric_key: "weight", unit: "lb", value: 180.2, source: "Manual testing · Fictional testing station", imported_by: actor },
    ]);
    const conflicting = manualInput();
    conflicting.rows[1].value = "181";
    conflicting.rows.push({ metricKey: "max_exit_velocity", unit: "mph", value: "88" });
    const changed = await reviewed(conflicting);
    // Try the new observation first so a conflict must roll back a partial insert.
    await asUser(actor, async () => { await expect(save([changed[2], ...changed.slice(0, 2)])).rejects.toThrow("Source observation already exists"); });
    expect(await count()).toEqual({ n: 2, receipts: 2, audit: 2 });
    expect((await db.query<{ value: number }>("select value from public.performance_measurements where metric_key='weight'")).rows[0].value).toBe(180.2);
  });
  it("keeps Player and anonymous sessions from saving valid manually prepared rows", async () => {
    const rows = await reviewed();
    await asUser(player, async () => { await expect(save(rows)).rejects.toThrow("Active administrator or coach required"); });
    await asUser(null, async () => { await expect(save(rows)).rejects.toThrow("permission denied"); });
    expect(await count()).toEqual({ n: 0, receipts: 0, audit: 0 });
  });
});
describe("reviewed staff performance import SQL", () => {
  it("allows Coach create/retry, immutable conflicts and atomic rejection while preserving the exact actor", async () => {
    expect(await asUser(coach, () => save())).toMatchObject({ created: 1, unchanged: 0 });
    expect(await asUser(coach, () => save())).toMatchObject({ created: 0, unchanged: 1 });
    await asUser(coach, async () => { await expect(save([row(2), row(1, { value: 11 })])).rejects.toThrow("Source observation already exists"); });
    expect(await count()).toEqual({ n: 1, receipts: 2, audit: 2 });
    const saved = (await db.query<{ imported_by: string }>("select imported_by from public.performance_measurements")).rows[0]; expect(saved.imported_by).toBe(coach);
    await asUser(coach, async () => { await expect(save([row(2), row(3, { unit: "unknown" })])).rejects.toThrow("Unsupported metric"); });
    expect(await count()).toEqual({ n: 1, receipts: 2, audit: 2 });
  });
  it("keeps Coach receipts to their own imports and audit details Admin-only", async () => {
    await asUser(admin, () => save()); await asUser(coach, () => save()); await asUser(otherCoach, () => save());
    for (const [id, n] of [[admin, 3], [coach, 1], [otherCoach, 1], [player, 0]] as const) {
      const receipts = await asUser(id, () => db.query<{ created_by: string }>("select created_by from public.performance_imports")); expect(receipts.rows).toHaveLength(n);
      if (id === coach || id === otherCoach) expect(receipts.rows[0].created_by).toBe(id);
    }
    expect((await asUser(coach, () => db.query("select * from public.audit_events"))).rows).toEqual([]);
  });
  it("denies Player, inactive staff and anonymous imports without granting direct writes or core bypass", async () => {
    await asUser(player, async () => { await expect(save()).rejects.toThrow("Active administrator or coach required"); });
    for (const id of [admin, coach]) {
      await db.query("update public.app_accounts set is_active=false where user_id=$1", [id]);
      await asUser(id, async () => { await expect(save()).rejects.toThrow("Active administrator or coach required"); });
    }
    await asUser(null, async () => { await expect(save()).rejects.toThrow("permission denied"); });
    await asUser(otherCoach, async () => {
      await expect(db.query("update public.performance_measurements set value=0")).rejects.toThrow("permission denied");
      await expect(db.query("delete from public.performance_measurements")).rejects.toThrow("permission denied");
      await expect(db.query("select private.import_performance_original_codes('[]')")).rejects.toThrow("permission denied");
    });
    expect(await count()).toEqual({ n: 0, receipts: 0, audit: 0 });
  });
  it("rechecks a revoked Coach role while keeping the same authenticated session subject", async () => {
    await asUser(coach, async () => {
      await save();
      await db.exec("reset role"); await db.query("delete from public.account_roles where user_id=$1 and role='coach'", [coach]); await db.exec("set role authenticated");
      try { await expect(save([row(2)])).rejects.toThrow("Active administrator or coach required"); await expect(report()).rejects.toThrow("Active administrator or coach required"); }
      finally { await db.exec("reset role"); await db.query("insert into public.account_roles(user_id,role) values($1,'coach')", [coach]); await db.exec("set role authenticated"); }
    });
  });
  it("does not grant Coach roster, identity, account, invitation or preparation administration", async () => {
    const operations: [string, unknown[]][] = [
      ["select public.admin_configure_account($1,true,array['admin'],null)", [player]],
      ["select public.admin_rename_athlete_codes('[]',true)", []],
      ["select public.admin_prepare_coach('Fictional Coach','coach@example.com',true)", []],
      ["select public.admin_provision_invited_account($1,'coach',null)", [player]],
      ["select public.stage_roster_import('[]','2026-27','fictional.csv',$1)", [fileHash]],
    ];
    await asUser(coach, async () => { for (const [sql, args] of operations) await expect(db.query(sql, args)).rejects.toThrow(/administrator|admin/i); });
    expect((await db.query<{ role: string }>("select role from public.account_roles where user_id=$1", [player])).rows).toEqual([{ role: "player" }]);
  });
});
describe("staff report dedup RPC boundaries", () => {
  it("pins precision with invoker RLS and exact numeric projection, with no account or receipt data", async () => {
    await asUser(coach, () => save()); await db.exec("set extra_float_digits=0");
    const rows = await asUser(coach, () => report()); expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["id", "athlete_code", "measured_at", "source", "metric", "value", "unit", "source_file", "source_sheet", "source_row", "file_hash"].sort());
    expect(rows[0].value).toBe(0.30000000000000004); expect(rows[0].athlete_code).toBe("SYN-001");
    expect((await db.query<{ setting: string }>("select current_setting('extra_float_digits') setting")).rows[0].setting).toBe("0");
    const config = (await db.query<{ prosecdef: boolean; proconfig: string[]; anon_execute: boolean }>("select prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE') anon_execute from pg_catalog.pg_proc where oid='public.performance_report_measurements(text)'::regprocedure")).rows[0];
    expect(config.prosecdef).toBe(false); expect(config.anon_execute).toBe(false); expect(config.proconfig).toEqual(expect.arrayContaining(['search_path=""', "extra_float_digits=3"]));
  });
  it("does not let Player use hash probing even for their own report, and rejects bad hashes", async () => {
    await asUser(coach, () => save());
    await asUser(player, async () => { await expect(report()).rejects.toThrow("Active administrator or coach required"); });
    await asUser(null, async () => { await expect(report()).rejects.toThrow("permission denied"); });
    await asUser(coach, async () => {
      for (const hash of [null, "", "A".repeat(64), "a".repeat(65), "a".repeat(64) + "\n"]) await expect(report(hash)).rejects.toThrow("Invalid report hash");
      expect(await report("b".repeat(64))).toEqual([]);
    });
  });
  it("retains ordinary table RLS and SELECT permissions", async () => {
    await asUser(coach, () => save());
    await db.exec("create policy fictional_deny_report on public.performance_measurements as restrictive for select to authenticated using(false)");
    try { expect(await asUser(coach, () => report())).toEqual([]); } finally { await db.exec("drop policy fictional_deny_report on public.performance_measurements"); }
    await db.exec("revoke select on public.performance_measurements from authenticated");
    try { await asUser(coach, async () => { await expect(report()).rejects.toThrow("permission denied"); }); } finally { await db.exec("grant select on public.performance_measurements to authenticated"); }
  });
  it("caps report rows at 501 with deterministic ordering so the adapter can reject incomplete review", async () => {
    await asUser(coach, () => save(Array.from({ length: 500 }, (_, i) => row(i + 1)))); await asUser(coach, () => save([row(501), row(502)]));
    const rows = await asUser(coach, () => report()); expect(rows).toHaveLength(501);
    expect(rows.map(item => item.id)).toEqual([...rows.map(item => item.id)].sort());
  });
});
