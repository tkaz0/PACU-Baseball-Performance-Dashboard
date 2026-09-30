import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredMeasurement } from "@/lib/local-workspace";
import type { RosterAthlete } from "@/lib/types";
import type { SharedGameStat } from "@/lib/game-server";
const mocks = vi.hoisted(() => ({ access: vi.fn(), from: vi.fn(), performance: vi.fn(), games: vi.fn(), comparisons: vi.fn(), options: vi.fn(), leaderboard: vi.fn(), gameBoards: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getAccess: mocks.access }));
vi.mock("@/lib/performance-server", () => ({ loadAthletePerformance: mocks.performance }));
vi.mock("@/lib/game-server", () => ({ loadGameStats: mocks.games }));
vi.mock("@/lib/game-comparison-server", () => ({ loadGameComparisons: mocks.comparisons, loadGameLeaderboards: mocks.gameBoards }));
vi.mock("@/lib/leaderboard-server", () => ({ loadLeaderboardComparisons: mocks.options, loadLeaderboard: mocks.leaderboard }));
import { POST } from "@/app/(workspace)/graphics/data/route";
import { buildGraphicsPlayerData, loadGraphicsLeaderboards, loadGraphicsPlayer } from "@/lib/graphics-server";
import { buildGraphicsCard } from "@/lib/graphics-card";
import { renderGraphics } from "@/lib/graphics-renderer";

