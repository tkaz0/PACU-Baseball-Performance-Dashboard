import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111", coach = "22222222-2222-4222-8222-222222222222";
const hash = "a".repeat(64), page = "RENPHO report · Page 1";
const migration = readFileSync(new URL("../supabase/migrations/202609060008_renpho_report_positions.sql", import.meta.url), "utf8");
function row(changes: Record<string, unknown> = {}, column = 0) {
  const observation = { athlete_code: "SYN-001", metric_key: "weight", measured_at: "2026-08-20", value: 150, unit: "lb", source: "RENPHO", source_file: "fictional-report.png", source_sheet: page, source_row: 2, file_hash: hash, ...changes };
  return { observation_id: `observation:${JSON.stringify([observation.file_hash, observation.source_sheet, observation.source_row, column])}`, ...observation };
}
async function asUser<T>(id: string, run: () => Promise<T>): Promise<T> {
  await db.exec("set role authenticated"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  try { return await run(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
async function save(rows = [row()]) { return (await db.query<{ receipt: { created: number; unchanged: number } }>("select public.admin_import_performance($1::jsonb) receipt", [JSON.stringify(rows)])).rows[0].receipt; }
async function counts() { return (await db.query<{ rows: number; receipts: number; audit: number }>("select (select count(*)::integer from public.performance_measurements) rows,(select count(*)::integer from public.performance_imports) receipts,(select count(*)::integer from public.audit_events where event_type='performance_imported') audit")).rows[0]; }
beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const name of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(name, directory), "utf8"));
  for (const [id, role] of [[admin, "admin"], [coach, "coach"]]) {
    await db.query("insert into auth.users(id) values($1)", [id]); await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)", [id]); await db.query("insert into public.account_roles(user_id,role) values($1,$2)", [id, role]);
  }
  await db.exec("insert into public.athletes(athlete_code,first_name,last_name) values('SYN-001','Fictional','Player One'),('SYN-002','Fictional','Player Two')");
});
beforeEach(async () => { await db.exec("delete from public.performance_measurements;delete from public.performance_imports;delete from public.audit_events where event_type='performance_imported'"); });
afterAll(async () => { await db.close(); });
describe("atomic canonical RENPHO report position identity", () => {
  it.each([
    { measured_at: "2026-08-21" }, { athlete_code: "SYN-002" }, { unit: "kg" }, { metric_key: "muscle_mass" },
  ])("rejects different OCR line grouping plus changed semantic identity %#", async changes => {
    await asUser(coach, () => save());
    await asUser(admin, async () => { await expect(save([row({ source_row: 8, ...changes })])).rejects.toThrow("performance_renpho_report_position_unique"); });
    expect(await counts()).toEqual({ rows: 1, receipts: 1, audit: 1 });
    const original = (await db.query<{ source_row: number; value: number }>("select source_row,value from public.performance_measurements")).rows[0];
    expect(original).toEqual({ source_row: 2, value: 150 });
  });
  it("does not duplicate identical readings when OCR changes only the source row", async () => {
    await asUser(coach, () => save());
    await asUser(admin, async () => { await expect(save([row({ source_row: 8 })])).rejects.toThrow(/performance_.*unique/); });
    expect(await counts()).toEqual({ rows: 1, receipts: 1, audit: 1 });
  });
  it("rejects duplicate report fields within one reviewed batch without a partial save", async () => {
    await asUser(coach, async () => { await expect(save([row(), row({ source_row: 8, metric_key: "muscle_mass" })])).rejects.toThrow("performance_renpho_report_position_unique"); });
    expect(await counts()).toEqual({ rows: 0, receipts: 0, audit: 0 });
  });
  it("does not depend on either staff review having seen the other submission", async () => {
    // Two independent preflights both see no saved report; actual writes enforce identity.
    for (const id of [admin, coach]) expect((await asUser(id, () => db.query<{ data: unknown[] }>("select public.performance_report_measurements($1) data", [hash]))).rows[0].data).toEqual([]);
    await asUser(admin, () => save());
    await asUser(coach, async () => { await expect(save([row({ metric_key: "muscle_mass" }, 1), row({ source_row: 8, measured_at: "2026-08-21" })])).rejects.toThrow("performance_renpho_report_position_unique"); });
    expect(await counts()).toEqual({ rows: 1, receipts: 1, audit: 1 });
  });
  it("preserves exact retries and distinct file/page/field identities", async () => {
    expect(await asUser(coach, () => save())).toEqual(expect.objectContaining({ created: 1, unchanged: 0 }));
    expect(await asUser(admin, () => save())).toEqual(expect.objectContaining({ created: 0, unchanged: 1 }));
    const distinct = [row({ metric_key: "muscle_mass" }, 1), row({ metric_key: "bone_mass", source_sheet: "RENPHO report · Page 2" }), row({ file_hash: "b".repeat(64) })];
    expect(await asUser(coach, () => save(distinct))).toEqual(expect.objectContaining({ created: 3, unchanged: 0 }));
    expect(await counts()).toEqual({ rows: 4, receipts: 3, audit: 3 });
  });
  it.each([{ source: "Fictional protocol" }, { source_sheet: "Fictional trial table" }])("preserves legitimate repeated trial rows outside canonical reports %#", async changes => {
    expect(await asUser(coach, () => save([row(changes), row({ ...changes, source_row: 8, value: 151 })]))).toEqual(expect.objectContaining({ created: 2 }));
  });
  it("fails migration safely if prior conflicting rows exist without deleting or rewriting them", async () => {
    await db.exec("begin;drop index public.performance_renpho_report_position_unique");
    try {
      await asUser(admin, () => save([row(), row({ source_row: 8, measured_at: "2026-08-21" })]));
      await db.exec("savepoint before_index");
      await expect(db.exec(migration)).rejects.toThrow("performance_renpho_report_position_unique");
      await db.exec("rollback to savepoint before_index");
      expect(await counts()).toEqual({ rows: 2, receipts: 1, audit: 1 });
    } finally { await db.exec("rollback"); }
    expect((await db.query("select indexname from pg_indexes where indexname='performance_renpho_report_position_unique'")).rows).toHaveLength(1);
  });
});
