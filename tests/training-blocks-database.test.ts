import { initializeStorageSchema } from "./fixtures/storage-schema";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111", coach = "22222222-2222-4222-8222-222222222222", player = "33333333-3333-4333-8333-333333333333", unlinked = "44444444-4444-4444-8444-444444444444";
const athlete = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", peer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
async function asUser<T>(id: string | null, run: () => Promise<T>) {
  await db.exec(`set role ${id ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
  try { return await run(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
const observation = (hash = "a", code = "SYN-001", sourceRow = 2, column = 0, source = "Full Swing · Practice", sheet = "CSV · Full Swing session summaries v1") => ({
  observation_id: `observation:${JSON.stringify([hash.repeat(64), sheet, sourceRow, column])}`, athlete_code: code, metric_key: "avg_exit_velocity", value: 70, unit: "mph", measured_at: "2026-09-01", source,
  source_file: "fictional.csv", source_sheet: sheet, source_row: sourceRow, file_hash: hash.repeat(64),
});
const save = (rows: ReturnType<typeof observation>[]) => asUser(admin, () => db.query("select public.admin_import_performance($1::jsonb)", [JSON.stringify(rows)]));
const projected = (row: ReturnType<typeof observation>) => ({ observationId: row.observation_id, count: 7, value: row.value, measuredAt: row.measured_at, source: row.source, metricKey: row.metric_key, unit: row.unit });
async function addCount(id = athlete, hash = "a", sourceRow = 2, key = "avg_exit_velocity", unit = "mph") {
  await db.query("insert into private.full_swing_session_samples(file_hash,athlete_id,metric_key,unit,source_row,sample_count) values($1,$2,$3,$4,$5,7)", [hash.repeat(64), id, key, unit, sourceRow]);
}
async function read(id = athlete, offset = 0) { return (await db.query<{ data: unknown[] }>("select public.athlete_training_block_samples($1,$2) data", [id, offset])).rows[0].data; }
beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
  const directory = new URL("../supabase/migrations/", import.meta.url);
  await initializeStorageSchema(db);
  for (const file of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(file, directory), "utf8"));
  for (const [id, role] of [[admin, "admin"], [coach, "coach"], [player, "player"], [unlinked, "player"]]) {
    await db.query("insert into auth.users(id) values($1)", [id]);
    await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)", [id]);
    await db.query("insert into public.account_roles(user_id,role) values($1,$2)", [id, role]);
  }
  await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'SYN-001','Fictional','One'),($2,'SYN-002','Fictional','Two')", [athlete, peer]);
  await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)", [player, athlete]);
});
beforeEach(async () => { await db.exec("delete from private.full_swing_session_samples;delete from private.csv_measurement_archives;delete from public.performance_measurements;delete from public.performance_imports;delete from public.audit_events;update public.app_accounts set is_active=true;"); });
afterAll(() => db.close());

it("projects only exact own observation/count pairs and lets active staff read selected players", async () => {
  const ownRow = observation(), peerRow = observation("b", "SYN-002");
  await save([ownRow, peerRow]); await addCount(); await addCount(peer, "b");
  await asUser(player, async () => {
    expect(await read()).toEqual([projected(ownRow)]);
    await expect(read(peer)).rejects.toThrow(/denied/);
    await expect(db.query("select * from private.full_swing_session_samples")).rejects.toThrow(/permission denied/);
  });
  await asUser(coach, async () => { expect(await read(peer)).toEqual([projected(peerRow)]); });
});

it("returns current measurement evidence with the count so concurrent reads can detect a republish", async () => {
  const original = observation(); await save([original]); await addCount();
  const before = await asUser(player, () => read());
  await db.query("update public.performance_measurements set value=72.3456789012345,measured_at='2026-09-02',source='Full Swing · Intrasquad' where observation_id=$1", [original.observation_id]);
  const after = await asUser(player, () => read());
  expect(before).toEqual([projected(original)]);
  expect(after).toEqual([{ ...projected(original), value: 72.3456789012345, measuredAt: "2026-09-02", source: "Full Swing · Intrasquad" }]);
});

it("denies anonymous, inactive and unlinked access immediately", async () => {
  await asUser(null, async () => { await expect(read()).rejects.toThrow(/permission denied/); });
  await asUser(unlinked, async () => { await expect(read()).rejects.toThrow(/denied/); });
  await db.query("update public.app_accounts set is_active=false where user_id=$1", [player]);
  await asUser(player, async () => { await expect(read()).rejects.toThrow(/denied/); });
  await db.query("update public.app_accounts set is_active=false where user_id=$1", [coach]);
  await asUser(coach, async () => { await expect(read()).rejects.toThrow(/denied/); });
});

it("does not borrow counts across metric, unit, original row, athlete or unsupported source", async () => {
  await save([observation("a"), observation("b"), observation("c"), observation("d"), observation("e", "SYN-001", 2, 0, "Fictional Device"), observation("f", "SYN-001", 2, 0, "Full Swing · Practice", "Other Summary")]);
  await addCount(athlete, "a", 3); await addCount(athlete, "b", 2, "max_exit_velocity"); await addCount(athlete, "c", 2, "avg_exit_velocity", "ft"); await addCount(peer, "d"); await addCount(athlete, "e"); await addCount(athlete, "f");
  await asUser(player, async () => { expect(await read()).toEqual([]); });
});

it("withholds ambiguous repeated summaries and ignores a removed measurement", async () => {
  await save([observation(), observation("a", "SYN-001", 2, 1, "Full Swing · Game")]); await addCount();
  await asUser(player, async () => { expect(await read()).toEqual([]); });
  await db.exec("delete from public.performance_measurements");
  await asUser(player, async () => { expect(await read()).toEqual([]); });
});

it("validates fixed bounded pagination", async () => {
  await asUser(player, async () => {
    for (const offset of [-1, 1, 21000]) await expect(read(athlete, offset)).rejects.toThrow(/Invalid sample page/);
    expect(await read(athlete, 20000)).toEqual([]);
  });
});
