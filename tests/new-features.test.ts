import { describe, expect, it } from "vitest";
import { buildDepthChart } from "@/lib/depth-chart";
import { recentPersonalBest } from "@/lib/personal-bests";
import { teamGameTrends } from "@/lib/game-trends";
import type { CoachingData } from "@/lib/coaching-tools";
import type { PlayerMetricCard } from "@/lib/player-performance";

// Fictional players and values only.
const player = (id: string, position: string, secondaryPosition = "") => ({ id, code: `SYN-${id}`, name: `Fictional ${id}`, academicClass: "Junior", position, secondaryPosition, playerType: position === "P" ? "pitcher" : "position", bats: "R", throws: "R" });
const game = (athleteId: string, metric: string, value: number, opportunities: number | null = null) => ({ athleteId, snapshotId: "s", metric, label: metric, source: metric.startsWith("pitching") ? "pitching_fall_2026" : "qpa_fall_2026", eventId: "", value, unit: "decimal", updatedAt: "2026-09-28", playedOn: null, opportunities, direction: "higher" as const, insightEligible: true });

describe("depth chart", () => {
  it("ranks secondary-position players together with primaries by PAC Production+", () => {
    const data = { players: [player("1", "SS"), player("2", "SS"), player("3", "2B", "SS"), player("4", "LF"), player("5", "P")], readings: [{ id: "r", athleteId: "1", metric: "max_exit_velocity", label: "Max EV", unit: "mph", source: "Full Swing · Practice", date: "2026-09-20", value: 99.24, importedAt: "2026-09-20T00:00:00Z" }],
      games: [game("1", "batting_production_plus", 90, 12), game("2", "batting_production_plus", 140, 15), game("5", "pitching_whip", 1.2, 30)] } as unknown as CoachingData;
    const chart = buildDepthChart(data);
    expect(chart.SS.map(p => [p.id, p.secondary])).toEqual([["2", false], ["1", false], ["3", true]]);
    const withSecondaryLeader = buildDepthChart({ ...data, games: [...data.games, game("3", "batting_production_plus", 200, 10)] });
    expect(withSecondaryLeader.SS.map(p => [p.id, p.secondary])).toEqual([["3", true], ["2", false], ["1", false]]);
    expect(chart.OF.map(p => p.id)).toEqual(["4"]);
    expect(chart.SS[1].stats.find(s => s.label === "Max EV")?.value).toBe("99.2 mph");
    expect(chart.P[0].stats[0]).toMatchObject({ label: "WHIP", sample: "30 outs" });
  });
});

describe("personal bests", () => {
  const card = (values: [string, number][], direction: "higher" | "lower" | "neutral" = "higher") => {
    const readings = values.map(([measuredAt, value], i) => ({ id: String(i), athleteCode: "SYN-1", metricKey: "max_exit_velocity", value, unit: "mph", measuredAt, period: "fall_2026", source: "Full Swing · Practice", importedAt: measuredAt, provenance: [], derived: false }));
    return { metric: { key: "max_exit_velocity", label: "Max EV", group: "hitting", units: ["mph"], direction }, latest: readings.at(-1), history: readings.slice(0, -1).reverse(), percentile: null, cohortSampleSize: null } as unknown as PlayerMetricCard;
  };
  it("flags a recent result that beats every earlier test", () => {
    expect(recentPersonalBest(card([["2026-09-10", 95], ["2026-09-20", 98]]), "2026-09-25")).toEqual({ previous: 95 });
    expect(recentPersonalBest(card([["2026-09-10", 99], ["2026-09-20", 98]]), "2026-09-25")).toBeNull();
    expect(recentPersonalBest(card([["2026-09-20", 98]]), "2026-09-25")).toBeNull();
    expect(recentPersonalBest(card([["2026-09-10", 95], ["2026-09-20", 98]]), "2026-11-25")).toBeNull();
    expect(recentPersonalBest(card([["2026-09-10", 95], ["2026-09-20", 98]], "neutral"), "2026-09-25")).toBeNull();
  });
});

describe("team game trends", () => {
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
