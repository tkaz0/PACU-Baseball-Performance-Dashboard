import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { TeamGameTrendDisplay } from "@/components/team-game-trend";
import { teamGameTrends, type TeamGameTrends } from "@/lib/game-trends";
import type { TeamGameMetric } from "@/lib/team-game-stats";
import { teamWeekChange } from "@/lib/team-week-change";

const source = "qpa_fall_2026" as const;
const metric = (value: number | null = .33, key = "batting_avg"): TeamGameMetric => ({ metric: key, label: "AVG", value, unit: "avg", pending: false });
const history = (key = "batting_avg", before = .3, now = .33): TeamGameTrends => ({
  snapshotDates: { [source]: ["2026-10-05", "2026-10-09", "2026-10-12"] },
  [source]: { [key]: [{ date: "2026-10-05", value: .2 }, { date: "2026-10-09", value: before }, { date: "2026-10-12", value: now }] },
});
const at = "2026-10-12T16:00:00Z";

it("compares against the final saved rate of the previous Monday–Sunday Pacific week", () => {
  const change = teamWeekChange(history(), source, metric(), at)!;
  expect(change.previousDate).toBe("2026-10-09");
  expect(change.currentDate).toBe("2026-10-12");
  expect(change.percent).toBeCloseTo(10);
  expect(change).toMatchObject({ direction: "up", tone: "good", fallback: false });
});
it("never uses a current-week update, and falls back to the latest earlier update when last week has none", () => {
  const trends = history();
  trends.snapshotDates![source] = ["2026-09-29", "2026-10-12", "2026-10-14"];
  trends[source]!.batting_avg = [{ date: "2026-09-29", value: .3 }, { date: "2026-10-12", value: .31 }, { date: "2026-10-14", value: .33 }];
  const change = teamWeekChange(trends, source, metric(), "2026-10-14T16:00:00Z")!;
  expect(change).toMatchObject({ previousDate: "2026-09-29", fallback: true, direction: "up" });
  expect(change.percent).toBeCloseTo(10);
  const html = renderToStaticMarkup(createElement(TeamGameTrendDisplay, { trends, source, metric: metric(), updatedAt: "2026-10-14T16:00:00Z", compact: true }));
  expect(html).toContain("vs Sep 29"); expect(html).toContain("No update was saved last week");
  trends.snapshotDates![source] = ["2026-10-12", "2026-10-14"];
  trends[source]!.batting_avg = [{ date: "2026-10-12", value: .31 }, { date: "2026-10-14", value: .33 }];
  expect(teamWeekChange(trends, source, metric(), "2026-10-14T16:00:00Z")).toBeNull();
});
it("uses Pacific calendar weeks across UTC midnight and daylight saving time", () => {
  const trends = history();
  trends.snapshotDates![source] = ["2026-10-25", "2026-10-26", "2026-11-01"];
  trends[source]!.batting_avg = [{ date: "2026-10-25", value: .3 }, { date: "2026-10-26", value: .4 }, { date: "2026-11-01", value: .33 }];
  // Monday UTC is still Sunday in Pacific after the DST transition.
  expect(teamWeekChange(trends, source, metric(), "2026-11-02T07:30:00Z")).toMatchObject({ currentDate: "2026-11-01", previousDate: "2026-10-25" });
});
it("retains pending/empty snapshot days so earlier valid numbers cannot become the baseline", () => {
  const observation = (hits: number) => Object.entries({ ab: 4, base_hit: hits, pa: 4, bb: 0, hbp: 0, sac_fly: 0 }).map(([metric, value]) => ({ athleteCode: "SYN-001", metric, value, unit: "count", scope: "cumulative_fall" }));
  const trends = teamGameTrends([
    { id: "old", source, fetched_at: "2026-10-05T16:00:00Z", observations: observation(1) },
    { id: "pending", source, fetched_at: "2026-10-09T16:00:00Z", observations: [] },
    { id: "now", source, fetched_at: at, observations: observation(2) },
  ]);
  expect(trends.snapshotDates![source]).toEqual(["2026-10-05", "2026-10-09", "2026-10-12"]);
  expect(teamWeekChange(trends, source, metric(.5), at)).toBeNull();
});
it("withholds partial, invalid and mismatched current results", () => {
  for (const m of [metric(null), metric(NaN), metric(-1), metric(.4), { ...metric(), pending: true }]) {
    expect(teamWeekChange(history(), source, m, at)).toBeNull();
  }
  expect(teamWeekChange(history(), source, metric(), null)).toBeNull();
  expect(teamWeekChange(history(), source, metric(), "invalid")).toBeNull();
  expect(teamWeekChange(history(), source, metric(), "2026-10-13T16:00:00Z")).toBeNull();
  expect(teamWeekChange({}, source, metric(), at)).toBeNull();
});
it("does not mix source histories", () => {
  expect(teamWeekChange(history(), "pitching_fall_2026", metric(), at)).toBeNull();
});
it.each(["batting_k_pct", "pitching_whip", "pitching_bb9", "pitching_r9", "hard_contact_pct"])("colors falling %s as improvement while keeping the down arrow", key => {
  const pitching = key.startsWith("pitching_") || key === "hard_contact_pct";
  const trends = history(key, 10, 8);
  if (pitching) { trends.pitching_fall_2026 = trends[source]; trends.snapshotDates!.pitching_fall_2026 = trends.snapshotDates![source]; }
  expect(teamWeekChange(trends, pitching ? "pitching_fall_2026" : source, metric(8, key), at)).toMatchObject({ percent: -20, direction: "down", tone: "good" });
});
it("handles a zero baseline, unchanged results, declines and tiny movements honestly", () => {
  expect(teamWeekChange(history("batting_avg", 0, .33), source, metric(), at)).toMatchObject({ percent: null, direction: "up" });
  expect(teamWeekChange(history("batting_avg", 0, 0), source, metric(0), at)).toMatchObject({ percent: 0, direction: "same", tone: "neutral" });
  expect(teamWeekChange(history("batting_avg", .4, .33), source, metric(), at)).toMatchObject({ direction: "down", tone: "bad" });
  const html = renderToStaticMarkup(createElement(TeamGameTrendDisplay, { trends: history("batting_avg", .33, .33001), source, metric: metric(.33001), updatedAt: at, compact: true }));
  expect(html).toContain("&lt;0.1%"); expect(html).not.toContain("0.0%");
});
it("renders a compact tappable badge with relative change and actual dates, without the full chart", () => {
  const html = renderToStaticMarkup(createElement(TeamGameTrendDisplay, { trends: history(), source, metric: metric(), updatedAt: at, compact: true }));
  for (const text of ["<details", "<summary", "10.0%", "vs last week", "Oct 9, 2026", "Oct 12, 2026", "not percentage points", 'data-tone="good"']) expect(html).toContain(text);
  expect(html).not.toContain("<svg");
  expect(renderToStaticMarkup(createElement(TeamGameTrendDisplay, { trends: {}, source, metric: metric(), updatedAt: at, compact: true }))).toBe("");
  const zero = renderToStaticMarkup(createElement(TeamGameTrendDisplay, { trends: history("batting_avg", 0, .33), source, metric: metric(), updatedAt: at }));
  expect(zero).toContain("New"); expect(zero).not.toContain("Infinity");
});
