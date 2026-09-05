import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Fictional fixtures only. This tests PostgreSQL semantics, not a hosted Auth/API stack.
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111";
const player = "22222222-2222-4222-8222-222222222222";
const athleteId = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
const athleteCode = "SYN-BOUNDARY-01";
const fields = ["observation_id", "athlete_id", "metric_key", "metric", "unit", "value", "measured_at",
  "source", "source_file", "source_sheet", "source_row", "file_hash", "import_id", "imported_at"].sort();

type PageRow = Record<string, unknown> & { observation_id: string; value: number };
async function asUser<T>(userId: string, run: () => Promise<T>): Promise<T> {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
  try { return await run(); }
  finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub','',false)");
  }
}
function observation(sourceRow: number, value = 0.30000000000000004) {
  const fileHash = "b".repeat(64), sheet = "Fictional precision test";
  return {
    observation_id: `observation:${JSON.stringify([fileHash, sheet, sourceRow, 0])}`,
    athlete_code: athleteCode, metric_key: "max_exit_velocity", measured_at: "2026-09-12",
    value, unit: "mph", source: "Fictional test protocol", source_file: "fictional-precision.csv",
    source_sheet: sheet, source_row: sourceRow, file_hash: fileHash,
  };
}
async function seed(values: number[]) {
  for (let offset = 0; offset < values.length; offset += 500) {
    const input = values.slice(offset, offset + 500).map((value, index) => observation(offset + index + 1, value));
    await asUser(admin, () => db.query("select public.admin_import_performance($1::jsonb)", [JSON.stringify(input)]));
  }
}
async function page(offset: number | null = 0): Promise<PageRow[]> {
  return (await db.query<{ data: PageRow[] }>(
    "select public.athlete_performance_measurements($1::uuid,$2::integer) data", [athleteId, offset],
  )).rows[0].data;
}
async function setting() {
  return (await db.query<{ setting: string }>("select current_setting('extra_float_digits') setting")).rows[0].setting;
}

beforeAll(async () => {
  await db.exec("create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(new URL(file, directory), "utf8"));
  }
  await db.query("insert into auth.users(id) values($1),($2)", [admin, player]);
  await db.query("insert into public.app_accounts(user_id,is_active) values($1,true),($2,true)", [admin, player]);
  await db.query("insert into public.account_roles(user_id,role) values($1,'admin'),($2,'player')", [admin, player]);
  await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,$2,'Fictional','Boundary Player')", [athleteId, athleteCode]);
  await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)", [player, athleteId]);
});
beforeEach(async () => {
  await db.exec("delete from public.performance_measurements; delete from public.performance_imports; delete from public.audit_events where event_type='performance_imported'; reset extra_float_digits;");
});
afterAll(async () => { await db.close(); });

