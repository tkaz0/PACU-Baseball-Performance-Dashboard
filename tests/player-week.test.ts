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
    const jump = biggestWeekJump(history, batting, { ...none, entries: 0 } as TeamGameSummary)!;
    expect(jump.metric.label).toBe("OPS");
    expect(jump.change.percent).toBeCloseTo(10);
  });
  it("renders the jump and seven-day Fall bests, and nothing when there is neither", () => {
    const html = renderToStaticMarkup(createElement(PlayerWeekDisplay, { trends: history, batting, pitching: { ...none, entries: 0 } as TeamGameSummary, bests: [{ athleteId: "fictional", playerName: null, metric: "max_exit_velocity", label: "Max Exit Velocity", unit: "mph", source: "Full Swing · Practice", value: 101.2, previous: 99.5, measuredAt: "2026-10-10", addedAt: "2026-10-11T00:00:00Z" }] }));
    expect(html).toContain("Biggest jump · OPS"); expect(html).toContain("10.0%"); expect(html).toContain("Max Exit Velocity"); expect(html).toContain("101.2");
    expect(renderToStaticMarkup(createElement(PlayerWeekDisplay, { trends: {} as TeamGameTrends, batting: none, pitching: none, bests: [] }))).toBe("");
  });
});
