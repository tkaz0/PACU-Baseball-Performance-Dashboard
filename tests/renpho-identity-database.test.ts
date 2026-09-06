import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111", coach = "22222222-2222-4222-8222-222222222222", player = "33333333-3333-4333-8333-333333333333";
const first = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", second = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const mapping = (renpho_id = "FICTIONAL-001", athlete_code = "SYN-001") => ({ athlete_code, renpho_id });
const fileHash = "a".repeat(64), page = "RENPHO report · Page 1";
function row(changes: Record<string, unknown> = {}) {
  return { observation_id: `observation:${JSON.stringify([fileHash, page, 2, 0])}`, athlete_code: "SYN-001", metric_key: "weight",
    measured_at: "2026-09-12", value: 160, unit: "lb", source: "RENPHO", source_file: "fictional-report.png", source_sheet: page, source_row: 2, file_hash: fileHash, ...changes };
}
async function asUser<T>(id: string | null, run: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${id ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
  try { return await run(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
async function map(rows: unknown = [mapping()], reviewed: unknown = true) {
  return (await db.query<{ data: { created: number; unchanged: number } }>("select public.admin_upsert_renpho_ids($1::jsonb,$2::boolean) data", [JSON.stringify(rows), reviewed])).rows[0].data;
}
async function match(id: unknown = "FICTIONAL-001") {
  return (await db.query<{ data: null | { athlete_id: string; athlete_code: string } }>("select public.staff_match_renpho_id($1::text) data", [id])).rows[0].data;
}
async function save(id: unknown = "FICTIONAL-001", code = "SYN-001", rows: unknown = [row()]) {
  return (await db.query<{ data: { created: number; unchanged: number } }>("select public.staff_import_renpho($1::text,$2,$3::jsonb) data", [id, code, JSON.stringify(rows)])).rows[0].data;
}
async function counts() {
  return (await db.query<{ aliases: number; observations: number; accounts: number; links: number }>("select (select count(*)::integer from private.renpho_identity_aliases) aliases, (select count(*)::integer from public.performance_measurements) observations, (select count(*)::integer from public.app_accounts) accounts, (select count(*)::integer from public.account_athletes) links")).rows[0];
}
beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(file, directory), "utf8"));
  for (const [id, role] of [[admin, "admin"], [coach, "coach"], [player, "player"]]) {
    await db.query("insert into auth.users(id) values($1)", [id]);
    await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)", [id]);
    await db.query("insert into public.account_roles(user_id,role) values($1,$2)", [id, role]);
  }
  await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'SYN-001','Fictional','One'),($2,'SYN-002','Fictional','Two')", [first, second]);
  await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)", [player, first]);
});
beforeEach(async () => {
  await db.exec("delete from private.renpho_identity_aliases;delete from public.performance_measurements;delete from public.performance_imports;delete from public.audit_events;update public.app_accounts set is_active=true;");
});
afterAll(async () => { await db.close(); });

