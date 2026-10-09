import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { battedBallProfile, battedBallType } from "@/lib/batted-ball-profile";
import { PercentileRankings } from "@/components/percentile-rankings";
import { PLAYER_METRICS, type PlayerMetricCard } from "@/lib/player-performance";

// Fictional readings only.
describe("batted ball profile", () => {
  it("uses Statcast launch-angle ranges", () => {
    expect([-20, 9.9, 10, 24.9, 25, 50, 50.1].map(battedBallType)).toEqual(["ground", "ground", "line", "line", "fly", "fly", "popup"]);
  });
  it("finds the pull side from batting side and counts pulled air balls", () => {
    const rows = [{ launchAngle: 20, direction: -30 }, { launchAngle: 5, direction: -30 }, { launchAngle: 30, direction: 0 }, { launchAngle: 15, direction: 30 }, { launchAngle: 12, direction: null }];
    const right = battedBallProfile(rows, "R");
    expect(right.count).toBe(5); expect(right.directedCount).toBe(4);
    expect(right.zones.map(z => [z.label, z.count])).toEqual([["Pull", 2], ["Middle", 1], ["Opposite", 1]]);
    expect(right.airPull).toBe(1); expect(right.airPullPct).toBe(25);
    const left = battedBallProfile(rows, "L");
    expect(left.zones[0]).toMatchObject({ label: "Pull", count: 1 });
    const unknown = battedBallProfile(rows, "S");
    expect(unknown.airPullPct).toBeNull(); expect(unknown.zones.map(z => z.label)).toEqual(["Third-base side", "Middle", "First-base side"]);
  });
});

describe("percentile rankings panel", () => {
  const metric = (key: string) => PLAYER_METRICS.find(m => m.key === key)!;
  const card = (key: string, value: number, percentile: number, sampleSize = 8): PlayerMetricCard => ({
    metric: metric(key), latest: { id: key, athleteCode: "SYN-001", metricKey: metric(key).key, value, unit: metric(key).units[0], measuredAt: "2026-09-20", period: "fall_2026", source: "Full Swing · Intrasquad", importedAt: "2026-09-21T00:00:00Z", provenance: [], derived: false },
    summerBaseline: null, history: [], percentile: { value: percentile, sampleSize, period: "fall_2026", unit: metric(key).units[0], direction: metric(key).direction }, cohortSampleSize: sampleSize, percentileStatus: "available",
  });
  it("lists only directional results with at least five comparable players", () => {
    const html = renderToStaticMarkup(createElement(PercentileRankings, { cards: [card("max_exit_velocity", 101.2, 89), card("avg_bat_speed", 64, 40, 4), card("weight", 190, 70)], games: [] }));
    expect(html).toContain("89th percentile"); expect(html).not.toContain("40th percentile"); expect(html).not.toContain("Weight");
  });
  it("renders nothing without eligible results", () => {
    expect(renderToStaticMarkup(createElement(PercentileRankings, { cards: [card("weight", 190, 70)], games: [] }))).toBe("");
  });
});