type Access = Parameters<typeof loadGraphicsPlayer>[0];
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", peer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", origin = "https://dashboard.example.com";
// All names, identifiers, results and provenance markers are fictional.
const athlete: RosterAthlete = { id, athlete_code: "PAC-9999", first_name: "Fictional", preferred_name: null, last_name: "Boxer", pacific_email: "fictional@example.com", profile_photo_url: "https://example.com/private-photo", created_at: "2026-09-01", updated_at: "2026-09-01", renpho_id: "PRIVATE-REPORT-ID", athlete_seasons: [{ athlete_id: id, season: "2026-27", jersey_number: 0, primary_position: "SS", secondary_position: "P", player_type: "two_way", bats: "R", throws: "R", academic_class: "Senior", eligibility_year: 4, graduation_year: 2027, roster_status: "active" }] };
const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
const access = (roles: Access["roles"] = ["coach"], athleteId: string | null = null, preview: Access["preview"] = null) => ({ roles, actualRoles: preview ? ["admin"] : roles, athleteId, preview, supabase: { from: mocks.from } }) as unknown as Access;
const playerPreview = { version: 1 as const, actorId: peer, role: "player" as const, athleteId: id, expiresAt: Date.now() + 10000 };
const request = (body: unknown = { kind: "player", athleteId: id }, headers: Record<string, string> = {}) => new Request(`${origin}/graphics/data`, { method: "POST", headers: { origin, "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const reading = (metric: string, value: number, unit: string, source = "RENPHO", date = "2026-09-16", hash = "a".repeat(64)): StoredMeasurement => ({ id: `PRIVATE-OBSERVATION-${metric}-${source}-${date}-${hash}`, athlete_code: "PAC-9999", metric, value, unit, source, measured_at: date, file_hash: hash, source_file: "PRIVATE-SOURCE.csv", source_sheet: source === "RENPHO" ? "RENPHO report · Page 1" : "PRIVATE-SHEET", source_row: 9, batch_id: "PRIVATE-BATCH" });
const game = (metric: string, value: number): SharedGameStat => ({ source: "qpa_fall_2026", athlete_id: id, metric, value, unit: "count", scope: "cumulative_fall", event_id: null, played_on: null, source_row: 9, source_column: 2, derived_from: [], snapshot_id: peer, fetched_at: "2026-09-20T04:00:00Z", content_hash: "c".repeat(64) });
const build = (partial: Partial<Parameters<typeof buildGraphicsPlayerData>[0]> = {}) => buildGraphicsPlayerData({ athlete, measurements: [], batches: [], percentileOverrides: [], games: [], comparisons: [], ...partial }, "2026-09-29");

beforeEach(() => {
  vi.resetAllMocks(); mocks.access.mockResolvedValue({ access: access() }); mocks.from.mockReturnValue(query); query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.maybeSingle.mockResolvedValue({ data: athlete, error: null });
  mocks.performance.mockResolvedValue({ measurements: [], batches: [], percentileOverrides: [] }); mocks.games.mockResolvedValue([]); mocks.comparisons.mockResolvedValue([]); mocks.options.mockResolvedValue([]); mocks.leaderboard.mockResolvedValue([]); mocks.gameBoards.mockResolvedValue([]);
});

describe("graphics access boundary", () => {
  it("rechecks authorization and rejects signed-out, unlinked and peer-player reads before roster or result queries", async () => {
    for (const presented of [null, access(["player"]), access(["player"], peer), access(["player"], peer, { ...playerPreview, athleteId: peer })]) {
      mocks.access.mockResolvedValue({ access: presented });
      expect([401, 403]).toContain((await POST(request())).status);
    }
    expect(mocks.access).toHaveBeenCalledTimes(4); expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.performance).not.toHaveBeenCalled(); expect(mocks.games).not.toHaveBeenCalled();
  });
  it("allows linked own-player, Player View, staff, and Coach View reads without contacts or provenance", async () => {
    mocks.performance.mockResolvedValue({ measurements: [reading("Weight", 190, "lb")], batches: [], percentileOverrides: [] });
    for (const presented of [access(["player"], id), access(["player"], id, playerPreview), access(["admin"]), access(["coach"], null, { ...playerPreview, role: "coach", athleteId: null })]) {
      mocks.access.mockResolvedValue({ access: presented }); const response = await POST(request());
      expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("private, no-store"); expect(response.headers.get("vary")).toBe("Cookie");
      const json = await response.json(); expect(json.kind).toBe("player"); expect(json.data.player.name).toBe("Fictional Boxer"); expect(json.data.metrics[0].formatted).toBe("190 lb");
      expect(JSON.stringify(json)).not.toMatch(/PRIVATE-|example\.com|file_hash|source_row|batch_id|pacific_email|profile_photo|renpho_id/);
    }
    expect(query.select).toHaveBeenCalledWith("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons(*)"); expect(mocks.games).toHaveBeenLastCalledWith(expect.anything(), id);
  });
  it("limits all team graphics to the effective staff role before any leaderboard query", async () => {
    for (const presented of [access(["player"]), access(["player"], id), access(["player"], id, playerPreview)]) {
      mocks.access.mockResolvedValue({ access: presented }); expect((await POST(request({ kind: "leaderboards" }))).status).toBe(403);
      await expect(loadGraphicsLeaderboards(presented)).rejects.toThrow("coaches and admins");
    }
    expect(mocks.options).not.toHaveBeenCalled(); expect(mocks.gameBoards).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("defends the lower reader and requires a current, matching roster identity", async () => {
    await expect(loadGraphicsPlayer(access(["player"], id, playerPreview), peer)).rejects.toThrow("linked player"); expect(mocks.from).not.toHaveBeenCalled();
    expect((await POST(request({ kind: "player", athleteId: "not-an-id" }))).status).toBe(400);
    for (const data of [null, { ...athlete, id: peer }, { ...athlete, athlete_seasons: [{ ...athlete.athlete_seasons[0], season: "2025-26" }] }]) {
      query.maybeSingle.mockResolvedValue({ data, error: null }); expect((await POST(request())).status).toBe(404);
    }
    expect(mocks.performance).not.toHaveBeenCalled(); expect(query.eq).toHaveBeenLastCalledWith("id", id);
  });
  it("rejects cross-origin, malformed, oversized and forged-content requests without querying data", async () => {
    for (const req of [request(undefined, { origin: "https://other.example.com" }), request(undefined, { "content-type": "text/plain" }), request({ kind: "player", athleteId: id, metrics: [] }), request({ kind: "leaderboards", athleteId: id }), request({ kind: "publish", url: "https://example.com" }), request("["), request("x".repeat(2050))]) {
      expect([400, 403, 413]).toContain((await POST(req)).status);
    }
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.options).not.toHaveBeenCalled();
  });
  it("returns a generic private failure rather than partial data or provider diagnostics", async () => {
    mocks.games.mockRejectedValue(new Error("PRIVATE-CREDENTIAL provider details")); const response = await POST(request());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("PRIVATE"); expect(response.headers.get("cache-control")).toContain("no-store");
  });
});

describe("graphics numerical projection", () => {
  it("fails closed when an internal reader mixes athlete identities", () => {
    expect(() => build({ measurements: [{ ...reading("Weight", 190, "lb"), athlete_code: "PAC-9998" }] })).toThrow("scope could not be verified");
    expect(() => build({ games: [{ ...game("pa", 5), athlete_id: peer }] })).toThrow("scope could not be verified");
  });
  it("keeps UI identity IDs and PAC codes out of the rendered share card", () => {
    const player = build({ measurements: [reading("Weight", 190, "lb")] });
    const card = buildGraphicsCard({ template: "player", player, second: null, metrics: player.metrics, board: null, topCount: 5, arsenalContext: "", trendKey: "", headline: "" });
    expect(card).not.toBeNull();
    const svg = renderGraphics(card!, { format: "portrait", theme: "black" });
    expect(svg).toContain("Fictional Boxer"); expect(svg).toContain("190 lb");
    expect(svg).not.toMatch(/PAC-9999|aaaaaaaa-aaaa|PRIVATE-|example\.com|file_hash|source_row|snapshot_id|batch_id/);
  });
  it("keeps source partitions, one-decimal bat speed, sample-gated ranks, actual dates and full precision", () => {
    const data = build({ measurements: [reading("Average Bat Speed", 66.666, "mph", "Full Swing · Intrasquad"), reading("Average Bat Speed", 70.444, "mph", "Full Swing · Practice"), reading("Height", 73, "in")], percentileOverrides: [{ athleteCode: "PAC-9999", metricKey: "avg_bat_speed", observedValue: 66.666, value: 80, source: "Full Swing · Intrasquad", unit: "mph", sampleSize: 3, direction: "higher", measuredAt: "2026-09-16", period: "fall_2026" }] });
    const speeds = data.metrics.filter(metric => metric.unit === "mph"); expect(speeds).toHaveLength(2); expect(new Set(speeds.map(metric => metric.key)).size).toBe(2);
    expect(speeds.find(metric => metric.source.includes("Intrasquad"))).toMatchObject({ value: 66.666, formatted: "66.7 mph", date: "2026-09-16", percentile: null });
    expect(data.metrics.find(metric => metric.label === "Height")).toMatchObject({ direction: "neutral", formatted: "6′ 1″" });
  });
  it("keeps pre-Fall body readings separate and excludes future readings without relabeling previous tests", () => {
    const data = build({ measurements: [reading("Weight", 180, "lb", "RENPHO", "2026-08-20"), reading("Weight", 200, "lb", "RENPHO", "2026-10-01"), reading("Average Bat Speed", 60, "mph", "Full Swing · Practice", "2026-08-20")] });
    expect(data.metrics).toHaveLength(1); expect(data.metrics[0]).toMatchObject({ value: 180, context: "June–August 2026 · Latest profile result", date: "2026-08-20" });
  });
  it("applies pitcher-only role eligibility to hitting, games and timed tests", () => {
    const pitcher = { ...athlete, athlete_seasons: [{ ...athlete.athlete_seasons[0], primary_position: "P", secondary_position: null, player_type: "pitcher" }] };
    const data = build({ athlete: pitcher, measurements: [reading("Home to 1st", 4.1, "s", "Player Metrics"), reading("Average Bat Speed", 66, "mph", "Full Swing · Practice"), reading("Weight", 190, "lb")], games: [game("pa", 4), game("ab", 4), game("base_hit", 2)] });
    expect(data.metrics.map(metric => metric.label)).toEqual(["Weight"]); expect(data.trends).toEqual([]);
  });
  it("retains exact arsenal families and latest fallback dates without importing report identities", () => {
    const source = "Full Swing · Practice · Slider";
    const rows = [reading("Pitch Type Average Velocity", 80, "mph", source), reading("Pitch Type Velocity Readings", 10, "count", source), reading("Pitch Type Average Spin", 2100, "rpm", source), reading("Pitch Type Max Velocity", 84, "mph", source),
      reading("Pitch Type Average Velocity", 90, "mph", source, "2026-09-25", "b".repeat(64)), reading("Pitch Type Velocity Readings", 30, "count", source, "2026-09-25", "b".repeat(64)), reading("Pitch Type Average Spin", 2200, "rpm", source, "2026-09-25", "b".repeat(64))];
    const pitch = build({ measurements: rows }).arsenals[0];
    expect(pitch).toMatchObject({ averageVelocity: 87.5, velocityCount: 40, velocityBasis: "fall", velocityFirstDate: "2026-09-16", averageSpin: 2200, spinCount: null, spinBasis: "latest", spinFirstDate: "2026-09-25", maxVelocity: 84, maxVelocityDate: "2026-09-16" });
    expect(pitch.basis).toContain("latest verified average"); expect(JSON.stringify(pitch)).not.toMatch(/PRIVATE-|file_hash|source_row/);
  });
  it("preserves Blast weighted averages, signed neutral angles and separate latest weekly P95", () => {
    const rows = [reading("Blast Swing Count", 10, "count", "Blast Motion · Average · 2026-09-13:2026-09-20", "2026-09-20"), reading("Average Bat Speed", 60, "mph", "Blast Motion · Average · 2026-09-13:2026-09-20", "2026-09-20"), reading("Vertical Bat Angle", -10, "deg", "Blast Motion · Average · 2026-09-13:2026-09-20", "2026-09-20"), reading("Blast Swing Count", 30, "count", "Blast Motion · Average · 2026-09-21:2026-09-26", "2026-09-26"), reading("Average Bat Speed", 80, "mph", "Blast Motion · Average · 2026-09-21:2026-09-26", "2026-09-26"), reading("Vertical Bat Angle", -20, "deg", "Blast Motion · Average · 2026-09-21:2026-09-26", "2026-09-26"), reading("Blast Swing Count", 30, "count", "Blast Motion · P95 · 2026-09-21:2026-09-26", "2026-09-26"), reading("Peak Bat Speed (95th)", 90, "mph", "Blast Motion · P95 · 2026-09-21:2026-09-26", "2026-09-26")];
    const metrics = build({ measurements: rows }).metrics;
    expect(metrics.find(metric => metric.label === "Bat Speed (Practice)")).toMatchObject({ value: 75, formatted: "75.0 mph", sample: "40 swings · 2 reports", percentile: null });
    expect(metrics.find(metric => metric.label === "Vertical Bat Angle")).toMatchObject({ value: -17.5, direction: "neutral" });
    expect(metrics.find(metric => metric.label === "Peak Bat Speed (95th)")).toMatchObject({ value: 90, sample: "30 swings", context: "Latest weekly 95th percentile", date: "2026-09-21 to 2026-09-26" });
  });
  it("binds game percentiles to the snapshot and shows Pacific update dates and actual denominators", () => {
    const games = [game("pa", 5), game("ab", 4), game("base_hit", 2), game("pumps", 1), game("sac_fly", 1), game("bb", 0), game("hbp", 0), game("punchies", 0)];
    const metrics = build({ games, comparisons: [{ metric: "batting_avg", source: "qpa_fall_2026", eventId: "", value: .5, percentile: 90, sampleSize: 8, snapshotId: id }] }).metrics;
    expect(metrics.find(metric => metric.label === "AVG")).toMatchObject({ value: .5, formatted: ".500", percentile: null, date: "Updated 2026-09-19", sample: "4 AB" });
    expect(JSON.stringify(metrics)).not.toMatch(/snapshot_id|content_hash|source_column|source_row/);
    const refreshed = build({ games: games.map(row => ({ ...row, fetched_at: "2026-09-20T04:01:00Z" })) }).metrics;
    expect(refreshed.find(metric => metric.label === "AVG")?.key).not.toBe(metrics.find(metric => metric.label === "AVG")?.key);
  });
  it("includes only exact-source/unit/period trends and suppresses conflicting same-date series", () => {
    const data = build({ measurements: [reading("Weight", 180, "lb", "RENPHO", "2026-09-10"), reading("Weight", 190, "lb"), reading("Weight", 81, "kg", "RENPHO", "2026-09-12")] });
    expect(data.trends[0]).toMatchObject({ source: "RENPHO", unit: "lb", points: [{ date: "2026-09-10", value: 180 }, { date: "2026-09-16", value: 190 }] });
    const conflict = build({ measurements: [reading("Weight", 180, "lb", "RENPHO", "2026-09-10"), reading("Weight", 181, "lb", "RENPHO", "2026-09-10", "b".repeat(64)), reading("Weight", 190, "lb")] });
    expect(conflict.trends).toEqual([]);
  });
  it("returns names and original competition ranks for staff boards, without profile IDs or roster codes", async () => {
    mocks.options.mockResolvedValue([{ metricKey: "avg_bat_speed", source: "full swing · practice", unit: "mph", period: "fall_2026", athleteCount: 2 }]);
    mocks.leaderboard.mockResolvedValue([{ rank: 1, name: "Fictional One", athleteCode: "PAC-9998", profileId: peer, value: 70.444, measuredAt: "2026-09-16", source: "full swing · practice", derived: true, sampleCount: 20, sampleUnit: "swings", jerseyNumber: 1, position: "SS" }]);
    const response = await POST(request({ kind: "leaderboards" })); expect(response.status).toBe(200);
    const json = await response.json(); expect(json.boards[0].rows[0]).toEqual({ name: "Fictional One", rank: 1, value: 70.444, formatted: "70.4 mph", sample: "20 swings", date: "2026-09-16" });
    expect(JSON.stringify(json)).not.toMatch(/profileId|PAC-9998|bbbbbbbb|athleteCode|jerseyNumber/);
  });
  it("withholds a future-dated leaderboard as a whole rather than changing its ranks", async () => {
    mocks.options.mockResolvedValue([{ metricKey: "weight", source: "renpho", unit: "lb", period: "fall_2026", athleteCount: 2 }]);
    mocks.leaderboard.mockResolvedValue([{ rank: 1, name: "Fictional One", value: 200, measuredAt: "2099-09-16" }, { rank: 2, name: "Fictional Two", value: 190, measuredAt: "2026-09-16" }]);
    expect(await loadGraphicsLeaderboards(access())).toEqual([]);
  });
});
