import { expect, it } from "vitest";
import { visibleLeaderboardComparisons, type LeaderboardComparison } from "@/lib/leaderboards";

const earlier: LeaderboardComparison = {
  metricKey: "avg_bat_speed", source: "blast motion · average · 2026-09-13:2026-09-20",
  unit: "mph", period: "fall_2026", athleteCount: 20,
};
const later = { ...earlier, source: "blast motion · average · 2026-09-21:2026-09-27" };

it("chooses the latest Blast week when the available cohorts and units are equal", () => {
  expect(visibleLeaderboardComparisons("hitting", [earlier, later], "practice")).toEqual([later]);
  expect(visibleLeaderboardComparisons("hitting", [later, earlier], "practice")).toEqual([later]);
});
it("preserves cohort priority and separate report kinds, units and contexts", () => {
  const smaller = { ...later, athleteCount: 19 };
  expect(visibleLeaderboardComparisons("hitting", [earlier, smaller], "practice")).toEqual([earlier]);
  const peak: LeaderboardComparison = { ...later, metricKey: "p95_bat_speed", source: "blast motion · p95 · 2026-09-21:2026-09-27" };
  const game: LeaderboardComparison = { ...later, source: "full swing · intrasquad", athleteCount: 99 };
  expect(visibleLeaderboardComparisons("hitting", [game, earlier, later, peak], "practice")).toEqual([later, peak]);
  expect(visibleLeaderboardComparisons("hitting", [game, earlier, later, peak], "in_game")).toEqual([game]);
});
