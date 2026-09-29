import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { parseBlastBatSpeedPercentile } from "@/lib/blast-speed-percentile";

const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111", coach = "22222222-2222-4222-8222-222222222222", player = "33333333-3333-4333-8333-333333333333", unlinked = "44444444-4444-4444-8444-444444444444";
const athletes = Array.from({ length: 6 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`);
const code = (index: number) => `SYN-${String(index + 1).padStart(3, "0")}`;
async function asUser<T>(id: string | null, run: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${id ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
  try { return await run(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
function report(index = 0, speed = 60, { start = "2026-09-01", end = "2026-09-07", count = 10, kind = "Average", suffix = "" } = {}) {
  const hash = createHash("sha256").update(`fictional:${index}:${start}:${end}:${kind}:${suffix}`).digest("hex");
  return [[2, "blast_swing_count", count, "count"], [3, kind === "P95" ? "p95_bat_speed" : "avg_bat_speed", speed, "mph"], [9, "blast_vertical_bat_angle", -30, "deg"]].map(([column, metric, value, unit]) => ({
    observation_id: `observation:${JSON.stringify([hash, "CSV", 2, column])}`, athlete_code: code(index), metric_key: metric,
    measured_at: end, value, unit, source: `Blast Motion · ${kind} · ${start}:${end}`, source_file: "fictional-blast-percentile.csv", source_sheet: "CSV", source_row: 2, file_hash: hash,
  }));
}
const save = (rows: ReturnType<typeof report>) => db.query("select public.admin_import_performance($1::jsonb)", [JSON.stringify(rows)]);
async function percentile(index = 0) {
  const response = (await db.query<{ data: unknown }>("select public.athlete_blast_bat_speed_percentile($1::uuid) data", [athletes[index]])).rows[0].data;
  return parseBlastBatSpeedPercentile(response, athletes[index]);
}
beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(file, directory), "utf8"));
  for (const [id, role] of [[admin, "admin"], [coach, "coach"], [player, "player"], [unlinked, "player"]]) {
    await db.query("insert into auth.users(id) values($1)", [id]);
    await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)", [id]);
    await db.query("insert into public.account_roles(user_id,role) values($1,$2)", [id, role]);
  }
  for (let i = 0; i < athletes.length; i++) {
    await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,$2,'Fictional',$3)", [athletes[i], code(i), `Percentile${i}`]);
    await db.query("insert into public.athlete_seasons(athlete_id,season) values($1,'2026-27')", [athletes[i]]);
  }
  await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)", [player, athletes[0]]);
});
beforeEach(async () => {
  await db.exec("delete from private.csv_measurement_archives;delete from public.performance_measurements;delete from public.performance_imports;delete from public.audit_events;update public.app_accounts set is_active=true;update public.athlete_seasons set roster_status=null;");
});
afterAll(() => db.close());

it("returns only the own weighted Fall value and tied midrank, excluding paired P95", async () => {
  await asUser(admin, () => save([
    ...report(0, 50), ...report(0, 90, { start: "2026-09-08", end: "2026-09-14", count: 30 }),
    ...[70, 80, 90, 100, 110].flatMap((speed, i) => report(i + 1, speed)),
    ...report(0, 150, { kind: "P95" }),
  ]));
  await asUser(player, async () => {
    const result = await percentile();
    expect(result).toEqual({ athleteId: athletes[0], observedValue: 80, percentile: 30, sampleSize: 6, swingCount: 40, reportCount: 2, firstDate: "2026-09-01", lastDate: "2026-09-14" });
    expect(JSON.stringify(result)).not.toContain("fictional-blast-percentile.csv");
    for (const peer of athletes.slice(1)) expect(JSON.stringify(result)).not.toContain(peer);
    const raw = await db.query<{ athlete_id: string }>("select athlete_id from public.performance_measurements");
    expect(raw.rows.every(reading => reading.athlete_id === athletes[0])).toBe(true);
  });
});

it("counts athletes equally after each athlete's average is weighted by swings", async () => {
  await asUser(admin, () => save(athletes.flatMap((_, i) => report(i, 60 + 10 * i, { count: i === 0 ? 10000 : 1 }))));
  await asUser(coach, async () => {
    expect(await percentile(0)).toMatchObject({ percentile: 0, sampleSize: 6 });
    expect(await percentile(5)).toMatchObject({ percentile: 100, sampleSize: 6 });
  });
});

it("withholds a percentile for fewer than five valid athletes and keeps recorded zero", async () => {
  await asUser(admin, () => save(athletes.slice(0, 4).flatMap((_, i) => report(i, i * 10))));
  await asUser(player, async () => expect(await percentile()).toMatchObject({ observedValue: 0, percentile: null, sampleSize: 4, swingCount: 10 }));
});

it("returns the tied midpoint when all five eligible values are identical", async () => {
  await asUser(admin, () => save(athletes.slice(0, 5).flatMap((_, i) => report(i, 75))));
  await asUser(player, async () => expect(await percentile()).toMatchObject({ observedValue: 75, percentile: 50, sampleSize: 5 }));
});

it("returns null for no Average report, a missing metric, or an ineligible own athlete", async () => {
  await asUser(admin, () => save([...report(0, 95, { kind: "P95" }), ...report(1, 70)]));
  await asUser(player, async () => expect(await percentile()).toBeNull());
  await asUser(admin, () => save(report(0).filter(row => row.metric_key !== "avg_bat_speed")));
  await asUser(player, async () => expect(await percentile()).toBeNull());
  await db.query("update public.athlete_seasons set roster_status='inactive' where athlete_id=$1", [athletes[1]]);
  await asUser(coach, async () => expect(await percentile(1)).toBeNull());
});

it("excludes ineligible peers while retaining active and redshirt players", async () => {
  await asUser(admin, () => save(athletes.flatMap((_, i) => report(i, 60 + 10 * i))));
  await db.query("update public.athlete_seasons set roster_status='inactive' where athlete_id=$1", [athletes[5]]);
  await db.query("update public.athlete_seasons set roster_status='redshirt' where athlete_id=$1", [athletes[4]]);
  await db.query("update public.athlete_seasons set roster_status='active' where athlete_id=$1", [athletes[3]]);
  await asUser(player, async () => expect(await percentile()).toMatchObject({ sampleSize: 5, percentile: 0 }));
});

it.each(["missing_metric", "missing_count", "fractional_count", "zero_count", "duplicate_report", "overlap", "wrong_date", "invalid_start", "too_many_swings"])("excludes an entire invalid own rollup: %s", async issue => {
  await asUser(admin, () => save([...report(0), ...report(0, 80, { start: "2026-09-08", end: "2026-09-14" }), ...athletes.slice(1).flatMap((_, i) => report(i + 1, 60 + i))]));
  const later = report(0, 80, { start: "2026-09-08", end: "2026-09-14" })[0].file_hash;
  if (issue === "missing_metric") await db.query("delete from public.performance_measurements where file_hash=$1 and metric_key='avg_bat_speed'", [later]);
  if (issue === "missing_count") await db.query("delete from public.performance_measurements where file_hash=$1 and metric_key='blast_swing_count'", [later]);
  if (issue === "fractional_count") await db.query("update public.performance_measurements set value=1.5 where file_hash=$1 and metric_key='blast_swing_count'", [later]);
  if (issue === "zero_count") await db.query("update public.performance_measurements set value=0 where file_hash=$1 and metric_key='blast_swing_count'", [later]);
  // Inject a legacy conflict as test owner; the current importer already rejects it.
  if (issue === "duplicate_report") await db.query("update public.performance_measurements set source='Blast Motion · Average · 2026-09-01:2026-09-07',measured_at='2026-09-07' where file_hash=$1", [later]);
  if (issue === "overlap") await db.query("update public.performance_measurements set source='Blast Motion · Average · 2026-09-07:2026-09-14' where file_hash=$1", [later]);
  if (issue === "wrong_date") await db.query("update public.performance_measurements set measured_at='2026-09-13' where file_hash=$1", [later]);
  if (issue === "invalid_start") await db.query("update public.performance_measurements set source='Blast Motion · Average · 2026-09-00:2026-09-14' where file_hash=$1", [later]);
  if (issue === "too_many_swings") await db.query("update public.performance_measurements set value=9007199254740991 where athlete_id=$1 and metric_key='blast_swing_count'", [athletes[0]]);
  await asUser(player, async () => expect(await percentile()).toBeNull());
  await asUser(coach, async () => expect(await percentile(1)).toMatchObject({ sampleSize: 5 }));
});

it("requires active own/staff authorization and retains Player-own raw RLS", async () => {
  await asUser(admin, () => save([...report(0), ...report(1)]));
  await asUser(player, async () => { await expect(percentile(1)).rejects.toThrow(); expect(await percentile()).not.toBeNull(); });
  await asUser(unlinked, async () => { await expect(percentile()).rejects.toThrow(); });
  await asUser(null, async () => { await expect(percentile()).rejects.toThrow(); });
  await db.query("update public.app_accounts set is_active=false where user_id=$1", [player]);
  await asUser(player, async () => { await expect(percentile()).rejects.toThrow(); });
  await asUser(coach, async () => { expect(await percentile()).not.toBeNull(); expect(await percentile(1)).not.toBeNull(); });
});

it("pins function scope, denies anonymous execution, and performs no application writes", async () => {
  const functions = await db.query<{ proname: string; prosecdef: boolean; proconfig: string[] }>("select p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='athlete_blast_bat_speed_percentile' and n.nspname='private'");
  expect(functions.rows[0]).toMatchObject({ prosecdef: true });
  expect(functions.rows[0].proconfig).toContain('search_path=""');
  const permission = await db.query<{ permitted: boolean }>("select has_function_privilege('anon','public.athlete_blast_bat_speed_percentile(uuid)','execute') permitted");
  expect(permission.rows[0].permitted).toBe(false);
  await asUser(admin, () => save(report(0)));
  const before = (await db.query("select (select count(*) from public.performance_measurements) as readings,(select count(*) from public.audit_events) as audit")).rows;
  await asUser(player, () => percentile());
  expect((await db.query("select (select count(*) from public.performance_measurements) as readings,(select count(*) from public.audit_events) as audit")).rows).toEqual(before);
});
