import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { homeGameBoard, homeMeasurementBoard } from "@/lib/home-leaderboards";
import type { GameLeaderboardRow } from "@/lib/game-metrics";
import type { LeaderboardComparison, LeaderboardRow } from "@/lib/leaderboards";

const comparison: LeaderboardComparison = { metricKey: "body_score", source: "renpho", unit: "points", period: "fall_2026", athleteCount: 2 };
const measurement = (rank: number, profileId: string | null): LeaderboardRow => ({ rank, athleteCode: `PAC-000${rank}`, name: `Fictional Player ${rank}`, jerseyNumber: rank, position: "OF", profileId, value: 90 - rank, measuredAt: "2026-09-10", source: "renpho", derived: false });
const game = (metric: string, eventId: string, rank: number, profileId: string | null): GameLeaderboardRow => ({ metric, source: "qpa_fall_2026", eventId, playedOn: null, value: .3, unit: "avg", rank, name: `Fictional Player ${rank}`, code: `PAC-000${rank}`, profileId, updatedAt: "2026-09-10T00:00:00Z", percentile: null, sampleSize: 2 });

describe("home leaderboard cards", () => {
  it("keeps the full ranking expandable and marks only the presented player's row", () => {
    const board = homeMeasurementBoard("body", "Physicality", "Body Score", "/leaderboards?group=physicality", [measurement(1, null), measurement(2, "own-id")], comparison, "own-id");
    expect(board.rows).toHaveLength(2);
    expect(board.rows.map(row => row.isYou)).toEqual([false, true]);
    expect(board.yourRank).toBe(2);
    expect(board.rows[0].profileId).toBeNull();
  });
  it("selects only the reviewed cumulative game metric and formats AVG", () => {
    const board = homeGameBoard("avg", "Hitting · In Game", "Batting AVG", "/leaderboards?group=games", [game("batting_obp", "", 1, null), game("batting_avg", "other-week", 1, null), game("batting_avg", "", 2, "own-id"), game("batting_avg", "", 1, null)], "qpa_fall_2026", "", "batting_avg", "own-id");
    expect(board.rows.map(row => row.rank)).toEqual([1, 2]);
    expect(board.rows[1].value).toBe(".300");
    expect(board.yourRank).toBe(2);
  });
  it("formats featured practice bat speed with the same one-decimal rule", () => {
    const bat = { ...comparison, metricKey: "avg_bat_speed" as const, source: "blast motion · hitting", unit: "mph" };
    const board = homeMeasurementBoard("bat", "Hitting · Practice", "Average Bat Speed", "/leaderboards?group=hitting&session=practice", [{ ...measurement(1, null), value: 72.347, source: bat.source }], bat, null);
    expect(board.rows[0].value).toBe("72.3 mph");
    expect(board.rows[0].numericValue).toBe(72.347);
  });
  it("keeps recorded sample counts beside home values without inventing missing counts", () => {
    const bat = { ...comparison, metricKey: "avg_bat_speed" as const, source: "blast motion · hitting", unit: "mph" };
    const board = homeMeasurementBoard("bat", "Hitting · Practice", "Average Bat Speed", "/leaderboards", [
      { ...measurement(1, null), sampleCount: 44, sampleUnit: "swings" }, measurement(2, null),
    ], bat, null);
    expect(board.rows[0].sample).toBe("44 swings");
    expect(board.rows[1].sample).toBeUndefined();
  });
  it("uses batting opportunities rather than comparison-cohort size for home sample captions", () => {
    const board = homeGameBoard("avg", "Hitting · In Game", "Batting AVG", "/leaderboards", [
      { ...game("batting_avg", "", 1, null), opportunities: 17, sampleSize: 26 }, game("batting_avg", "", 2, null),
    ], "qpa_fall_2026", "", "batting_avg", null);
    expect(board.rows[0].sample).toBe("17 AB");
    expect(board.rows[1].sample).toBeUndefined();
  });

  it("labels advanced samples with their actual PA, contact, walk or innings basis", () => {
    for (const [metric, source, count, expected] of [
      ["batting_production_plus", "qpa_fall_2026", 30, "30 PA"],
      ["batting_est_wobacon", "qpa_fall_2026", 23, "23 contacts"],
      ["pitching_k_bb", "pitching_fall_2026", 4, "4 walks"],
      ["pitching_whip", "pitching_fall_2026", 20, "6.2 IP"],
    ] as const) {
      const eventId = source === "qpa_fall_2026" ? "" : "fall-2026-cumulative";
      const board = homeGameBoard("advanced", "Advanced", "Advanced", "/leaderboards", [{ ...game(metric, eventId, 1, null), source, opportunities: count }], source, eventId, metric, null);
      expect(board.rows[0].sample).toBe(expected);
    }
  });

});
