import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SessionProgress } from "@/components/session-progress";
import { ProfileTrendChart } from "@/components/profile-trend-chart";
import type { ProgressSeries } from "@/lib/session-progress";
import type { TrendAnnotation } from "@/lib/trend-annotations";
const annotation: TrendAnnotation = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", athleteId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", date: "2026-09-15", category: "swing_cue", scope: "hitting_practice", note: "Fictional cue adjustment", shared: true, archived: false, revision: 1, createdAt: "2026-09-20T00:00:00Z" };
const series: ProgressSeries = { key: "bat_speed", label: "Bat Speed", unit: "mph", context: "practice", points: [
  { key: "a", date: "2026-09-10", label: "Fictional A", value: 60, count: 10 },
  { key: "b", date: "2026-09-12", label: "Fictional B", value: 62, count: 10 },
  { key: "c", date: "2026-09-20", label: "Fictional C", value: 63, count: 10 },
] };
it("places session points by calendar date and annotations between actual readings", () => {
  const html = renderToStaticMarkup(createElement(SessionProgress, { blast: [series], pitchingGame: [], pitchingPractice: [], annotations: [annotation] }));
  expect(html).toContain('cx="87.6"'); // 2 days into a 10-day range, rather than the center.
  expect(html).toContain('x1="180" x2="180"'); // Date marker lies midway; it is not a result dot.
  expect(html).toContain("Fictional cue adjustment");
  expect(html).toContain("3 sessions");
});
it("keeps practice swing notes off pitching or physicality charts", () => {
  const pitching = renderToStaticMarkup(createElement(SessionProgress, { blast: [], pitchingGame: [{ ...series, key: "pitch", context: "in_game" }], pitchingPractice: [], annotations: [annotation] }));
  expect(pitching).not.toContain("Fictional cue adjustment");
  const physicality = renderToStaticMarkup(createElement(ProfileTrendChart, { series: [{ key: "weight", label: "Weight", unit: "lb", source: "RENPHO", period: "Fall 2026", points: series.points }], annotations: [annotation] }));
  expect(physicality).not.toContain("Fictional cue adjustment");
});
it("does not manufacture date spacing for multiple sessions on the same day", () => {
  const sameDay = { ...series, points: series.points.map(point => ({ ...point, date: "2026-09-15" })) };
  const html = renderToStaticMarkup(createElement(SessionProgress, { blast: [sameDay], pitchingGame: [], pitchingPractice: [] }));
  expect(html.match(/cx="180"/g)).toHaveLength(3);
  expect(html).not.toContain("NaN");
});


it("renders practice coaching notes on a legacy Full Swing Hitting trend", () => {
  const gameNote = { ...annotation, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", note: "Fictional game-only cue", scope: "hitting_game" as const };
  const html = renderToStaticMarkup(createElement(ProfileTrendChart, {
    series: [{ key: "avg_bat_speed", label: "Average Bat Speed", source: "Full Swing · Hitting", unit: "mph", period: "Fall 2026", points: series.points }],
    annotations: [annotation, gameNote],
  }));
  expect(html).toContain("Fictional cue adjustment");
  expect(html).not.toContain("Fictional game-only cue");
});
