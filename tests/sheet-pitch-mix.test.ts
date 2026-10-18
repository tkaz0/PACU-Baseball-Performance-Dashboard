import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { sheetPitchMix, pitchSplits } from "@/lib/pitching-stats";
import { playerSheetPitchMix } from "@/lib/sheet-pitch-mix";
import { SheetMixChart, PitchArsenalChart } from "@/components/pitch-arsenal-chart";
import type { SharedGameStat } from "@/lib/game-server";
// Fictional counts only.
const stat = (metric: string, value: number, week = 1): SharedGameStat => ({ source: "pitching_fall_2026", athlete_id: "fictional-pitcher", metric, value, unit: "count", scope: "pitching_event", event_id: `fall-2026-week-${week}`, played_on: null, source_row: 2, source_column: 1, derived_from: [], snapshot_id: "fictional-snapshot", fetched_at: "2026-10-12T00:00:00Z", content_hash: "fictional" });
it("builds the Fall family mix from summed weekly sheet counts and keeps unrecorded pitches visible", () => {
  const stats = [stat("pitches", 60), stat("fb", 30), stat("bb_pitch_family", 15), stat("ch", 5), stat("pitches", 40, 2), stat("fb", 25, 2), stat("bb_pitch_family", 10, 2), stat("ch", 5, 2)];
  const mix = playerSheetPitchMix(stats)!;
  expect(mix.total).toBe(100);
  expect(mix.families.map(f => [f.key, f.pitches])).toEqual([["fb", 55], ["bb_pitch_family", 25], ["ch", 10]]);
  expect(mix.unrecorded).toBe(10);
});
it("withholds the mix when there is no total or families exceed it, never rescaling", () => {
  expect(sheetPitchMix(pitchSplits([stat("fb", 10)]), null)).toBeNull();
  const splits = pitchSplits([stat("pitches", 10), stat("fb", 8), stat("ch", 5)]);
  expect(sheetPitchMix(splits, 10)).toBeNull();
});
it("renders the sheet mix in place of the Full Swing classified donut", () => {
  const mix = { total: 100, families: [{ key: "fb", label: "Fastball Family", color: "#ef4444", pitches: 70 }, { key: "ch", label: "Changeup", color: "#f59e0b", pitches: 30 }], unrecorded: 0 };
  const html = renderToStaticMarkup(createElement(SheetMixChart, { mix }));
  expect(html).toContain("Every Fall game pitch by family"); expect(html).toContain("70 · 70%");
  const chart = renderToStaticMarkup(createElement(PitchArsenalChart, { pitches: [], sheetMix: mix }));
  expect(chart).toContain('data-testid="sheet-pitch-mix"'); expect(chart).not.toContain("assigned");
});