describe("measurement page SQL boundaries", () => {
  it("keeps invoker permissions, a pinned search path and authenticated-only execution", async () => {
    const config = (await db.query<{ prosecdef: boolean; provolatile: string; proconfig: string[]; anon_execute: boolean; authenticated_execute: boolean }>(
      "select prosecdef,provolatile,proconfig,has_function_privilege('anon',oid,'EXECUTE') anon_execute,has_function_privilege('authenticated',oid,'EXECUTE') authenticated_execute from pg_catalog.pg_proc where oid='public.athlete_performance_measurements(uuid,integer)'::regprocedure",
    )).rows[0];
    expect(config).toMatchObject({ prosecdef: false, provolatile: "s", anon_execute: false, authenticated_execute: true });
    expect(config.proconfig).toEqual(expect.arrayContaining(['search_path=""', "extra_float_digits=3"]));
  });

  it("returns only the exact public observation projection", async () => {
    await seed([1]);
    const rows = await asUser(player, () => page());
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(fields);
    expect(rows[0]).toMatchObject({ athlete_id: athleteId, metric_key: "max_exit_velocity", metric: "Max Exit Velocity", value: 1 });
    expect(JSON.stringify(rows)).not.toContain(admin);
    expect(rows[0]).not.toHaveProperty("imported_by");
    expect(rows[0]).not.toHaveProperty("created_count");
    expect(rows[0]).not.toHaveProperty("source_column");
    expect(rows[0]).not.toHaveProperty("id");
  });

  it("honors a stricter table RLS policy even for an authorized administrator", async () => {
    await seed([1]);
    expect(await asUser(admin, () => page())).toHaveLength(1);
    await db.exec("alter policy performance_measurements_read on public.performance_measurements using(false)");
    try {
      await asUser(admin, async () => {
        expect((await db.query<{ allowed: boolean }>("select private.can_read_athlete($1) allowed", [athleteId])).rows[0].allowed).toBe(true);
        expect(await page()).toEqual([]);
      });
      expect(await asUser(player, () => page())).toEqual([]);
    } finally {
      await db.exec("alter policy performance_measurements_read on public.performance_measurements using(private.can_read_athlete(athlete_id))");
    }
    expect(await asUser(player, () => page())).toHaveLength(1);
  });

  it("cannot bypass revoked table SELECT through its RPC permission", async () => {
    await seed([1]);
    await db.exec("revoke select on public.performance_measurements from authenticated");
    try {
      for (const user of [admin, player]) {
        await asUser(user, async () => { await expect(page()).rejects.toThrow("permission denied"); });
      }
    } finally {
      await db.exec("grant select on public.performance_measurements to authenticated");
    }
    expect(await asUser(player, () => page())).toHaveLength(1);
  });

  it("rechecks a removed player role while the session subject remains unchanged", async () => {
    await seed([1]);
    await asUser(player, async () => {
      expect(await page()).toHaveLength(1);
      // Simulate an administrator changing the trusted role; retain the session claim.
      await db.exec("reset role");
      await db.query("delete from public.account_roles where user_id=$1 and role='player'", [player]);
      await db.exec("set role authenticated");
      try {
        expect((await db.query<{ id: string }>("select auth.uid() id")).rows[0].id).toBe(player);
        await expect(page()).rejects.toThrow("Athlete access denied");
      } finally {
        await db.exec("reset role");
        await db.query("insert into public.account_roles(user_id,role) values($1,'player')", [player]);
        await db.exec("set role authenticated");
      }
      expect(await page()).toHaveLength(1);
    });
  });

  it.each([null, -1000, -1, 1, 999, 1001, 19999, 20001, 21000])("rejects the invalid offset %s", async offset => {
    await asUser(player, async () => { await expect(page(offset)).rejects.toThrow("Invalid measurement page offset"); });
  });

  it("accepts the default page and the bounded final overflow-detection page", async () => {
    await seed([1]);
    await asUser(player, async () => {
      const first = (await db.query<{ data: PageRow[] }>("select public.athlete_performance_measurements($1) data", [athleteId])).rows[0].data;
      expect(first).toEqual(await page(0));
      expect(await page(20000)).toEqual([]);
    });
  });

  it("keeps the exact finite float value through JSON despite a lossy caller setting", async () => {
    const values = [0, 0.30000000000000004, 179.10000000000002, 1.0000000000000002, Number.MAX_VALUE, Number.MIN_VALUE];
    await seed(values);
    await db.exec("set extra_float_digits=0");
    try {
      const control = (await db.query<{ data: { value: number } }>("select jsonb_build_object('value',value) data from public.performance_measurements where source_row=2")).rows[0].data;
      expect(control.value).not.toBe(values[1]);
      const rows = await asUser(player, () => page());
      const bySourceRow = new Map(rows.map(row => [row.source_row, row.value]));
      for (const [index, value] of values.entries()) expect(bySourceRow.get(index + 1)).toBe(value);
      expect(await setting()).toBe("0");
      await asUser(player, async () => { await expect(page(1)).rejects.toThrow("Invalid measurement page offset"); });
      expect(await setting()).toBe("0");
    } finally { await db.exec("reset extra_float_digits"); }
  });

  it("enforces real SQL page size and deterministic ordering when all timestamps tie", async () => {
    await seed(Array.from({ length: 1002 }, (_, index) => index));
    await db.exec("update public.performance_measurements set imported_at='2026-09-12T00:00:00.000Z'");
    const expected = (await db.query<{ observation_id: string }>("select observation_id from public.performance_measurements order by imported_at,id")).rows.map(row => row.observation_id);
    await asUser(player, async () => {
      const first = await page(0), second = await page(1000);
      expect(first).toHaveLength(1000);
      expect(second).toHaveLength(2);
      const actual = [...first, ...second].map(row => row.observation_id);
      expect(new Set(actual).size).toBe(1002);
      expect(actual).toEqual(expected);
      expect(await page(0)).toEqual(first);
      expect(await page(2000)).toEqual([]);
    });
  });
});
