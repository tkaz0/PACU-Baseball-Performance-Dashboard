import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ options: vi.fn(), games: vi.fn(), board: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/leaderboard-server", () => ({ loadLeaderboardComparisons: mock.options, loadLeaderboard: mock.board }));
vi.mock("@/lib/game-comparison-server", () => ({ loadGameLeaderboards: mock.games }));
import { loadHomeLeaderboards } from "@/lib/home-leaderboards-server";
import type { GameLeaderboardRow } from "@/lib/game-metrics";

beforeEach(() => { vi.clearAllMocks(); mock.options.mockResolvedValue([]); mock.games.mockResolvedValue([]); mock.board.mockResolvedValue([]); });

const row = (metric: string, pitching = false): GameLeaderboardRow => ({ metric, source: pitching ? "pitching_fall_2026" : "qpa_fall_2026", eventId: pitching ? "fall-2026-cumulative" : "", playedOn: null, rank: 1, code: "SYN-0001", name: "Fictional Player", profileId: null, value: 1, unit: "decimal", updatedAt: "2026-09-28T01:00:00Z", sampleSize: 8, percentile: 80, opportunities: 30 });

it("does not request team rankings for an unlinked player", async () => {
  const access = { roles: ["player"], athleteId: null } as Parameters<typeof loadHomeLeaderboards>[0];
  expect(await loadHomeLeaderboards(access)).toEqual([]);
  expect(mock.options).not.toHaveBeenCalled();
  expect(mock.games).not.toHaveBeenCalled();
});

it("features advanced game leaders through the existing narrow readers without fetching peer profiles", async () => {
  mock.games.mockResolvedValue([row("batting_avg"), row("batting_production_plus"), row("strike_pct", true), row("pitching_k_bb", true)]);
  const access = { roles: ["player"], athleteId: "fictional-player" } as Parameters<typeof loadHomeLeaderboards>[0];
  const boards = await loadHomeLeaderboards(access);
  expect(boards.map(board => board.metric)).toEqual(["batting_production_plus", "pitching_k_bb"]);
  expect(boards.every(board => board.rows.every(player => player.profileId === null))).toBe(true);
  expect(mock.games).toHaveBeenCalledTimes(1);
  expect(mock.options).toHaveBeenCalledTimes(1);
  expect(mock.board).not.toHaveBeenCalled();
});

it("keeps useful classic leaders when an advanced result is unavailable", async () => {
  mock.games.mockResolvedValue([row("batting_avg"), row("strike_pct", true)]);
  const access = { roles: ["coach"], athleteId: null } as Parameters<typeof loadHomeLeaderboards>[0];
  expect((await loadHomeLeaderboards(access)).map(board => board.metric)).toEqual(["batting_avg", "strike_pct"]);
});
