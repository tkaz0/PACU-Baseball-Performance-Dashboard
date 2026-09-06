import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
vi.mock("server-only", () => ({}));
import { loadLeaderboard } from "@/lib/leaderboard-server";
import type { LeaderboardComparison, LeaderboardRow, LeaderboardSelection } from "@/lib/leaderboards";
const db = new PGlite();
const users = { admin: "11111111-1111-4111-8111-111111111111", coach: "22222222-2222-4222-8222-222222222222", player: "33333333-3333-4333-8333-333333333333", unlinked: "44444444-4444-4444-8444-444444444444", disabled: "55555555-5555-4555-8555-555555555555", unconfigured: "66666666-6666-4666-8666-666666666666", rolefree: "77777777-7777-4777-8777-777777777777" };
const athlete = (i: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`;
const code = (i: number) => `SYN-LB-${String(i).padStart(4, "0")}`;
const selection: LeaderboardSelection = { metricKey: "max_exit_velocity", source: "fictional protocol", unit: "mph", period: "fall_2026" };
type Input = { athlete_code: string; metric_key: string; unit: string; value: number; measured_at: string; source: string; file_hash: string; source_file: string; source_sheet: string; source_row: number };
function row(i = 1, changes: Partial<Input> = {}, column = 0) {
  const raw: Input = { athlete_code: code(i), metric_key: "max_exit_velocity", unit: "mph", value: i * 10, measured_at: "2026-09-12", source: "Fictional protocol", file_hash: i.toString(16).padStart(64, "0"), source_file: "fictional-private-report.csv", source_sheet: "Fictional sheet", source_row: 2, ...changes };
  return { observation_id: `observation:${JSON.stringify([raw.file_hash, raw.source_sheet, raw.source_row, column])}`, ...raw };
}
async function asUser<T>(id: string | null, run: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${id ? "authenticated" : "anon"}`); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
  try { return await run(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
async function save(rows = [row()]) { await asUser(users.admin, () => db.query("select public.admin_import_performance($1::jsonb)", [JSON.stringify(rows)])); }
async function options() { return (await db.query<{ result: LeaderboardComparison[] }>("select public.team_leaderboard_options() result")).rows[0].result; }
async function board(changes: Partial<LeaderboardSelection> = {}) {
  const s = { ...selection, ...changes };
  return (await db.query<{ result: LeaderboardRow[] }>("select public.team_leaderboard($1,$2,$3,$4) result", [s.metricKey, s.source, s.unit, s.period])).rows[0].result;
}
beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(file, directory), "utf8"));
  for (const [key, id] of Object.entries(users)) {
    await db.query("insert into auth.users(id) values($1)", [id]); if (key === "unconfigured") continue;
    await db.query("insert into public.app_accounts(user_id,is_active) values($1,$2)", [id, key !== "disabled"]);
    if (key !== "rolefree") await db.query("insert into public.account_roles(user_id,role) values($1,$2)", [id, key === "admin" || key === "disabled" ? "admin" : key === "coach" ? "coach" : "player"]);
  }
  for (let i = 1; i <= 7; i++) {
    await db.query("insert into public.athletes(id,athlete_code,first_name,preferred_name,last_name,pacific_email) values($1,$2,'Fictional',$3,$4,$5)", [athlete(i), code(i), i === 1 ? "Preferred Fictional" : null, `Player ${i}`, `fictional${i}@example.com`]);
    await db.query("insert into public.athlete_seasons(athlete_id,season,roster_status,jersey_number,primary_position) values($1,$2,$3,$4,'P')", [athlete(i), i === 7 ? "2025-26" : "2026-27", i === 6 ? "inactive" : i === 5 ? "redshirt" : null, i - 1]);
  }
  await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)", [users.player, athlete(1)]);
});
beforeEach(async () => {
  await db.exec("delete from public.performance_measurements;delete from public.performance_imports;delete from public.audit_events where event_type='performance_imported';reset extra_float_digits");
});
afterAll(async () => { await db.close(); });
describe("explicit minimal team leaderboard access", () => {
  it("denies anonymous execution and inaccessible private raw helper", async () => {
    await asUser(null, async () => { await expect(options()).rejects.toThrow("permission denied"); await expect(board()).rejects.toThrow("permission denied"); });
    await asUser(users.player, async () => { await expect(db.query("select * from private.leaderboard_latest()")).rejects.toThrow("permission denied"); });
  });
  it.each(["disabled", "unconfigured", "rolefree"] as const)("denies %s even with an authenticated subject", async kind => {
    await asUser(users[kind], async () => { await expect(options()).rejects.toThrow("Active player or staff"); await expect(board()).rejects.toThrow("Active player or staff"); });
  });
  it("allows staff and linked/unlinked Players minimal team results without broadening ordinary RLS", async () => {
    await save([row(1), row(2)]);
    for (const key of ["admin", "coach", "player", "unlinked"] as const) {
      await asUser(users[key], async () => {
        expect(await options()).toEqual([{ ...selection, athleteCount: 2 }]);
        const data = await board(); expect(data.map(row => row.athleteCode)).toEqual([code(2), code(1)]);
        expect(data.map(row => row.profileId)).toEqual(key === "admin" || key === "coach" ? [athlete(2), athlete(1)] : key === "player" ? [null, athlete(1)] : [null, null]);
        const raw = await db.query("select id from public.performance_measurements"); expect(raw.rows).toHaveLength(key === "admin" || key === "coach" ? 2 : key === "player" ? 1 : 0);
        const roster = await db.query("select id from public.athletes"); expect(roster.rows).toHaveLength(key === "admin" || key === "coach" ? 7 : key === "player" ? 1 : 0);
      });
    }
  });
  it("returns only the exact minimal projection and preserves jersey zero and preferred names", async () => {
    await save(); const data = await asUser(users.player, () => board());
    expect(Object.keys(data[0]).sort()).toEqual(["rank", "athleteCode", "name", "jerseyNumber", "position", "profileId", "value", "measuredAt", "source", "derived"].sort());
    expect(data[0]).toMatchObject({ name: "Preferred Fictional Player 1", jerseyNumber: 0, position: "P", measuredAt: "2026-09-12" });
    for (const excluded of ["example.com", "fictional-private-report.csv", "Fictional sheet", "observation:", users.admin]) expect(JSON.stringify(data)).not.toContain(excluded);
  });
  it("removes broader Admin links in Player View as while retaining newly authorized peer values", async () => {
    await save([row(1), row(2)]);
    const access = { roles: ["player"], athleteId: athlete(1), supabase: { rpc: async () => ({ data: await board(), error: null }) } } as unknown as Parameters<typeof loadLeaderboard>[0];
    const result = await asUser(users.admin, () => loadLeaderboard(access, selection));
    expect(result).toHaveLength(2); expect(result.map(row => row.profileId)).toEqual([null, athlete(1)]);
  });
  it("rechecks disabled/revoked access without changing the current session subject", async () => {
    await asUser(users.player, async () => {
      expect(await board()).toEqual([]);
      await db.exec("reset role"); await db.query("update public.app_accounts set is_active=false where user_id=$1", [users.player]); await db.exec("set role authenticated");
      try { await expect(board()).rejects.toThrow("Active player or staff"); await expect(options()).rejects.toThrow("Active player or staff"); }
      finally { await db.exec("reset role"); await db.query("update public.app_accounts set is_active=true where user_id=$1", [users.player]); await db.exec("set role authenticated"); }
    });
  });
});
describe("comparable latest results and numerical places", () => {
  it("takes the latest result instead of historical best, with stable competition ties", async () => {
    await save([row(1, { value: 20 }), row(2, { value: 20 }), row(3, { value: 10 }), row(1, { value: 999, measured_at: "2026-09-01", file_hash: "e".repeat(64) })]);
    const data = await asUser(users.player, () => board());
    expect(data.map(row => [row.athleteCode, row.value, row.rank])).toEqual([[code(1), 20, 1], [code(2), 20, 1], [code(3), 10, 3]]);
  });
  it("uses millisecond import ties then hash and observation identity consistently", async () => {
    await save([row(1, { value: 10, file_hash: "a".repeat(64) }), row(1, { value: 20, file_hash: "b".repeat(64) })]);
    await db.exec("update public.performance_measurements set imported_at=case when value=10 then '2026-09-15T12:00:00.123100Z'::timestamptz else '2026-09-15T12:00:00.123900Z'::timestamptz end");
    expect((await asUser(users.player, () => board()))[0].value).toBe(10);
    await db.exec("update public.performance_measurements set imported_at='2026-09-15T12:00:00.124000Z' where value=20");
    expect((await asUser(users.player, () => board()))[0].value).toBe(20);
  });
  it("orders timed tests lower first and counts only measured eligible roster members", async () => {
    await save(Array.from({ length: 7 }, (_, i) => row(i + 1, { metric_key: "home_to_first", value: i + 1, unit: "s" })));
    const data = await asUser(users.unlinked, () => board({ metricKey: "home_to_first", unit: "s" }));
    expect(data.map(row => row.athleteCode)).toEqual([1, 2, 3, 4, 5].map(code)); expect(data.map(row => row.rank)).toEqual([1, 2, 3, 4, 5]);
  });
  it("never pools unlike protocols, units or Fall/summer body periods", async () => {
    await save([row(1, { metric_key: "weight", unit: "lb", source: "RENPHO", measured_at: "2026-08-20" }), row(2, { metric_key: "weight", unit: "lb", source: "  renpho  ", measured_at: "2026-09-12" }), row(3, { metric_key: "weight", unit: "kg", source: "RENPHO" }), row(4, { metric_key: "weight", unit: "lb", source: "Other protocol" })].map(r => ({ ...r, source: r.source.trim() })));
    await asUser(users.player, async () => {
      expect(await options()).toHaveLength(4);
      expect((await board({ metricKey: "weight", unit: "lb", source: "renpho" })).map(row => row.athleteCode)).toEqual([code(2)]);
      expect((await board({ metricKey: "weight", unit: "lb", source: "renpho", period: "summer_2026" })).map(row => row.athleteCode)).toEqual([code(1)]);
    });
  });
  it("preserves precise direct and truthful derived values with no five-athlete minimum", async () => {
    const body = { source: "RENPHO", source_sheet: "RENPHO report · Page 1", unit: "lb", measured_at: "2026-08-20" };
    await save([row(1, { ...body, metric_key: "weight", value: 179.10000000000002 }, 0), row(1, { ...body, metric_key: "muscle_mass", value: 132.80000000000004 }, 1), row(2, { value: 0.30000000000000004 })]);
    await db.exec("set extra_float_digits=0");
    await asUser(users.player, async () => {
      const result = await board({ metricKey: "muscle_mass_pct", unit: "%", source: "renpho", period: "summer_2026" });
      expect(result).toHaveLength(1); expect(result[0]).toMatchObject({ value: 132.80000000000004 / 179.10000000000002 * 100, derived: true });
      expect((await board())[0].value).toBe(0.30000000000000004);
      expect((await db.query<{ value: string }>("select current_setting('extra_float_digits') value")).rows[0].value).toBe("0");
    });
  });
  it("omits an ambiguous same-report muscle ratio instead of choosing among units", async () => {
    const body = { source: "RENPHO", source_sheet: "RENPHO report · Page 1", unit: "lb", measured_at: "2026-08-20" };
    await save([row(1, { ...body, metric_key: "weight", value: 150 }, 0), row(1, { ...body, metric_key: "muscle_mass", value: 100 }, 1), row(1, { ...body, metric_key: "weight", unit: "kg", value: 70 }, 2)]);
    expect(await asUser(users.player, () => board({ metricKey: "muscle_mass_pct", unit: "%", source: "renpho", period: "summer_2026" }))).toEqual([]);
  });
  it.each([{ metricKey: "body_score" }, { source: "Fictional protocol" }, { source: "" }, { unit: "unknown" }, { period: "summer_2026" }, { period: "invented" }])("rejects invalid or incomparable selectors %#", async changes => {
    await asUser(users.player, async () => { await expect(board(changes as Partial<LeaderboardSelection>)).rejects.toThrow("Choose one valid leaderboard"); });
  });
  it("keeps definer wrappers pinned and read-only without direct table grants", async () => {
    const configs = await db.query<{ prosecdef: boolean; proconfig: string[]; anon: boolean }>("select prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE') anon from pg_proc where oid in ('private.team_leaderboard(text,text,text,text)'::regprocedure,'private.leaderboard_options()'::regprocedure)");
    for (const config of configs.rows) { expect(config.prosecdef).toBe(true); expect(config.anon).toBe(false); expect(config.proconfig).toEqual(expect.arrayContaining(['search_path=""', "extra_float_digits=3"])); }
    await asUser(users.player, async () => { await expect(db.query("update public.performance_measurements set value=1")).rejects.toThrow("permission denied"); });
  });
});
