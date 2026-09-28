import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildPitchSeparation, pitchSeparationGap } from "@/lib/pitch-separation";
import { PitchSeparationChart } from "@/components/pitch-separation-chart";
import { ClassifiedPitchResults } from "@/components/classified-pitch-results";
import { fictionalComparisonPitch } from "./fixtures/comparison-arsenal";
import type { FallArsenalPitch } from "@/lib/pitch-arsenal";

const today = "2026-09-27";
const fastball = fictionalComparisonPitch({ averageVelocity: 85.345, velocityReadings: 40 });
const slider = fictionalComparisonPitch({ source: "Full Swing · Intrasquad · Slider", pitchType: "Slider", averageVelocity: 72.168, velocityReadings: 15 });
const model = (pitches: readonly FallArsenalPitch[], reference?: string) => buildPitchSeparation(pitches, "Intrasquad", reference, today);

describe("pitch speed separation", () => {
  it("subtracts comparable average velocities at full precision and never substitutes maxima or spin counts", () => {
    const result = model([fastball, slider]);
    expect(result.reference?.source).toBe(fastball.source);
    expect(result.rows[0]).toMatchObject({ source: slider.source, average: 72.168, count: 15, issue: null });
    expect(result.rows[0].gap).toBeCloseTo(13.177, 12);
    expect(result.domain).toEqual([70, 90]);
    expect(pitchSeparationGap(result.rows[0].gap!)).toBe("13.2 mph slower");
    expect(fastball.averageVelocity).toBe(85.345);
  });
  it("requires an explicit reference when multiple fastball subtypes are recorded", () => {
    const twoSeam = fictionalComparisonPitch({ source: "Full Swing · Intrasquad · Two-Seam Fastball", pitchType: "Two-Seam Fastball", averageVelocity: 82.345 });
    const pitches = [fastball, twoSeam, slider];
    for (const request of [undefined, "unknown", "Full Swing · Practice · Fastball"]) {
      expect(model(pitches, request).reference).toBeNull();
      expect(model(pitches, request).rows.every(row => row.gap === null)).toBe(true);
    }
    const selected = model(pitches, twoSeam.source);
    expect(selected.reference?.pitchType).toBe("Two-Seam Fastball");
    expect(selected.rows.find(row => row.source === slider.source)?.gap).toBeCloseTo(10.177, 12);
    expect(selected.rows.find(row => row.source === fastball.source)?.gap).toBe(-3);
  });
  it("keeps Game, Intrasquad and Practice and exact classified labels isolated", () => {
    const practice = { ...fastball, category: "Practice" as const, source: "Full Swing · Practice · Fastball", averageVelocity: 92 };
    const game = { ...slider, category: "Game" as const, source: "Full Swing · Game · Slider", averageVelocity: 78 };
    const malformed = { ...slider, source: "Full Swing · Intrasquad · Fastball" };
    const pitches = [fastball, slider, practice, game, malformed];
    expect(model(pitches).rows).toHaveLength(1);
    expect(buildPitchSeparation(pitches, "Practice", undefined, today).rows).toEqual([]);
    expect(buildPitchSeparation(pitches, "Game", undefined, today).reference).toBeNull();
  });
  it.each([null, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("withholds gaps with unavailable or invalid velocity count %s", count => {
    const result = model([fastball, { ...slider, velocityReadings: count }]);
    expect(result.rows[0]).toMatchObject({ average: slider.averageVelocity, count: null, gap: null, issue: "count" });
    expect(result.domain).toBeNull();
    expect(model([{ ...fastball, velocityReadings: count }, slider]).rows[0].gap).toBeNull();
  });
  it("compares matching latest-session summaries but never mixes them with Fall averages or other dates", () => {
    const latest = (pitch: FallArsenalPitch) => ({ ...pitch, velocityBasis: "latest" as const, velocityAverageFirstDate: "2026-09-23", velocityAverageLastDate: "2026-09-23" });
    expect(model([latest(fastball), latest(slider)]).rows[0].gap).not.toBeNull();
    expect(model([fastball, latest(slider)]).rows[0]).toMatchObject({ gap: null, issue: "different-basis" });
    expect(model([fastball, { ...slider, velocityAverageLastDate: "2026-09-11" }]).rows[0]).toMatchObject({ gap: null, issue: "different-dates" });
    expect(model([latest(fastball), { ...latest(slider), velocityAverageFirstDate: "2026-09-11", velocityAverageLastDate: "2026-09-11" }]).rows[0].gap).toBeNull();
  });
  it("withholds ambiguous duplicate summaries and invalid, non-Fall or future date ranges", () => {
    expect(model([fastball, slider, slider]).rows[0]).toMatchObject({ average: null, gap: null, issue: "duplicate" });
    expect(model([fastball, fastball, slider]).reference?.issue).toBe("duplicate");
    for (const date of ["2026-08-31", "2026-09-31", "2026-10-01", null]) {
      expect(model([fastball, { ...slider, velocityAverageLastDate: date }]).rows[0]).toMatchObject({ average: null, gap: null, issue: "dates" });
    }
    expect(buildPitchSeparation([fastball, slider], "Intrasquad", undefined, "invalid").reference).toBeNull();
  });
  it("shows faster pitches and near-equal readings without inventing an ideal gap", () => {
    expect(pitchSeparationGap(model([fastball, { ...slider, averageVelocity: 88.345 }]).rows[0].gap!)).toBe("3.0 mph faster");
    expect(pitchSeparationGap(0)).toBe("0.0 mph gap");
    expect(pitchSeparationGap(-0.01)).toBe("0.0 mph gap");
    expect(model([fastball, { ...slider, averageVelocity: fastball.averageVelocity }]).domain).toEqual([80, 90]);
  });
});

describe("pitch separation display", () => {
  it("shows exact averages, a common mph scale, readable counts/dates and the gap without quality claims", () => {
    const html = renderToStaticMarkup(createElement(PitchSeparationChart, { pitches: [fastball, slider], category: "Intrasquad", today }));
    for (const label of ["Pitch Separation", "Intrasquad", "85.3 mph", "72.2 mph", "13.2 mph slower", "40 speed readings", "15 speed readings", "Sep 11, 2026", "Sep 23, 2026", "Average speed (mph)", "70.0", "90.0"]) expect(html).toContain(label);
    expect(html).toContain('aria-label="About Pitch Separation"');
    expect(html).toContain("data-pitch-gap=");
    expect(html).not.toContain("file_hash");expect(html).not.toContain("Ideal");expect(html).not.toContain("Good gap");
  });
  it("provides a labeled reference selector without silently selecting one fastball", () => {
    const other = { ...fastball, source: "Full Swing · Intrasquad · Sinker", pitchType: "Sinker" };
    const html = renderToStaticMarkup(createElement(PitchSeparationChart, { pitches: [fastball, other, slider], category: "Intrasquad", today }));
    expect(html).toContain("Fastball Reference");expect(html).toContain('<option value="" selected="">Choose a fastball</option>');
    expect(html).toContain("Sinker");expect(html).not.toContain("data-pitch-gap=");
  });
  it("shows honest missing-reference or noncomparable messages without fake zero bars", () => {
    const missing = renderToStaticMarkup(createElement(PitchSeparationChart, { pitches: [slider], category: "Intrasquad", today }));
    expect(missing).toContain("A classified fastball average is needed");expect(missing).not.toContain("data-pitch-gap=");
    const different = renderToStaticMarkup(createElement(PitchSeparationChart, { pitches: [fastball, { ...slider, velocityAverageLastDate: "2026-09-11" }], category: "Intrasquad", today }));
    expect(different).toContain("Different test dates");expect(different).toContain("72.2 mph");expect(different).not.toContain("data-pitch-gap=");
  });
  it("integrates independently within each profile context and stays out of the compact overview", () => {
    const pitches = [fastball, slider, { ...fastball, source: "Full Swing · Game · Fastball", category: "Game" as const }];
    const full = renderToStaticMarkup(createElement(ClassifiedPitchResults, { pitches }));
    expect(full.match(/Average speed off your fastball/g)).toHaveLength(2);
    const compact = renderToStaticMarkup(createElement(ClassifiedPitchResults, { pitches, showChart: false }));
    expect(compact).not.toContain("Average speed off your fastball");
    const practice = renderToStaticMarkup(createElement(ClassifiedPitchResults, { pitches, context: "practice" }));
    expect(practice).toBe("");
  });
});