describe("private shared RENPHO ownership", () => {
  it("retains multiple aliases, normalizes exact case/whitespace and preserves leading zeroes", async () => {
    expect(await asUser(admin, () => map([mapping(" fictional-001 "), mapping("000045", "SYN-002"), mapping("HISTORICAL-001")]))).toEqual({ created: 3, unchanged: 0 });
    expect(await asUser(coach, () => match("\tFiCtiOnAl-001\n"))).toEqual({ athlete_id: first, athlete_code: "SYN-001" });
    expect(await asUser(coach, () => match("HISTORICAL-001"))).toEqual({ athlete_id: first, athlete_code: "SYN-001" });
    expect(await asUser(coach, () => match("000045"))).toEqual({ athlete_id: second, athlete_code: "SYN-002" });
    expect(await asUser(coach, () => match("45"))).toBeNull();
    expect(await asUser(coach, () => match("FICTIONAL"))).toBeNull();
    const before = (await db.query("select * from private.renpho_identity_aliases order by renpho_id")).rows;
    expect(await asUser(admin, () => map([mapping(), mapping("000045", "SYN-002")]))).toEqual({ created: 0, unchanged: 2 });
    expect((await db.query("select * from private.renpho_identity_aliases order by renpho_id")).rows).toEqual(before);
    expect(await counts()).toEqual({ aliases: 3, observations: 0, accounts: 3, links: 1 });
    const audits = (await db.query<{ details: unknown }>("select details from public.audit_events where event_type='renpho_ids_mapped'")).rows;
    expect(audits).toEqual([{ details: { created: 3, unchanged: 0 } }, { details: { created: 0, unchanged: 2 } }]);
  });
  it("never transfers an ID and rolls back preceding new aliases on any ownership conflict", async () => {
    await asUser(admin, () => map());
    await asUser(admin, async () => { await expect(map([mapping("NEW-ID"), mapping("fictional-001", "SYN-002")])).rejects.toThrow("already belongs to another athlete"); });
    expect(await asUser(coach, () => match("NEW-ID"))).toBeNull();
    expect(await asUser(coach, () => match())).toEqual({ athlete_id: first, athlete_code: "SYN-001" });
    expect((await counts()).aliases).toBe(1);
  });
  it("requires explicit review, current existing codes and text IDs, and never clears a blank mapping", async () => {
    await asUser(admin, () => map());
    await asUser(admin, async () => {
      await expect(map([mapping("NEW-ID")], false)).rejects.toThrow("Review the RENPHO ID mapping first");
      for (const input of [[], {}, null, [null], [mapping(" ")], [mapping("BAD ID")], [mapping("X".repeat(81))], [{ athlete_code: "SYN-001", renpho_id: 45 }], [{ ...mapping(), name: "Fictional" }], [mapping("X", "SYN-999")], Array.from({ length: 201 }, (_, i) => mapping(`TEST-${i}`))]) {
        await expect(map(input)).rejects.toThrow();
      }
    });
    expect((await counts()).aliases).toBe(1);
    expect(await asUser(coach, () => match())).toEqual({ athlete_id: first, athlete_code: "SYN-001" });
  });
  it("rejects duplicate normalized input even for the same owner atomically", async () => {
    await asUser(admin, async () => { await expect(map([mapping(" NEW-ID "), mapping("new-id")])).rejects.toThrow("Duplicate RENPHO ID"); });
    expect((await counts()).aliases).toBe(0);
  });
  it("keeps aliases attached to UUID if the permanent display code changes", async () => {
    await asUser(admin, () => map());
    await db.query("update public.athletes set athlete_code='SYN-RENAMED' where id=$1", [first]);
    try {
      expect(await asUser(coach, () => match())).toEqual({ athlete_id: first, athlete_code: "SYN-RENAMED" });
      await asUser(admin, async () => { await expect(map([mapping("NEXT-ID")])).rejects.toThrow("existing permanent athlete code"); });
    } finally { await db.query("update public.athletes set athlete_code='SYN-001' where id=$1", [first]); }
  });
  it("does not expose table-wide reads or writes even to staff", async () => {
    await asUser(admin, () => map());
    for (const actor of [admin, coach, player]) await asUser(actor, async () => {
      await expect(db.query("select * from private.renpho_identity_aliases")).rejects.toThrow("permission denied");
      await expect(db.query("delete from private.renpho_identity_aliases")).rejects.toThrow("permission denied");
      await expect(db.query("update private.renpho_identity_aliases set athlete_id=$1", [second])).rejects.toThrow("permission denied");
      await expect(db.query("select private.normalized_renpho_id('FICTIONAL-001',false)")).rejects.toThrow("permission denied");
    });
    expect((await db.query<{ enabled: boolean }>("select relrowsecurity enabled from pg_catalog.pg_class where oid='private.renpho_identity_aliases'::regclass")).rows[0].enabled).toBe(true);
  });
  it("requires Admin for mapping and staff for lookup/import, with live account and role rechecks", async () => {
    for (const actor of [coach, player]) await asUser(actor, async () => { await expect(map()).rejects.toThrow("Active administrator required"); });
    await asUser(player, async () => { await expect(match()).rejects.toThrow("Active administrator or coach required"); await expect(save()).rejects.toThrow("Active administrator or coach required"); });
    await asUser(null, async () => { await expect(map()).rejects.toThrow("permission denied"); await expect(match()).rejects.toThrow("permission denied"); await expect(save()).rejects.toThrow("permission denied"); });
    for (const actor of [admin, coach]) {
      await db.query("update public.app_accounts set is_active=false where user_id=$1", [actor]);
      await asUser(actor, async () => { await expect(match()).rejects.toThrow("Active administrator or coach required"); await expect(save()).rejects.toThrow("Active administrator or coach required"); });
    }
    await asUser(admin, async () => { await expect(map()).rejects.toThrow("Active administrator required"); });
    await db.query("update public.app_accounts set is_active=true where user_id=$1", [coach]);
    await db.query("delete from public.account_roles where user_id=$1", [coach]);
    try { await asUser(coach, async () => { await expect(match()).rejects.toThrow("Active administrator or coach required"); }); }
    finally { await db.query("insert into public.account_roles(user_id,role) values($1,'coach')", [coach]); }
  });
  it("rolls back all mappings when their audit cannot be saved", async () => {
    await db.exec("create function public.fictional_fail_renpho_audit() returns trigger language plpgsql as $$begin raise exception 'Fictional audit failure';end$$;create trigger fictional_renpho_audit before insert on public.audit_events for each row execute function public.fictional_fail_renpho_audit();");
    try { await asUser(admin, async () => { await expect(map()).rejects.toThrow("Fictional audit failure"); }); }
    finally { await db.exec("drop trigger fictional_renpho_audit on public.audit_events;drop function public.fictional_fail_renpho_audit()"); }
    expect((await counts()).aliases).toBe(0);
  });
});

