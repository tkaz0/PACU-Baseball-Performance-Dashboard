import { expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ options: vi.fn(), games: vi.fn(), board: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/leaderboard-server", () => ({ loadLeaderboardComparisons: mock.options, loadLeaderboard: mock.board }));
vi.mock("@/lib/game-comparison-server", () => ({ loadGameLeaderboards: mock.games }));
import { loadHomeLeaderboards } from "@/lib/home-leaderboards-server";

it("does not request team rankings for an unlinked player", async () => {
  const access = { roles: ["player"], athleteId: null } as Parameters<typeof loadHomeLeaderboards>[0];
  expect(await loadHomeLeaderboards(access)).toEqual([]);
  expect(mock.options).not.toHaveBeenCalled();
  expect(mock.games).not.toHaveBeenCalled();
});
