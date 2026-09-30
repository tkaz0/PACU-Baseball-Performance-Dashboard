import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildPitchDesign, pitcherStudyMatches, pitcherSizePercentile, type PitchDesignBody } from "@/lib/pitch-design";
import { getPlayerPerformance } from "@/lib/player-performance";
import { fallArsenalPitches } from "@/lib/pitch-arsenal";
import type { Measurement } from "@/lib/imports/engine";
import type { PitcherStudyReference } from "@/lib/pitcher-study-references";
import { PitchDesignView } from "@/components/pitch-design-view";

const code = "SYN-PITCH-001";
const today = "2026-09-29";
const noBody: PitchDesignBody = { height: null, weight: null, heightRank: null, weightRank: null };
function session(pitchType = "Four-Seam Fastball", hash = "a", category = "Intrasquad", velocity = 80.123, spin = 2000.123, count = 10, date = "2026-09-11"): Measurement[] {
  return [["Count", count, "count"], ["Average Velocity", velocity, "mph"], ["Max Velocity", velocity + 2, "mph"], ["Velocity Readings", count, "count"], ["Average Spin", spin, "rpm"], ["Max Spin", spin + 100, "rpm"], ["Spin Readings", count, "count"]].map(([metric, value, unit], i) => ({
    id: `fictional-${hash}-${pitchType}-${i}`, athlete_code: code, metric: `Pitch Type ${metric}`, value: Number(value), unit: String(unit), source: `Full Swing · ${category} · ${pitchType}`, measured_at: date, file_hash: hash.repeat(64), source_file: "fictional-pitch.csv", source_sheet: "CSV", source_row: 2,
  }));
}
const performance = (readings: Measurement[] = []) => getPlayerPerformance({ readings, athleteCode: code, cohortAthleteCodes: [] });
function pro(id: number, throws: "R" | "L" = "R", height = 74, weight = 210, velo = 95, spin = 2400, gap = 10): PitcherStudyReference {
  return { id, name: `Fictional MLB Reference ${id}`, throws, heightInches: height, weightLb: weight, totalPitches: 1000, pitches: [
    { pitchType: "Four-Seam Fastball", statcastCode: "FF", pitchCount: 600, usagePercent: 60, averageVelocity: velo, averageSpin: spin },
    { pitchType: "Slider", statcastCode: "SL", pitchCount: 400, usagePercent: 40, averageVelocity: velo - gap, averageSpin: spin * 1.2 },
  ] };
}
const references = [pro(1), pro(2, "L"), pro(3, "R", 72, 190, 98, 2700), pro(4, "R", 76, 230, 99, 2600, 5), pro(5, "R", 78, 250, 90, 2100, 3), pro(6, "R", 70, 170, 90, 2100)];
const ids = references.map(item => item.id);
const pair = () => fallArsenalPitches([...session(), ...session("Slider", "a", "Intrasquad", 70.123, 2400.1476)], today);

