import { describe, expect, it } from "vitest";
import { recentPersonalBest } from "@/lib/personal-bests";
import { teamGameTrends } from "@/lib/game-trends";
import type { PlayerMetricCard } from "@/lib/player-performance";

describe("personal bests", () => {
  const card = (values: [string, number][], direction: "higher" | "lower" | "neutral" = "higher") => {
    const readings = values.map(([measuredAt, value], i) => ({ id: String(i), athleteCode: "SYN-1", metricKey: "max_exit_velocity", value, unit: "mph", measuredAt, period: "fall_2026", source: "Full Swing · Practice", importedAt: measuredAt, provenance: [], derived: false }));
    return { metric: { key: "max_exit_velocity", label: "Max EV", group: "hitting", units: ["mph"], direction }, latest: readings.at(-1), history: readings.slice(0, -1).reverse(), percentile: null, cohortSampleSize: null } as unknown as PlayerMetricCard;
  };
  it("does not call a weaker same-day session a Fall best", () => {
    expect(recentPersonalBest(card([["2026-09-10",95],["2026-09-20",110],["2026-09-20",101]]),"2026-09-25")).toBeNull();
    expect(recentPersonalBest(card([["2026-09-10",95],["2026-09-20",101],["2026-09-20",110]]),"2026-09-25")).toEqual({previous:95});
  });
  it("flags a recent result that beats every earlier test", () => {
    expect(recentPersonalBest(card([["2026-09-10", 95], ["2026-09-20", 98]]), "2026-09-25")).toEqual({ previous: 95 });
    expect(recentPersonalBest(card([["2026-09-10", 99], ["2026-09-20", 98]]), "2026-09-25")).toBeNull();
    expect(recentPersonalBest(card([["2026-09-20", 98]]), "2026-09-25")).toBeNull();
    expect(recentPersonalBest(card([["2026-09-10", 95], ["2026-09-20", 98]]), "2026-11-25")).toBeNull();
    expect(recentPersonalBest(card([["2026-09-10", 95], ["2026-09-20", 98]], "neutral"), "2026-09-25")).toBeNull();
  });
});

describe("team game trends", () => {
  it("does not resurrect an earlier rate when the latest same-day source is pending or empty", () => {
    const rows=(hits:number)=>[["pa",10],["ab",8],["base_hit",hits],["bb",2],["hbp",0],["sac_fly",0]].map(([metric,value])=>({athleteCode:"SYN-1",metric,value,unit:"count",scope:"cumulative_fall"}));
    for(const observations of [[],rows(9)]){
      const trends=teamGameTrends([{id:"a",source:"qpa_fall_2026",fetched_at:"2026-09-10T20:00:00Z",observations:rows(2)},{id:"b",source:"qpa_fall_2026",fetched_at:"2026-09-10T23:00:00Z",observations}]);
      expect(trends.qpa_fall_2026?.batting_avg??[]).toEqual([]);
    }
  });
  it("groups syncs by their Pacific date even across UTC midnight", () => {
    const rows=(h:number)=>[["pa",10],["ab",8],["base_hit",h],["bb",2],["hbp",0],["sac_fly",0]].map(([metric,value])=>({athleteCode:"SYN-1",metric,value,unit:"count",scope:"cumulative_fall"}));
    const trends=teamGameTrends([{id:"a",source:"qpa_fall_2026",fetched_at:"2026-09-10T23:00:00Z",observations:rows(2)},{id:"b",source:"qpa_fall_2026",fetched_at:"2026-09-11T04:00:00Z",observations:rows(4)}]);
    expect(trends.qpa_fall_2026?.batting_avg).toEqual([{date:"2026-09-10",value:.5}]);
  });
  it("rebuilds team rates for each saved sheet version, one point per day", () => {
    const rows = (h: number) => [["pa", 10], ["ab", 8], ["base_hit", h], ["bb", 2], ["hbp", 0], ["sac_fly", 0]].map(([metric, value]) => ({ athleteCode: "SYN-1", metric, value, unit: "count", scope: "cumulative_fall", sourceRow: 2, sourceColumn: 1, derivedFrom: [] }));
    const trends = teamGameTrends([
      { id: "a", source: "qpa_fall_2026", fetched_at: "2026-09-10T20:00:00Z", observations: rows(2) },
      { id: "b", source: "qpa_fall_2026", fetched_at: "2026-09-12T20:00:00Z", observations: rows(3) },
      { id: "c", source: "qpa_fall_2026", fetched_at: "2026-09-12T23:00:00Z", observations: rows(4) },
    ]);
    const avg = trends.qpa_fall_2026?.batting_avg;
    expect(avg?.map(p => p.date)).toEqual(["2026-09-10", "2026-09-12"]);
    expect(avg?.[1].value).toBeCloseTo(0.5);
  });
});
