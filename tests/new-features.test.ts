import { describe, expect, it } from "vitest";
import { topPerformers } from "@/lib/top-performers";
import { recentPersonalBest } from "@/lib/personal-bests";
import { teamGameTrends } from "@/lib/game-trends";
import type { CoachingData } from "@/lib/coaching-tools";
import type { PlayerMetricCard } from "@/lib/player-performance";

// Fictional players and values only.
const player = (id: string, position: string, secondaryPosition = "") => ({ id, code: `SYN-${id}`, name: `Fictional ${id}`, academicClass: "Junior", position, secondaryPosition, playerType: position === "P" ? "pitcher" : "position", bats: "R", throws: "R" });
const game = (athleteId: string, metric: string, value: number, opportunities: number | null = null) => ({ athleteId, snapshotId: "s", metric, label: metric, source: metric.startsWith("pitching") ? "pitching_fall_2026" : "qpa_fall_2026", eventId: "", value, unit: "decimal", updatedAt: "2026-09-28", playedOn: null, opportunities, direction: "higher" as const, insightEligible: true });

describe("top performers", () => {
  const cumulativeGame = (id: string, metric: string, value: number) => ({ ...game(id, metric, value, 10), unit: metric === "batting_production_plus" ? "index" : metric.startsWith("batting") ? "avg" : "decimal", eventId: metric.startsWith("pitching") ? "fall-2026-cumulative" : "" });
  const data = { players: [player("1", "SS"), player("2", "SS"), {...player("3", "OF", "P"), playerType: "two_way"}, player("4", "P")], games: [cumulativeGame("1", "batting_production_plus", 90), cumulativeGame("2", "batting_production_plus", 140), cumulativeGame("3", "batting_production_plus", 140), cumulativeGame("1", "batting_obp", .6), cumulativeGame("2", "batting_obp", .5), cumulativeGame("4", "pitching_whip", 1.2), cumulativeGame("3", "pitching_whip", .8), cumulativeGame("4", "pitching_k_bb", 3), cumulativeGame("3", "pitching_k_bb", 2)] } as unknown as CoachingData;
  it("ranks the chosen cumulative stat, includes two-ways in both groups, and shares tied ranks", () => {
    expect(topPerformers(data, "hitting", "batting_production_plus").map(r => [r.player.id,r.rank])).toEqual([["2",1],["3",1],["1",3]]);
    expect(topPerformers(data, "hitting", "batting_obp").map(r => [r.player.id,r.rank])).toEqual([["1",1],["2",2],["3",null]]);
    expect(topPerformers(data, "pitching", "pitching_whip").map(r => r.player.id)).toEqual(["3","4"]);
    expect(topPerformers(data, "pitching", "pitching_k_bb").map(r => r.player.id)).toEqual(["4","3"]);
  });
  it("never ranks a raw weekly period, wrong source, duplicate stat or missing result", () => {
    const wrong = { ...cumulativeGame("1", "pitching_whip", 0), athleteId:"4", eventId:"fall-2026-week-1" };
    const rows = topPerformers({ ...data, games: [wrong, {...cumulativeGame("1", "batting_obp", .9),source:"pitching_fall_2026"}, cumulativeGame("2", "batting_obp", .5), cumulativeGame("2", "batting_obp", .4)] } as unknown as CoachingData,"hitting","batting_obp");
    expect(rows).toEqual([]);
    expect(topPerformers({ ...data,games:[wrong] } as unknown as CoachingData,"pitching","pitching_whip")).toEqual([]);
  });
});

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
