import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { battingPowerRates } from "@/lib/advanced-game-stats";
import { battingRates } from "@/lib/batting-stats";
import { teamGameSummary } from "@/lib/team-game-stats";
import { gameOverviewMetrics } from "@/lib/game-overview";
import { gameOpportunities } from "@/lib/game-opportunities";
import { qpaAnalytics } from "@/lib/game-analytics";
import { analyticsVariables } from "@/lib/analytics";
import { teamGameTrends } from "@/lib/game-trends";
import { statBenchmark } from "@/lib/stat-benchmarks";
import { STAT_DEFINITIONS } from "@/lib/stat-definitions";
import { TeamGameStats } from "@/components/team-game-stats";
import { AthleteGameStats } from "@/components/athlete-game-stats";
import type { SharedGameStat } from "@/lib/game-server";

// Fictional counts, never a production export.
const counts = { pa: 14, ab: 10, base_hit: 4, hh_extra_base_hit: 1, pumps: 1, bb: 2, hbp: 1, sac_fly: 1, punchies: 2 };
const rows = (values: Record<string, number> = counts, id = "fictional-a"): SharedGameStat[] => Object.entries(values).map(([metric, value]) => ({ source: "qpa_fall_2026", athlete_id: id, metric, value, unit: "count", scope: "cumulative_fall", event_id: null, played_on: null, source_row: 2, source_column: 0, derived_from: [], snapshot_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", fetched_at: "2026-10-12T16:00:00Z", content_hash: "a".repeat(64) }));
const ops = (data: SharedGameStat[]) => battingPowerRates(data).find(r => r.metric === "batting_ops");

it("adds unrounded OBP and SLG using the dashboard's existing base weights", () => {
  const data = rows(), obp = battingRates(data).find(r => r.metric === "batting_obp")!, slg = battingPowerRates(data).find(r => r.metric === "batting_est_slg")!;
  expect(ops(data)).toMatchObject({ label: "OPS", unit: "avg", value: obp.value + slg.value, opportunities: 14, opportunityLabel: "OBP opportunities" });
  expect(ops(data)!.value).toBeCloseTo(7 / 14 + 8 / 10);
  expect(gameOpportunities(data, "qpa_fall_2026", "batting_ops")).toBe(14);
});
it("supports OPS above one and a legitimate zero, without a missing-count fallback", () => {
  expect(ops(rows({ ...counts, ab: 1, pa: 1, base_hit: 1, hh_extra_base_hit: 0, pumps: 1, bb: 0, hbp: 0, sac_fly: 0, punchies: 0 }))!.value).toBe(5);
  expect(ops(rows({ ...counts, base_hit: 0, hh_extra_base_hit: 0, pumps: 0, bb: 0, hbp: 0 }))!.value).toBe(0);
  for (const key of ["hh_extra_base_hit", "bb", "hbp", "sac_fly"]) {
    const missing = { ...counts } as Record<string, number>; delete missing[key];
    expect(ops(rows(missing))).toBeUndefined();
  }
  expect(ops(rows({ ...counts, pa: 10 }))).toBeUndefined();
  expect(ops(rows({ ...counts, hh_extra_base_hit: 5 }))).toBeUndefined();
  expect(ops(rows({ ...counts, ab: 0, base_hit: 0, hh_extra_base_hit: 0, pumps: 0 }))).toBeUndefined();
  expect(ops([...rows(), ...rows(counts, "fictional-b")])).toBeUndefined();
});
it("pools the team's OBP and SLG denominators separately instead of averaging players' OPS", () => {
  const data = [...rows(), ...rows({ ...counts, pa: 28, ab: 20, base_hit: 2, hh_extra_base_hit: 0, pumps: 0, bb: 7, hbp: 0, sac_fly: 1 }, "fictional-b")];
  const team = teamGameSummary(data, "qpa_fall_2026"), get = (key: string) => team.rates.find(r => r.metric === key)!;
  expect(get("batting_ops").value).toBe(get("batting_obp").value! + get("batting_est_slg").value!);
  expect(get("batting_ops").value).toBeCloseTo(16 / 42 + 10 / 30);
  const incomplete = rows(counts, "fictional-b").filter(r => r.metric !== "bb");
  expect(teamGameSummary([...rows(), ...incomplete], "qpa_fall_2026").rates.find(r => r.metric === "batting_ops")).toMatchObject({ value: null, pending: true, pendingReason: "missing" });
});
it("carries OPS through profiles, team cards, analytics and saved trend rebuilding", () => {
  const data = rows(), comparison = { metric: "batting_ops", source: "qpa_fall_2026", eventId: "", value: ops(data)!.value, percentile: 80, sampleSize: 8, snapshotId: data[0].snapshot_id };
  expect(gameOverviewMetrics(data, [comparison]).find(r => r.metric === "batting_ops")).toMatchObject({ direction: "higher", insightEligible: true, comparison });
  expect(analyticsVariables(qpaAnalytics(data)).some(r => r.label === "OPS (In Game)")).toBe(true);
  for (const html of [renderToStaticMarkup(createElement(TeamGameStats, { stats: data, names: new Map() })), renderToStaticMarkup(createElement(AthleteGameStats, { stats: data }))]) expect(html).toContain("OPS");
  const observations = data.map(r => ({ athleteCode: "SYN-001", metric: r.metric, value: r.value, unit: r.unit, scope: r.scope }));
  expect(teamGameTrends([{ id: "fictional-snapshot", source: "qpa_fall_2026", fetched_at: data[0].fetched_at, observations }]).qpa_fall_2026?.batting_ops?.[0].value).toBe(ops(data)!.value);
  for (const scope of ["team", "player"] as const) expect(statBenchmark("batting_ops", { scope })?.n).toBe(scope === "team" ? 90 : 699);
  expect(STAT_DEFINITIONS.batting_ops).toContain("combined doubles/triples as doubles");
});
