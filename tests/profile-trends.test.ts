import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { profileTrends, gameRateWidth } from "@/lib/profile-trends";
import { ProfileTrendChart } from "@/components/profile-trend-chart";
import { GameRateBar } from "@/components/game-rate-bar";
import type { PlayerMetricCard, PlayerMetricReading } from "@/lib/player-performance";
const latest: PlayerMetricReading = { id: "fictional-new", athleteCode: "SYN-001", metricKey: "muscle_mass", value: 155, unit: "lb", measuredAt: "2026-09-13", period: "fall_2026", source: "RENPHO", importedAt: "2026-09-13T20:00:00Z", provenance: [], derived: false };
const old = { ...latest, id: "fictional-old", value: 150, measuredAt: "2026-09-01" };
const card = (history: PlayerMetricReading[], current = latest): PlayerMetricCard => ({metric: {key: "muscle_mass", label: "Muscle Mass", group: "body", units: ["lb", "kg"], direction: "neutral"}, latest: current, summerBaseline: null, history, percentile: null, cohortSampleSize: null, percentileStatus: "unavailable"});
it("sorts and deduplicates actual test dates without exposing observation provenance", () => {
  const result = profileTrends([card([latest, old, old])]);
  expect(result).toEqual([{key: "muscle_mass", label: "Muscle Mass", unit: "lb", source: "RENPHO", period: "Fall 2026", points: [{date: old.measuredAt, value: 150}, {date: latest.measuredAt, value: 155}]}]);
});
it("does not manufacture a trend from one date or blend identities, units, sources, periods, metrics or derived results", () => {
  expect(profileTrends([card([latest])])).toEqual([]);
  for (const patch of [{athleteCode: "SYN-002"}, {unit: "kg"}, {source: "Other"}, {period: "summer_2026" as const}, {metricKey: "weight" as const}, {derived: true}, {measuredAt: "2026-09-14"}]) {
    expect(profileTrends([card([{...old, ...patch}])])).toEqual([]);
  }
});
it("withholds ambiguous or invalid series rather than selecting an arbitrary result", () => {
  for (const patch of [{value: 149}, {value: NaN}, {value: -1}, {measuredAt: "2026-02-30"}]) expect(profileTrends([card([old, {...old, ...patch}])])).toEqual([]);
  expect(profileTrends([card([old, {...latest, value: 160}])])).toEqual([]);
});
it("renders flat and zero series with finite coordinates and accessible exact chart data", () => {
  for (const value of [0, 150]) {
    const series = profileTrends([card([{...old, value}], {...latest, value})]);
    const html = renderToStaticMarkup(createElement(ProfileTrendChart, { series }));
    expect(html).not.toContain("NaN"); expect(html).not.toContain("Infinity");
    expect(html).toContain("Chart Data"); expect(html).toContain("Zoomed vertical scale"); expect(html).toContain(old.measuredAt);
  }
  expect(renderToStaticMarkup(createElement(ProfileTrendChart, {series: []}))).toBe("");
});
it("uses true rate scales and excludes counts, missing, invalid and unbounded SB/PA values", () => {
  expect(gameRateWidth(.375, "avg")).toBe(37.5); expect(gameRateWidth(64, "%")).toBe(64); expect(gameRateWidth(0, "%")).toBe(0);
  for (const [value, unit] of [[null, "%"], [NaN, "%"], [-1, "%"], [101, "%"], [2, "avg"], [12, "count"], [1.2, "ratio"]] as const) expect(gameRateWidth(value, unit)).toBeNull();
  const html = renderToStaticMarkup(createElement(GameRateBar, {value: .375, unit: "avg", label: "AVG"}));
  expect(html).toContain("width:37.5%"); expect(html).toContain("not a percentile");
});