describe("atomic matched RENPHO import", () => {
  it("imports and retries reviewed numeric readings without persisting report IDs", async () => {
    await asUser(admin, () => map());
    expect(await asUser(coach, () => save())).toMatchObject({ created: 1, unchanged: 0 });
    expect(await asUser(coach, () => save())).toMatchObject({ created: 0, unchanged: 1 });
    const stored = (await db.query<{ athlete_id: string; value: number; imported_by: string }>("select athlete_id,value,imported_by from public.performance_measurements")).rows;
    expect(stored).toEqual([{ athlete_id: first, value: 160, imported_by: coach }]);
    const persistent = (await db.query("select to_jsonb(p) data from public.performance_measurements p union all select to_jsonb(a) data from public.audit_events a")).rows;
    expect(JSON.stringify(persistent)).not.toContain("FICTIONAL-001");
    expect(await counts()).toEqual({ aliases: 1, observations: 1, accounts: 3, links: 1 });
  });
  it("blocks a stale/manual review when its report ID has since been assigned to another athlete", async () => {
    expect(await asUser(coach, () => match())).toBeNull();
    await asUser(admin, () => map([mapping("FICTIONAL-001", "SYN-002")]));
    await asUser(coach, async () => { await expect(save()).rejects.toThrow("different player"); });
    expect((await counts()).observations).toBe(0);
  });
  it("permits explicit manual selection for unknown/blank IDs without silently creating mappings", async () => {
    expect(await asUser(coach, () => save("UNKNOWN-ID"))).toMatchObject({ created: 1, unchanged: 0 });
    expect(await asUser(coach, () => save(""))).toMatchObject({ created: 0, unchanged: 1 });
    expect((await counts()).aliases).toBe(0);
    expect(await asUser(coach, () => match("UNKNOWN-ID"))).toBeNull();
  });
  it("rejects mixed athletes, another source, invalid ID and extra numeric payload fields", async () => {
    await asUser(coach, async () => {
      for (const [id, code, rows] of [[null, "SYN-001", [row()]], ["BAD ID", "SYN-001", [row()]], ["", "SYN-999", [row()]], ["", "SYN-002", [row()]], ["", "SYN-001", [row({ source: "Other" })]], ["", "SYN-001", [row({ renpho_id: "FICTIONAL-001" })]], ["", "SYN-001", []]] as const) {
        await expect(save(id, code, rows)).rejects.toThrow();
      }
    });
    expect((await counts()).observations).toBe(0);
  });
  it("keeps ordinary numeric imports and Player-own observation RLS intact", async () => {
    await asUser(admin, () => map([mapping("FICTIONAL-001", "SYN-002")]));
    await asUser(coach, () => save("FICTIONAL-001", "SYN-002", [row({ athlete_code: "SYN-002" })]));
    expect((await asUser(player, () => db.query("select * from public.performance_measurements"))).rows).toEqual([]);
    const plain = row({ observation_id: `observation:${JSON.stringify(["b".repeat(64), "Fictional tests", 2, 0])}`, file_hash: "b".repeat(64), source: "Fictional manual", source_sheet: "Fictional tests" });
    await asUser(coach, () => db.query("select public.admin_import_performance($1::jsonb)", [JSON.stringify([plain])]));
    expect((await asUser(player, () => db.query("select athlete_id from public.performance_measurements"))).rows).toEqual([{ athlete_id: first }]);
  });
  it("pins checked function search paths, revokes anonymous execution and locks before authorization", async () => {
    for (const signature of ["private.upsert_renpho_ids(jsonb,boolean)", "private.match_renpho_id(text)", "private.import_renpho(text,text,jsonb)"]) {
      const result = (await db.query<{ definition: string; prosecdef: boolean; proconfig: string[]; anonymous: boolean }>("select pg_get_functiondef(oid) definition,prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE') anonymous from pg_catalog.pg_proc where oid=$1::regprocedure", [signature])).rows[0];
      expect(result.prosecdef).toBe(true); expect(result.proconfig).toContain('search_path=""'); expect(result.anonymous).toBe(false);
      expect(result.definition.indexOf("pg_advisory_xact_lock(72104001)")).toBeLessThan(result.definition.indexOf("private.has_role('admin')"));
      if (signature.includes("upsert")) expect(result.definition.indexOf("pg_advisory_xact_lock(72104001)")).toBeLessThan(result.definition.indexOf("pg_advisory_xact_lock(72104002)"));
    }
    // PGlite is one connection: verify database uniqueness plus serialization structure,
    // without claiming this simulates independent concurrent Supabase sessions.
    await asUser(admin, () => map());
    await expect(db.query("insert into private.renpho_identity_aliases(renpho_id,athlete_id,created_by) values('FICTIONAL-001',$1,$2)", [second, admin])).rejects.toThrow("duplicate key");
  });
});
