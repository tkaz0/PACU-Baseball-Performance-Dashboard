import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { teamGameSummary } from "@/lib/team-game-stats";
import { TeamGameStats } from "@/components/team-game-stats";
import type { SharedGameStat } from "@/lib/game-server";

const counts = { pa: 5, ab: 4, base_hit: 1, bb: 1, hbp: 0, sac_fly: 0, sac_bunt: 0, punchies: 1, pumps: 0, hh_base_hit: 1, three_eight_hh: 0, hh_extra_base_hit: 0, qpa: 2, rbi: 0, sb: 0, gdp: 0 };
const rows = (id: string, v: Record<string, number>, pitch = false, event = "game-1"): SharedGameStat[] => Object.entries(v).map(([metric, value]) => ({ source: pitch ? "pitching_fall_2026" : "qpa_fall_2026", athlete_id: id, metric, value, unit: "count", scope: pitch ? "pitching_event" : "cumulative_fall", event_id: pitch ? event : null, played_on: pitch ? "2026-09-12" : null, source_row: 2, source_column: 2, derived_from: [], snapshot_id: "fictional-snapshot", fetched_at: "2026-09-13T01:00:00Z", content_hash: "a".repeat(64) }));
const metric = (stats: SharedGameStat[], key: string) => teamGameSummary(stats, "qpa_fall_2026").rates.find(r => r.metric === key)!;

it("reconciles team totals and weights rates by their exact opportunities", () => {
  const stats = [...rows("fictional-a", counts), ...rows("fictional-b", { ...counts, pa: 25, ab: 20, base_hit: 10, bb: 4, hbp: 0, sac_fly: 1, qpa: 15, punchies: 2, pumps: 2, hh_base_hit: 4 })];
  const team = teamGameSummary(stats, "qpa_fall_2026");
  expect(team.players).toBe(2); expect(team.counts.find(m => m.metric === "pa")?.value).toBe(30);
  expect(metric(stats, "batting_avg")).toMatchObject({ value: 11 / 24, opportunities: 24, pending: false });
  expect(metric(stats, "batting_obp").value).toBe(16 / 30);
  expect(metric(stats, "qpa_pct").value).toBeCloseTo(17 / 30 * 100);
  expect(metric(stats, "batting_hh_pct").value).toBeCloseTo(7 / 21 * 100);
  expect(metric(stats, "batting_hr_pct").value).toBeCloseTo(2 / 30 * 100);
  expect(metric(stats, "batting_avg").value).not.toBe((.25 + .5) / 2);
});
it("withholds OBP for an inconsistent player even when aggregate PA could mask it", () => {
  const stats = [...rows("fictional-a", { ...counts, pa: 4 }), ...rows("fictional-b", { ...counts, pa: 20 })];
  expect(metric(stats, "batting_obp")).toMatchObject({ value: null, pending: true });
  expect(metric(stats, "batting_avg").value).toBe(.25);
});
it("preserves missing counts instead of treating them as zero or silently dropping players", () => {
  const missing = rows("fictional-b", counts).filter(r => !["sb", "bb"].includes(r.metric));
  const stats = [...rows("fictional-a", counts), ...missing];
  expect(teamGameSummary(stats, "qpa_fall_2026").counts.find(m => m.metric === "sb")).toMatchObject({ value: null, pending: true });
  expect(metric(stats, "batting_bb_pct")).toMatchObject({ value: null, pending: true });
  expect(metric(stats, "batting_avg").value).toBe(.25);
});
it("accepts recorded zero opportunities but never divides by zero", () => {
  const zero = rows("fictional-b", Object.fromEntries(Object.keys(counts).map(k => [k, 0])));
  expect(metric(zero, "batting_avg")).toMatchObject({ value: null, pending: false });
  expect(metric([...rows("fictional-a", counts), ...zero], "batting_avg").value).toBe(.25);
  expect(teamGameSummary([], "qpa_fall_2026").counts.every(m => m.value === null && !m.pending)).toBe(true);
});
it("rejects mixed snapshots, duplicates and invalid player-level ratios", () => {
  for (const stats of [
    [...rows("fictional-a", counts), ...rows("fictional-b", counts).map(r => ({ ...r, snapshot_id: "older" }))],
    [...rows("fictional-a", counts), rows("fictional-a", counts)[0]],
  ]) expect(teamGameSummary(stats, "qpa_fall_2026").rates.every(m => m.value === null && m.pending)).toBe(true);
  expect(metric(rows("fictional-a", { ...counts, pumps: 2 }), "batting_hr_pct").pending).toBe(true);
});
it("combines pitching appearances without averaging strike percentages or mixing batting walks", () => {
  const stats = [...rows("fictional-a", { pitches: 10, strikes: 8, k: 1, bb_outcome: 0, bb_pitch_family: 4 }, true), ...rows("fictional-a", { pitches: 90, strikes: 45, k: 3, bb_outcome: 2 }, true, "game-2"), ...rows("fictional-b", { pitches: 20, strikes: 10, k: 2, bb_outcome: 1 }, true), ...rows("fictional-a", counts)];
  const team = teamGameSummary(stats, "pitching_fall_2026");
  expect(team).toMatchObject({ players: 2, entries: 3, games: 2 });
  expect(team.rates[0]).toMatchObject({ value: 63 / 120 * 100, opportunities: 120 });
  expect(team.counts.find(m => m.metric === "bb_outcome")?.value).toBe(3);
  expect(team.counts.find(m => m.metric === "h")?.value).toBeNull();
});
it("renders the coach summary, linked player breakdown, empty pitching and review state", () => {
  const html = renderToStaticMarkup(createElement(TeamGameStats, { stats: rows("fictional-a", { ...counts, pa: 4 }), names: new Map([["fictional-a", "Example Player"]]) }));
  for (const text of ["Team Batting", "Team Pitching", "Player Breakdown", "No pitching stats yet", "Counts need review", "/athletes/fictional-a", "Open Data Review"]) expect(html).toContain(text);
  expect(html).not.toContain('role="meter"'); expect(html).not.toContain("Game Log");
});

it("weights SB/PA by team PA and preserves more than one steal per appearance",()=>{
 const stats=[...rows("fictional-a",{...counts,pa:1,sb:2}),...rows("fictional-b",{...counts,pa:19,sb:1})];
 expect(metric(stats,"batting_sb_per_pa")).toMatchObject({value:.15,opportunities:20,pending:false});
});
