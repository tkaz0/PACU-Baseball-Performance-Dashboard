import { describe, expect, it } from "vitest";
import { fallArsenalPitches, type ArsenalReading } from "@/lib/pitch-arsenal";

const labels = {
  count: ["Pitch Type Count", "count"],
  averageVelocity: ["Pitch Type Average Velocity", "mph"],
  maxVelocity: ["Pitch Type Max Velocity", "mph"],
  velocityReadings: ["Pitch Type Velocity Readings", "count"],
  averageSpin: ["Pitch Type Average Spin", "rpm"],
  maxSpin: ["Pitch Type Max Spin", "rpm"],
  spinReadings: ["Pitch Type Spin Readings", "count"],
} as const;
function session(hash: string, date: string, pitch: string, values: Partial<Record<keyof typeof labels, number>>, category = "Intrasquad"): ArsenalReading[] {
  return Object.entries(values).map(([key, value]) => ({ source: `Full Swing · ${category} · ${pitch}`, metric: labels[key as keyof typeof labels][0], unit: labels[key as keyof typeof labels][1], value,
    measured_at: date, file_hash: hash.repeat(64) }));
}
const aggregate = (rows: ArsenalReading[]) => fallArsenalPitches(rows, "2026-12-31");

describe("cumulative Fall classified arsenal", () => {
  it("keeps older pitch types and weights each mean by its exact family count, while retaining Fall bests", () => {
    const rows = [...session("a", "2026-09-11", "Fastball", { count: 11, averageVelocity: 80.123, maxVelocity: 90.123, velocityReadings: 10, averageSpin: 2000, maxSpin: 2300, spinReadings: 5 }),
      ...session("b", "2026-09-23", "Fastball", { count: 31, averageVelocity: 84.123, maxVelocity: 86, velocityReadings: 30, averageSpin: 2200, maxSpin: 2250, spinReadings: 15 }),
      ...session("a", "2026-09-11", "Curveball", { count: 4, averageVelocity: 68, maxVelocity: 70, velocityReadings: 4 })];
    const original = structuredClone(rows), result = aggregate(rows), fast = result.find(p => p.pitchType === "Fastball")!;
    expect(result.map(p => p.pitchType)).toEqual(["Fastball", "Curveball"]);
    expect(fast).toMatchObject({ count: 42, sessionCount: 2, firstDate: "2026-09-11", lastDate: "2026-09-23", averageVelocity: 83.123, maxVelocity: 90.123, velocityReadings: 40,
      averageSpin: 2150, maxSpin: 2300, spinReadings: 20, velocityBasis: "fall", spinBasis: "fall", maxVelocityDate: "2026-09-11", maxSpinDate: "2026-09-11", maxVelocityReadings: 40, maxSpinReadings: 20 });
    expect(rows).toEqual(original);
    expect(JSON.stringify(result)).not.toContain("file_hash"); expect(JSON.stringify(result)).not.toContain("a".repeat(64));
  });
  it("keeps source, pitch, unit and file partitions separate and ignores unassigned pitches", () => {
    const rows = [...session("a", "2026-09-11", "Fastball", { averageVelocity: 80, velocityReadings: 1 }),
      ...session("a", "2026-09-11", "Fastball", { averageVelocity: 90, velocityReadings: 1 }, "Practice"),
      ...session("a", "2026-09-11", "Fastball", { averageVelocity: 82, velocityReadings: 1 }, "Game"),
      ...session("a", "2026-09-11", "Slider", { averageVelocity: 69, velocityReadings: 1 }),
      ...session("a", "2026-09-11", "Unknown", { averageVelocity: 99, velocityReadings: 1 }),
      { ...session("a", "2026-09-11", "Fastball", { averageVelocity: 999 })[0], unit: "rpm" }];
    expect(aggregate(rows).map(p => [p.category, p.pitchType, p.averageVelocity])).toEqual([["Game", "Fastball", 82], ["Intrasquad", "Fastball", 80], ["Intrasquad", "Slider", 69], ["Practice", "Fastball", 90]]);
  });
  it("dates each family and average independently and does not reuse average counts for maxima", () => {
    const rows = [...session("a", "2026-09-11", "Fastball", { averageVelocity: 80, maxVelocity: 85, velocityReadings: 10, averageSpin: 2000, maxSpin: 2100, spinReadings: 7 }),
      ...session("b", "2026-09-23", "Fastball", { maxVelocity: 89, velocityReadings: 4 })];
    expect(aggregate(rows)[0]).toMatchObject({ averageVelocity: 80, velocityReadings: 10, velocityBasis: "fall", maxVelocity: 89, maxVelocityReadings: 14, maxVelocityDate: "2026-09-23",
      velocityAverageFirstDate: "2026-09-11", velocityAverageLastDate: "2026-09-11", velocityLastDate: "2026-09-23", spinLastDate: "2026-09-11", spinAverageLastDate: "2026-09-11", maxSpinReadings: 7 });
  });
  it("labels latest means when counts are incomplete and keeps missing maximum counts unknown", () => {
    const rows = [...session("a", "2026-09-11", "Fastball", { averageVelocity: 80, maxVelocity: 85 }),
      ...session("b", "2026-09-23", "Fastball", { averageVelocity: 84, maxVelocity: 86, velocityReadings: 5 })];
    expect(aggregate(rows)[0]).toMatchObject({ averageVelocity: 84, velocityBasis: "latest", velocityReadings: 5, maxVelocity: 86, maxVelocityReadings: null, velocityAverageFirstDate: "2026-09-23", velocityAverageLastDate: "2026-09-23" });
  });
  it("does not choose an arbitrary same-date fallback when one mean lacks counts", () => {
    const rows = [...session("a", "2026-09-11", "Fastball", { averageVelocity: 80, maxVelocity: 88 }), ...session("b", "2026-09-11", "Fastball", { averageVelocity: 84, maxVelocity: 86, velocityReadings: 5 })];
    expect(aggregate(rows)[0]).toMatchObject({ averageVelocity: null, velocityBasis: null, velocityReadings: null, maxVelocity: 88, maxVelocityReadings: null });
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("never uses invalid count %s in an average or maximum denominator", count => {
    const rows = session("a", "2026-09-11", "Fastball", { averageVelocity: 80, maxVelocity: 85, velocityReadings: count });
    expect(aggregate(rows)[0]).toMatchObject({ averageVelocity: 80, velocityBasis: "latest", velocityReadings: null, maxVelocity: 85, maxVelocityReadings: null });
  });
  it("treats duplicate counts and maxima as ambiguous rather than overcounting", () => {
    const first = session("a", "2026-09-11", "Fastball", { averageVelocity: 80, maxVelocity: 90, velocityReadings: 10 });
    const other = session("b", "2026-09-23", "Fastball", { averageVelocity: 84, maxVelocity: 86, velocityReadings: 5 });
    expect(aggregate([...first, first[2], ...other])[0]).toMatchObject({ averageVelocity: 84, velocityBasis: "latest", velocityReadings: 5, maxVelocity: 90, maxVelocityReadings: null });
    expect(aggregate([...first, first[1], ...other])[0]).toMatchObject({ maxVelocity: 90, maxVelocityReadings: null });
  });
  it("never mixes dates inside one source file or includes future and non-Fall dates", () => {
    const one = session("a", "2026-09-11", "Fastball", { averageVelocity: 80, velocityReadings: 10 });
    expect(aggregate([...one, ...session("a", "2026-09-23", "Fastball", { maxVelocity: 88 })])).toEqual([]);
    const rows = [...one, ...session("b", "2026-08-31", "Slider", { maxVelocity: 70 }), ...session("c", "2026-10-01", "Curveball", { maxVelocity: 65 })];
    expect(fallArsenalPitches(rows, "2026-09-27").map(p => p.pitchType)).toEqual(["Fastball"]);
    expect(fallArsenalPitches(rows, "invalid")).toEqual([]);
  });
});