describe("Pitch Design authorized numerical model", () => {
  it("uses count-weighted averages and Fall bests without changing values or sources", () => {
    const rows = [...session(), ...session("Four-Seam Fastball", "b", "Intrasquad", 84.123, 2200.123, 30, "2026-09-23")];
    const before = structuredClone(rows), model = buildPitchDesign(rows, performance(rows), "R", today);
    expect(model.contexts[0].pitches[0]).toMatchObject({ averageVelocity: 83.123, maxVelocity: 86.123, averageSpin: 2150.123, count: 40, velocityReadings: 40, spinReadings: 40 });
    expect(rows).toEqual(before);
    expect(JSON.stringify(model)).not.toContain("file_hash"); expect(JSON.stringify(model)).not.toContain("fictional-pitch.csv"); expect(JSON.stringify(model)).not.toContain(code);
  });
  it("partitions Game, Intrasquad and Practice, retaining specifically named pitches", () => {
    const rows = [...session(), ...session("Slider", "a", "Intrasquad", 70, 2400), ...session("Four-Seam Fastball", "c", "Practice", 90), ...session("Curveball", "d", "Game", 66, 2600)];
    const model = buildPitchDesign(rows, performance(rows), "R", today);
    expect(model.contexts.map(context => context.category)).toEqual(["Game", "Intrasquad", "Practice"]);
    expect(model.contexts[1].pitches.map(pitch => pitch.pitchType).sort()).toEqual(["Four-Seam Fastball", "Slider"]);
    expect(model.contexts[2].pitches[0].averageVelocity).toBe(90);
  });
  it("rejects mixed athletes even if their extra readings would not make the pitch chart", () => {
    const rows = session(), foreign = { ...rows[0], athlete_code: "SYN-OTHER", source: "Fictional body testing", metric: "Height", unit: "in", value: 72 };
    expect(buildPitchDesign([...rows, foreign], performance(rows), "R", today)).toMatchObject({ contexts: [], body: noBody, mixedAthletes: true });
    expect(buildPitchDesign(rows, getPlayerPerformance({ readings: [foreign], athleteCode: "SYN-OTHER" }), "R", today).mixedAthletes).toBe(true);
  });
  it("does not invent missing spin or change unknown classifications", () => {
    const rows = session("Fastball").filter(row => !row.metric.includes("Spin"));
    const result = buildPitchDesign(rows, performance(rows), "R", today).contexts[0];
    expect(result.pitches[0]).toMatchObject({ pitchType: "Fastball", averageSpin: null, maxSpin: null }); expect(result.studies).toEqual([]);
  });
  it("keeps missing counts as labeled latest fallbacks and withholds relationship matching", () => {
    const rows = [...session(), ...session("Slider", "a", "Intrasquad", 70, 2400)].filter(row => !row.metric.endsWith("Readings"));
    const model = buildPitchDesign(rows, performance(rows), "R", today);
    expect(model.contexts[0].pitches.every(pitch => pitch.velocityBasis === "latest" && pitch.spinBasis === "latest")).toBe(true);
    expect(model.contexts[0].studies.every(match => !match.speedGapsUsed && !match.spinRelationshipsUsed)).toBe(true);
  });
  it("uses only current canonical size and verified own size percentiles", () => {
    const bodyRows = [["Height", 180.34, "cm"], ["Weight", 90, "kg"]].map(([metric, value, unit], i) => ({ ...session()[0], id: `fictional-body-${i}`, source: "Fictional testing", metric: String(metric), value: Number(value), unit: String(unit) }));
    const overrides = bodyRows.map(row => ({ athleteCode: code, metricKey: row.metric === "Height" ? "height" as const : "weight" as const, measuredAt: row.measured_at, observedValue: row.value, source: row.source, value: 65, sampleSize: 10, period: "fall_2026" as const, unit: row.unit, direction: "neutral" as const }));
    const own = getPlayerPerformance({ readings: bodyRows, athleteCode: code, cohortAthleteCodes: [], percentileOverrides: overrides });
    const model = buildPitchDesign(session(), own, "L", today);
    expect(model.body.height?.value).toBeCloseTo(71); expect(model.body.weight?.value).toBeCloseTo(198.416);
    expect(model.body.heightRank).toEqual({ value: 65, sampleSize: 10 });
    const wrong = getPlayerPerformance({ readings: bodyRows, athleteCode: code, cohortAthleteCodes: [], percentileOverrides: overrides.map(row => ({ ...row, athleteCode: "SYN-OTHER" })) });
    expect(buildPitchDesign(session(), wrong, "R", today).body.heightRank).toBeNull();
  });
  it("omits future/out-of-Fall readings and has useful empty state", () => {
    const rows = [...session("Slider", "a", "Intrasquad", 70, 2400, 10, "2026-10-01"), ...session("Curveball", "b", "Game", 67, 2500, 10, "2026-08-01")];
    expect(buildPitchDesign(rows, performance(), "R", today).contexts).toEqual([]);
    expect(buildPitchDesign([], performance(), null, today)).toEqual({ contexts: [], body: noBody, throws: null, mixedAthletes: false });
  });
  it("withholds a future body reading and its rank using the same cutoff as the arsenal", () => {
    const height = { ...session()[0], metric: "Height", value: 76, unit: "in", source: "Fictional testing", measured_at: "2026-10-01" };
    const own = getPlayerPerformance({ readings: [height], athleteCode: code, cohortAthleteCodes: [], percentileOverrides: [{ athleteCode: code, metricKey: "height", measuredAt: height.measured_at, observedValue: 76, source: height.source, value: 80, sampleSize: 10, period: "fall_2026", unit: "in", direction: "neutral" }] });
    expect(buildPitchDesign(session(), own, "R", today).body).toEqual(noBody);
    expect(buildPitchDesign(session(), own, "R", "bad-date").contexts).toEqual([]);
  });
});

