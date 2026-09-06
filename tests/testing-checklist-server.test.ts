import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Query = { table: string; columns: string; count: string; filters: [string, unknown][]; orders: string[]; range: number[] };
type Page = { data: unknown; error: unknown; count: number | null };
const fake = vi.hoisted(() => ({ access: vi.fn(), queries: [] as Query[], roster: [] as Record<string, unknown>[], readings: [] as Record<string, unknown>[], pages: {} as Record<string, Page[]> }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireImportAccess: fake.access }));
import { loadTestingChecklist, loadTestingRoster } from "@/lib/testing-checklist-server";

const uuid = (index: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}`;
const athlete = (index = 1, changes: Record<string, unknown> = {}) => ({ id: uuid(index), athlete_code: `SYN-${String(index).padStart(3, "0")}`,
  first_name: "Fictional", preferred_name: null, last_name: `Player ${index}`, athlete_seasons: [{ season: "2026-27", jersey_number: 0, primary_position: "OF", secondary_position: null, player_type: "position", roster_status: "active" }], ...changes });
const observation = (index = 1, changes: Record<string, unknown> = {}) => ({ observation_id: `fictional-observation-${index}`, athlete_id: uuid(1), metric_key: "max_exit_velocity", value: 80, unit: "mph",
  measured_at: "2026-09-12", source: "Fictional protocol", imported_at: "2026-09-12T20:00:00Z", file_hash: "a".repeat(64), source_sheet: "Fictional tests", ...changes });
const supabase = { from(table: string) {
  const query: Query = { table, columns: "", count: "", filters: [], orders: [], range: [] }; fake.queries.push(query);
  const builder = {
    select(columns: string, options: { count: string }) { query.columns = columns; query.count = options.count; return builder; },
    eq(column: string, value: unknown) { query.filters.push([column, value]); return builder; },
    in(column: string, value: unknown) { query.filters.push([column, value]); return builder; },
    gte(column: string, value: unknown) { query.filters.push([`${column}:gte`, value]); return builder; },
    lte(column: string, value: unknown) { query.filters.push([`${column}:lte`, value]); return builder; },
    order(column: string) { query.orders.push(column); return builder; },
    async range(from: number, to: number) {
      query.range = [from, to];
      const forced = fake.pages[table]?.shift(); if (forced) return forced;
      const ids = query.filters.find(([key]) => key === "athlete_id")?.[1] as string[] | undefined;
      const rows = table === "athletes" ? fake.roster : fake.readings.filter(row => ids?.includes(row.athlete_id as string));
      return { data: rows.slice(from, to + 1), error: null, count: rows.length };
    },
  }; return builder;
} };
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-13T06:30:00Z"));
  fake.queries = []; fake.roster = [athlete()]; fake.readings = [observation()]; fake.pages = {};
  fake.access.mockResolvedValue({ roles: ["coach"], actualRoles: ["coach"], preview: null, user: { id: uuid(99) }, supabase });
});
afterEach(() => vi.useRealTimers());

describe("staff testing checklist server boundary", () => {
  it.each(["/login", "/access-denied", "/overview?preview=read-only", "/access-preview-unavailable"])("requires live import access before any checklist or roster query: %s", destination => {
    fake.access.mockRejectedValue(new Error(`REDIRECT:${destination}`));
    return Promise.all([
      expect(loadTestingRoster()).rejects.toThrow(`REDIRECT:${destination}`),
      expect(loadTestingChecklist("weight")).rejects.toThrow(`REDIRECT:${destination}`),
    ]).then(() => { expect(fake.queries).toEqual([]); });
  });
  it("uses one roster query and one metric query with minimal fields, current season and Pacific date limits", async () => {
    const result = await loadTestingChecklist("max_exit_velocity");
    expect(result).toMatchObject({ today: "2026-09-12", recordedCount: 1, totalCount: 1 });
    expect(fake.access).toHaveBeenCalledOnce(); expect(fake.queries).toHaveLength(2);
    const [roster, measurements] = fake.queries;
    expect(roster.columns).toBe("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons!inner(season,jersey_number,primary_position,secondary_position,player_type,roster_status)");
    expect(roster.filters).toEqual([["athlete_seasons.season", "2026-27"]]);
    expect(measurements.columns).toBe("observation_id,athlete_id,metric_key,value,unit,measured_at,source,imported_at,file_hash,source_sheet");
    expect(measurements.filters).toEqual([["athlete_id", [uuid(1)]], ["metric_key", "max_exit_velocity"], ["measured_at:gte", "2026-09-01"], ["measured_at:lte", "2026-09-12"]]);
    expect(fake.queries.every(query => query.count === "exact" && query.orders[0] === "id")).toBe(true);
    expect(Object.keys(result.rows[0].athlete).sort()).toEqual(["athleteCode", "id", "jerseyNumber", "name", "playerType", "primaryPosition", "rosterStatus", "secondaryPosition"]);
    expect(Object.keys(result.rows[0].latest!).sort()).toEqual(["measuredAt", "source", "unit", "value"]);
  });
  it("allows trusted interactive Coach presentation using the ordinary signed-in client", async () => {
    fake.access.mockResolvedValueOnce({ roles: ["coach"], actualRoles: ["admin"], preview: { role: "coach" }, user: { id: uuid(99) }, supabase });
    expect((await loadTestingChecklist("max_exit_velocity")).recordedCount).toBe(1);
    expect(fake.access).toHaveBeenCalledOnce();
  });
  it("fetches direct percentage and both RENPHO inputs together without extra per-player queries", async () => {
    fake.readings = [observation(1, { metric_key: "weight", value: 200, unit: "lb", source: "RENPHO", source_sheet: "RENPHO report · Page 1" }),
      observation(2, { metric_key: "muscle_mass", value: 130, unit: "lb", source: "RENPHO", source_sheet: "RENPHO report · Page 1" })];
    const result = await loadTestingChecklist("muscle_mass_pct");
    expect(result).toMatchObject({ totalCount: 1, recordedCount: 1, needsTestingCount: 0 });
    expect(result.rows[0].latest).toEqual({ value: 65, unit: "%", source: "RENPHO", measuredAt: "2026-09-12" });
    expect(fake.queries).toHaveLength(2);
    expect(fake.queries[1].filters).toContainEqual(["metric_key", ["muscle_mass_pct", "weight", "muscle_mass"]]);
    expect(Object.keys(result.rows[0].latest!).sort()).toEqual(["measuredAt", "source", "unit", "value"]);
  });
  it("filters inactive roster rows and does not query ineligible pitcher hitting/speed observations", async () => {
    fake.roster = [athlete(1, { athlete_seasons: [{ ...athlete().athlete_seasons[0], player_type: "pitcher", primary_position: "P" }] }),
      athlete(2, { athlete_seasons: [{ ...athlete().athlete_seasons[0], roster_status: "inactive" }] })];
    expect((await loadTestingRoster()).map(row => row.id)).toEqual([uuid(1)]);
    fake.queries = [];
    expect(await loadTestingChecklist("home_to_first")).toMatchObject({ rows: [], totalCount: 0, recordedCount: 0, needsTestingCount: 0 });
    expect(fake.queries).toHaveLength(1);
  });
  it("rejects an unsupported metric before reading any private roster data", async () => {
    await expect(loadTestingChecklist("account_roles")).rejects.toThrow("valid testing measurement");
    expect(fake.access).toHaveBeenCalledOnce(); expect(fake.queries).toEqual([]);
  });
  it("keeps the window empty before Fall and capped after Fall", async () => {
    vi.setSystemTime(new Date("2026-09-01T06:59:59Z"));
    expect((await loadTestingChecklist("max_exit_velocity")).recordedCount).toBe(0);
    expect(fake.queries).toHaveLength(1);
    fake.queries = []; vi.setSystemTime(new Date("2027-01-02T20:00:00Z"));
    await loadTestingChecklist("max_exit_velocity");
    expect(fake.queries[1].filters).toContainEqual(["measured_at:lte", "2026-12-31"]);
  });
});

describe("checklist pagination and incomplete-response failures", () => {
  it("reads complete deterministic pages beyond the provider limit before selecting a latest test", async () => {
    fake.readings = Array.from({ length: 1001 }, (_, index) => observation(index + 1, { value: index + 1 }));
    const result = await loadTestingChecklist("max_exit_velocity");
    expect(result.recordedCount).toBe(1);
    expect(fake.queries.filter(query => query.table === "performance_measurements").map(query => query.range)).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });
  it("batches roster IDs instead of making a query for every player or an oversized URL", async () => {
    fake.roster = Array.from({ length: 101 }, (_, index) => athlete(index + 1));
    fake.readings = [observation()];
    expect((await loadTestingChecklist("max_exit_velocity")).totalCount).toBe(101);
    const measurements = fake.queries.filter(query => query.table === "performance_measurements");
    expect(measurements).toHaveLength(2);
    expect(measurements.map(query => (query.filters.find(([key]) => key === "athlete_id")![1] as string[]).length)).toEqual([100, 1]);
  });
  it.each([
    { table: "athletes", page: { data: [], error: { message: "Fictional provider failure" }, count: 1 } },
    { table: "athletes", page: { data: [athlete()], error: null, count: null } },
    { table: "athletes", page: { data: [athlete()], error: null, count: 1001 } },
    { table: "performance_measurements", page: { data: [], error: null, count: 1 } },
    { table: "performance_measurements", page: { data: [observation()], error: null, count: 20001 } },
  ])("fails explicitly for unavailable counts, provider errors or truncation %#", async ({ table, page }) => {
    fake.pages[table] = [page];
    await expect(loadTestingChecklist("max_exit_velocity")).rejects.toThrow("could not be verified");
  });
  it("fails if the source count changes between pages rather than presenting a partial checklist", async () => {
    fake.pages.performance_measurements = [{ data: Array.from({ length: 500 }, (_, index) => observation(index)), error: null, count: 501 },
      { data: [observation(501)], error: null, count: 502 }];
    await expect(loadTestingChecklist("max_exit_velocity")).rejects.toThrow("could not be verified");
  });
  it("rejects duplicate identities, duplicate observations and unexpected private response fields", async () => {
    fake.roster = [athlete(), athlete()]; await expect(loadTestingRoster()).rejects.toThrow("could not be verified");
    fake.roster = [athlete()]; fake.readings = [observation(), observation()];
    await expect(loadTestingChecklist("max_exit_velocity")).rejects.toThrow("could not be verified");
    fake.readings = [observation(1, { private_note: "Fictional excluded field" })];
    await expect(loadTestingChecklist("max_exit_velocity")).rejects.toThrow("could not be verified");
  });
  it("rejects measurements for another selected metric or an unrequested athlete", async () => {
    for (const changes of [{ metric_key: "weight" }, { athlete_id: uuid(50) }]) {
      fake.pages.performance_measurements = [{ data: [observation(1, changes)], error: null, count: 1 }];
      await expect(loadTestingChecklist("max_exit_velocity")).rejects.toThrow("could not be verified");
    }
  });
});
