import { describe, expect, it } from "vitest";
import { rankingSpread } from "@/lib/ranking-spread";
describe("team ranking distribution", () => {
  it("shows the observed range and unweighted median of player results", () => {
    const result = rankingSpread([91, 81, 82, 84]);
    expect(result).toMatchObject({ min: 81, max: 91, median: 83, count: 4, medianFraction: .2 });
    expect(result!.dots[0].fraction).toBe(0);
    expect(result!.dots.at(-1)!.fraction).toBe(1);
  });
  it("keeps measured zero and signed readings instead of inventing a zero floor", () => {
    const result = rankingSpread([-15, 0, 20]);
    expect(result).toMatchObject({ min: -15, max: 20, median: 0, count: 3 });
  });
  it("does not display a spurious distribution with too few or identical values", () => {
    expect(rankingSpread([1, 2])).toBeNull();
    expect(rankingSpread([3, 3, 3])).toBeNull();
    expect(rankingSpread([1, Infinity, NaN, 2])).toBeNull();
  });
  it("preserves dense groups with proportional areas and explicit player counts", () => {
    const result = rankingSpread([1, ...Array(20).fill(2), 3]);
    expect(result!.count).toBe(22);
    expect(result!.dots.reduce((sum, dot) => sum + dot.count, 0)).toBe(22);
    expect(result!.dots.find(dot => dot.count === 20)).toBeDefined();
    expect(result!.dots.every(dot => dot.radius > 0 && dot.radius <= 13 && dot.fraction >= 0 && dot.fraction <= 1)).toBe(true);
    expect(result!.dots[1].radius ** 2 / result!.dots[0].radius ** 2).toBeCloseTo(20);
  });
});
