import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LeaderboardAverage } from "@/components/leaderboard-average";
import { leaderboardAverage } from "@/lib/leaderboard-average";
describe("leaderboard mean reference", () => {
  it("uses the equal-player arithmetic mean rather than median", () => {
    expect(leaderboardAverage([91, 81, 82, 84])).toEqual({ mean: 84.5, count: 4 });
  });
  it("preserves measured zero, signed readings and full precision", () => {
    expect(leaderboardAverage([-15, 0, 21])).toEqual({ mean: 2, count: 3 });
    expect(leaderboardAverage([72.347, 71.221])!.mean).toBeCloseTo(71.784, 12);
  });
  it("omits only unrecorded nonfinite inputs, never fills them with zero", () => {
    expect(leaderboardAverage([])).toBeNull();
    expect(leaderboardAverage([NaN, Infinity])).toBeNull();
    expect(leaderboardAverage([NaN, 72, Infinity])).toEqual({ mean: 72, count: 1 });
  });
  it("keeps repeated players' values and valid small or identical groups", () => {
    expect(leaderboardAverage([3, 3, 3])).toEqual({ mean: 3, count: 3 });
    expect(leaderboardAverage([71])).toEqual({ mean: 71, count: 1 });
    expect(leaderboardAverage([1, 2, 2, 2, 3])).toEqual({ mean: 2, count: 5 });
  });
  it("does not mutate or round the ordered input results", () => {
    const values = Object.freeze([93.227, 89.726, 77.931]);
    const result = leaderboardAverage(values);
    expect(values).toEqual([93.227, 89.726, 77.931]);
    expect(result!.mean).toBeCloseTo(86.96133333333334, 12);
  });
});


describe("compact leaderboard average presentation", () => {
  it("replaces the chart with the mean player result and explains the game-rate basis", () => {
    const output = renderToStaticMarkup(createElement(LeaderboardAverage, { values: [.2, .6], format: value => value.toFixed(3), label: "AVG", game: true }));
    expect(output).toContain("Average Player");
    expect(output).toContain("0.400");
    expect(output).toContain("Mean of 2 player results");
    expect(output).toContain("not a team rate calculated from pooled opportunities or innings");
    expect(output).not.toContain("Team Spread");
    expect(output).not.toContain("Median");
    expect(output).not.toContain("<svg");
  });
  it("distinguishes player bests from an average of every original swing or pitch", () => {
    const output = renderToStaticMarkup(createElement(LeaderboardAverage, { values: [90, 80, 70], format: value => value.toFixed(1) + " mph", label: "Max Exit Velocity", basis: "best" }));
    expect(output).toContain("Team Average");
    expect(output).toContain("80.0 mph");
    expect(output).toContain("Mean of 3 player bests");
    expect(output).toContain("does not average individual pitches, swings or trials");
  });
});
