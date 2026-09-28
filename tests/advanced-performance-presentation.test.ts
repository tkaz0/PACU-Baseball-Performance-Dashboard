import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { AdvancedGameCards } from "@/components/advanced-game-cards";
import { PlayerOverview } from "@/components/player-overview";
import { GameLeaderboard } from "@/components/game-leaderboard";
import { TeamGameStats } from "@/components/team-game-stats";
import { gameOverviewMetrics } from "@/lib/game-overview";
import type { SharedGameStat } from "@/lib/game-server";
import type { GameComparison, GameLeaderboardRow } from "@/lib/game-metrics";

// Fictional values only; no source captures or roster identities are fixtures.
const counts = (values: Record<string, number>, pitching = false): SharedGameStat[] => Object.entries(values).map(([metric, value]) => ({
  source: pitching ? "pitching_fall_2026" : "qpa_fall_2026", athlete_id: "fictional-player", metric, value, unit: "count",
  scope: pitching ? "pitching_event" : "cumulative_fall", event_id: pitching ? "fall-2026-week-1" : null, played_on: null,
  source_row: 2, source_column: 2, derived_from: [], snapshot_id: "fictional-snapshot", fetched_at: "2026-09-28T01:00:00Z", content_hash: "a".repeat(64),
}));
const batting = counts({ pa: 30, ab: 24, base_hit: 8, hh_extra_base_hit: 2, pumps: 1, bb: 4, hbp: 1, sac_fly: 1, punchies: 5, sac_bunt: 0, qpa_pct: 60 });
const pitching = counts({ innings_outs: 18, k: 7, bb_outcome: 2, h: 4, r: 2, pitches: 88, strikes: 57 }, true);
const production: GameComparison = { source: "qpa_fall_2026", metric: "batting_production_plus", eventId: "", snapshotId: "fictional-snapshot", value: 120, percentile: 80, sampleSize: 8 };

it("puts verified advanced cards before overview insights without repeating them in the lower game bars", () => {
  const html = renderToStaticMarkup(createElement(PlayerOverview, { cards: [], gameStats: [...batting, ...pitching], gameComparisons: [production], twoWay: true }));
  expect(html.indexOf('aria-label="Advanced performance"')).toBeLessThan(html.indexOf('aria-label="Strengths"'));
  expect(html).toContain('aria-label="Advanced hitting performance"');
  expect(html).toContain('aria-label="Advanced pitching performance"');
  for (const key of ["batting_production_plus", "batting_est_slg", "batting_est_iso", "batting_est_wobacon", "pitching_k_bb", "pitching_k9", "pitching_bb9", "pitching_whip"]) {
    expect(html.split(`data-advanced-metric="${key}"`)).toHaveLength(2);
    expect(html).not.toContain(`data-overview-game-metric="${key}"`);
  }
  expect(html).toContain('aria-valuenow="80"');
  expect(html).toContain("30 PA");
  expect(html).toContain("6.0 IP");
  expect(html).toContain("2 walks");
  expect(html).toContain("not wRC+");
  expect(html).toContain("do not remove luck");
});

it("does not invent an advanced card, finite K/BB or percentile when its basis is unavailable", () => {
  expect(renderToStaticMarkup(createElement(AdvancedGameCards, { metrics: [] }))).toBe("");
  const zeroWalks = pitching.map(row => row.metric === "bb_outcome" ? { ...row, value: 0 } : row);
  const html = renderToStaticMarkup(createElement(AdvancedGameCards, { metrics: gameOverviewMetrics(zeroWalks, []) }));
  expect(html).not.toContain('data-advanced-metric="pitching_k_bb"');
  expect(html).toContain('data-advanced-metric="pitching_whip"');
  expect(html).not.toContain('role="meter"');
  expect(html).not.toContain("Infinity");
  const stale = renderToStaticMarkup(createElement(AdvancedGameCards, { metrics: gameOverviewMetrics(batting, [{ ...production, snapshotId: "stale" }]) }));
  expect(stale).not.toContain('data-advanced-metric="batting_production_plus"');
  expect(stale).not.toContain('role="meter"');
});

it("places advanced rankings before classic stats and preserves samples and player-safe links", () => {
  const row = (metric: string, source = "qpa_fall_2026"): GameLeaderboardRow => ({ source, metric, eventId: source === "qpa_fall_2026" ? "" : "fall-2026-cumulative", playedOn: null, value: 1.2, unit: "decimal", opportunities: 30, rank: 1, code: "SYN-0001", name: "Fictional Player", profileId: null, updatedAt: "2026-09-28T01:00:00Z", sampleSize: 8, percentile: 80 });
  const html = renderToStaticMarkup(createElement(GameLeaderboard, { rows: [row("batting_avg"), { ...row("batting_production_plus"), unit: "index", value: 120 }, row("batting_est_slg")] }));
  expect(html.indexOf('aria-label="Advanced hitting rankings"')).toBeLessThan(html.indexOf('aria-label="More game rankings"'));
  expect(html.indexOf('>PAC Production+ (Est.)')).toBeLessThan(html.indexOf('>Est. SLG'));
  expect(html).toContain("30 PA");
  expect(html).not.toContain("/athletes/");
  expect(html).toContain("not luck-adjusted predictions");
  const pitch = renderToStaticMarkup(createElement(GameLeaderboard, { rows: [row("strike_pct", "pitching_fall_2026"), row("pitching_whip", "pitching_fall_2026"), row("pitching_k_bb", "pitching_fall_2026")], discipline: "pitching" }));
  expect(pitch.indexOf('>K/BB')).toBeLessThan(pitch.indexOf('>WHIP'));
  expect(pitch).toContain('aria-label="Advanced pitching rankings"');
});

it("shows pooled team power estimates in the main cards without fabricating a team Production+ index", () => {
  const html = renderToStaticMarkup(createElement(TeamGameStats, { stats: [...batting, ...pitching], names: new Map([["fictional-player", "Fictional Player"]]) }));
  const main = html.split("More Team Totals &amp; Rates")[0];
  expect(main).toContain("Advanced Hitting");
  for (const label of ["Est. SLG", "Est. ISO", "Est. wOBAcon"]) expect(main).toContain(label);
  expect(html).not.toContain("PAC Production+");
});
