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
});
