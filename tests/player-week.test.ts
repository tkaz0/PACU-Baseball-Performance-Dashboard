import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { biggestWeekJump } from "@/lib/player-week";
import { PlayerWeekDisplay } from "@/components/player-week";
import type { TeamGameSummary, TeamGameMetric } from "@/lib/team-game-stats";
import type { TeamGameTrends } from "@/lib/game-trends";

// Fictional numbers only.
const metric = (m: string, label: string, value: number, unit: TeamGameMetric["unit"] = "avg"): TeamGameMetric => ({ metric: m, label, value, unit, pending: false });
const summary = (rates: TeamGameMetric[], updatedAt: string | null): TeamGameSummary => ({ players: 1, entries: 1, games: 0, updatedAt, counts: [], rates } as unknown as TeamGameSummary);
const trends = (points: Record<string, { date: string; value: number }[]>): TeamGameTrends => ({ qpa_fall_2026: points, snapshotDates: { qpa_fall_2026: ["2026-09-29", "2026-10-12"] } } as unknown as TeamGameTrends);

describe("player Your Week", () => {
  const updated = "2026-10-12T19:00:00Z";
  const history = trends({ batting_ops: [{ date: "2026-09-29", value: .700 }, { date: "2026-10-12", value: .770 }], batting_obp: [{ date: "2026-09-29", value: .400 }, { date: "2026-10-12", value: .410 }], batting_k_pct: [{ date: "2026-09-29", value: 20 }, { date: "2026-10-12", value: 30 }] });
  const batting = summary([metric("batting_ops", "OPS", .770), metric("batting_obp", "OBP", .410), metric("batting_k_pct", "K%", 30, "%")], updated);
  const none = summary([], null);
  it("picks the largest improving own rate and ignores declines", () => {
    const jump = biggestWeekJump(history, batting, { ...none, entries: 0 } as TeamGameSummary, false)!;
    expect(jump.metric.label).toBe("OPS");
    expect(jump.change.percent).toBeCloseTo(10);
  });
  it("renders the jump and seven-day Fall bests, and nothing when there is neither", () => {
    const html = renderToStaticMarkup(createElement(PlayerWeekDisplay, { trends: history, batting, pitching: { ...none, entries: 0 } as TeamGameSummary, season: false, bests: [{ athleteId: "fictional", playerName: null, metric: "max_exit_velocity", label: "Max Exit Velocity", unit: "mph", source: "Full Swing · Practice", value: 101.2, previous: 99.5, measuredAt: "2026-10-10", addedAt: "2026-10-11T00:00:00Z" }] }));
    expect(html).toContain("Biggest jump · OPS"); expect(html).toContain("10.0%"); expect(html).toContain("Max Exit Velocity"); expect(html).toContain("101.2");
    expect(renderToStaticMarkup(createElement(PlayerWeekDisplay, { trends: {} as TeamGameTrends, batting: none, pitching: none, season: false, bests: [] }))).toBe("");
  });
  it("gives pitchers a card for a first result from zero and shows lower-is-better gains as a decrease", () => {
    const pitchTrends = { pitching_fall_2026: { pitching_k9: [{ date: "2026-09-29", value: 0 }, { date: "2026-10-12", value: 4.5 }], pitching_whip: [{ date: "2026-09-29", value: 2 }, { date: "2026-10-12", value: 1.5 }], pitching_bb9: [{ date: "2026-09-29", value: 0 }, { date: "2026-10-12", value: 3 }] }, snapshotDates: { pitching_fall_2026: ["2026-09-29", "2026-10-12"] } } as unknown as TeamGameTrends;
    const empty = { ...summary([], null), entries: 0 } as TeamGameSummary;
    const onlyNew = summary([metric("pitching_k9", "K/9", 4.5, "per9"), metric("pitching_bb9", "BB/9", 3, "per9")], updated);
    const first = biggestWeekJump(pitchTrends, empty, onlyNew, false)!;
    expect(first.metric.label).toBe("K/9"); expect(first.change.percent).toBeNull();
    expect(renderToStaticMarkup(createElement(PlayerWeekDisplay, { trends: pitchTrends, batting: empty, pitching: onlyNew, season: false, bests: null }))).toContain("Up from 0");
    const withWhip = summary([metric("pitching_k9", "K/9", 4.5, "per9"), metric("pitching_whip", "WHIP", 1.5, "ratio")], updated);
    expect(biggestWeekJump(pitchTrends, empty, withWhip, false)!.metric.label).toBe("WHIP");
    expect(renderToStaticMarkup(createElement(PlayerWeekDisplay, { trends: pitchTrends, batting: empty, pitching: withWhip, season: false, bests: null }))).toContain("↓ 25.0%");
  });
  it("in the season-final view compares final rates with the player's own totals through Week 1", () => {
    // Week 1 (Sep 12) save on Sep 20; Week 2 save on Sep 29; final save Nov 1.
    const season = { qpa_fall_2026: { batting_ops: [{ date: "2026-09-20", value: .600 }, { date: "2026-09-29", value: .700 }, { date: "2026-11-01", value: .750 }] }, snapshotDates: { qpa_fall_2026: ["2026-09-20", "2026-09-29", "2026-11-01"] } } as unknown as TeamGameTrends;
    const final = summary([metric("batting_ops", "OPS", .750)], "2026-11-01T19:00:00Z");
    const jump = biggestWeekJump(season, final, { ...none, entries: 0 } as TeamGameSummary, true)!;
    expect(jump.change.previousValue).toBe(.6); expect(jump.change.percent).toBeCloseTo(25); expect(jump.since).toBe("Week 1 · Sep 12");
    const html = renderToStaticMarkup(createElement(PlayerWeekDisplay, { trends: season, batting: final, pitching: { ...none, entries: 0 } as TeamGameSummary, bests: null, season: true }));
    expect(html).toContain("Your Fall"); expect(html).toContain("since Week 1 · Sep 12");
  });
});