describe("pitcher study matching", () => {
  it("is strictly same handed and never guesses unrecorded handedness", () => {
    expect(pitcherStudyMatches(pair(), noBody, "L", references, ids).map(item => item.reference.id)).toEqual([2]);
    expect(pitcherStudyMatches(pair(), noBody, "R", references, ids).every(item => item.reference.throws === "R")).toBe(true);
    expect(pitcherStudyMatches(pair(), noBody, null, references, ids)).toEqual([]);
  });
  it("uses shared exact types first, not raw velocity or spin", () => {
    const original = pitcherStudyMatches(pair(), noBody, "R", references, ids);
    const shifted = pair().map(pitch => ({ ...pitch, averageVelocity: pitch.averageVelocity! + 12, averageSpin: pitch.averageSpin! * 1.5 }));
    expect(pitcherStudyMatches(shifted, noBody, "R", references, ids).map(item => item.reference.id)).toEqual(original.map(item => item.reference.id));
    expect(original[0]).toMatchObject({ sharedPitches: ["Four-Seam Fastball", "Slider"], speedGapsUsed: true, spinRelationshipsUsed: true, sizeUsed: false });
    expect(original[0].reference.id).toBe(1);
  });
  it("never matches a generic label, pools contexts, or equates sinker and two-seam", () => {
    const own = pair();
    expect(pitcherStudyMatches(own.map(pitch => ({ ...pitch, pitchType: "Fastball" })), noBody, "R", references, ids)).toEqual([]);
    expect(pitcherStudyMatches([own[0], { ...own[1], category: "Practice" }], noBody, "R", references, ids)).toEqual([]);
    expect(pitcherStudyMatches([{ ...own[0], pitchType: "Two-Seam Fastball" }], noBody, "R", references, ids)).toEqual([]);
  });
  it("withholds incompatible dates and averaging methods from relationship comparisons", () => {
    const own = pair(); own[1].velocityAverageFirstDate = "2026-09-12"; own[1].spinBasis = "latest";
    expect(pitcherStudyMatches(own, noBody, "R", references, ids).every(item => !item.speedGapsUsed && !item.spinRelationshipsUsed)).toBe(true);
  });
  it("computes size from the full cohort before hand/name filtering", () => {
    expect(pitcherSizePercentile(74, "heightInches", references)).toBeCloseTo(50);
    const body = { ...noBody, heightRank: { value: 8.3333333, sampleSize: 10 }, weightRank: { value: 8.3333333, sampleSize: 10 } };
    const own = pair().map(pitch => ({ ...pitch, velocityBasis: null, spinBasis: null }));
    const matches = pitcherStudyMatches(own, body, "R", references, [1, 6]);
    expect(matches[0].reference.id).toBe(6); expect(matches[0].heightPercentile).toBeCloseTo(8.33333);
    expect(matches[0].sizeUsed).toBe(true); expect(pitcherSizePercentile(74, "heightInches", references.slice(0, 4))).toBeNull();
  });
  it("does not require two recorded types for a single-pitch starter and never duplicates candidates", () => {
    expect(pitcherStudyMatches(pair().slice(0, 1), noBody, "R", [...references, references[0]], ids)).toHaveLength(3);
    expect(new Set(pitcherStudyMatches(pair(), noBody, "R", [...references, references[0]], ids).map(item => item.reference.id)).size).toBe(3);
  });
});

describe("Pitch Design presentation", () => {
  it("shows all four one-decimal metrics, source context, real source links and interpretation limits", () => {
    const rows = [...session(), ...session("Slider", "a", "Intrasquad", 70.456, 2400.456)];
    const html = renderToStaticMarkup(createElement(PitchDesignView, { model: buildPitchDesign(rows, performance(rows), "R", today) }));
    expect(html).toContain("80.1"); expect(html).toContain("2,000.1"); expect(html).not.toContain("80.123");
    for (const label of ["Average Velo", "Fall Max Velo", "Average Spin", "Fall Max Spin", "Pitchers to Study", "In-Game · Intrasquad", "4-Seam Fastball", "Nate Rasmussen", "View Grip Photos", "https://rasmussenbaseball.com/tools/pitch-grips", "not a performance grade", "Total spin alone does not establish movement"]) expect(html).toContain(label);
    expect(html).not.toContain("file_hash"); expect(html).not.toContain("fictional-pitch.csv");
  });
  it("keeps a working grip library even before pitching measurements exist", () => {
    const html = renderToStaticMarkup(createElement(PitchDesignView, { model: buildPitchDesign([], performance(), "R", today) }));
    expect(html).toContain("Your Arsenal Starts Here"); expect(html).toContain("FF1 — Standard four-seam"); expect(html).not.toContain("NaN");
  });
});
