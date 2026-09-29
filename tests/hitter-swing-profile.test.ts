import { describe, expect, it } from "vitest";
import { blastSource, type BlastSummaryKind } from "@/lib/blast-metrics";
import { attackPath, barrelTilt, hitterSwingProfile } from "@/lib/hitter-swing-profile";
import type { Measurement } from "@/lib/imports/engine";
import { getPlayerPerformance, type PlayerPerformance } from "@/lib/player-performance";

const code = "SYN-SWING-001";
function report({ hash = "a", start = "2026-09-01", end = "2026-09-07", count = 10, attack = 4, vertical = -20, speed = 65, kind = "average", athleteCode = code }: {
  hash?: string; start?: string; end?: string; count?: number; attack?: number; vertical?: number; speed?: number; kind?: BlastSummaryKind; athleteCode?: string;
} = {}): Measurement[] {
  return [["Blast Swing Count", count, "count"], ["Attack Angle", attack, "deg"], ["Vertical Bat Angle", vertical, "deg"], [kind === "average" ? "Average Bat Speed" : "Peak Bat Speed (95th)", speed, "mph"]].map(([metric, value, unit], index) => ({
    id: `fictional-${hash}-${athleteCode}-${index}`, athlete_code: athleteCode, measured_at: end,
    source: blastSource(kind, start, end), metric: String(metric), value: Number(value), unit: String(unit),
    source_file: "fictional-swing-profile.csv", source_sheet: "CSV", source_row: 2, file_hash: hash.repeat(64),
  }));
}
function body(metric: "Height" | "Weight", value: number, unit: string, date = "2026-08-20", athleteCode = code): Measurement {
  return { id: `fictional-${metric}-${date}-${athleteCode}`, athlete_code: athleteCode, measured_at: date, source: "Fictional body testing",
    metric, value, unit, source_file: "fictional-body.csv", source_sheet: "CSV", source_row: 2, file_hash: "f".repeat(64) };
}
const performance = (readings: Measurement[] = [], athleteCode = code) => getPlayerPerformance({ readings, athleteCode });

describe("custom descriptive PAC swing bands", () => {
  it.each([
    [-90, "downhill", "Downhill Swing"], [-0.001, "downhill", "Downhill Swing"],
    [0, "flat", "Flat Driver"], [9.999, "flat", "Flat Driver"],
    [10, "rising", "Rising Driver"], [19.999, "rising", "Rising Driver"],
    [20, "high_lift", "High-Lift Swing"], [90, "high_lift", "High-Lift Swing"],
  ])("preserves the exact attack-angle boundary at %s degrees", (value, key, name) => {
    expect(attackPath(value as number)).toMatchObject({ key, name });
  });
  it.each([
    [-90, "deep", "Deep Barrel"], [-40.001, "deep", "Deep Barrel"],
    [-40, "mid", "Mid-Tilt Barrel"], [-20.001, "mid", "Mid-Tilt Barrel"],
    [-20, "shallow", "Shallow Barrel"], [0, "shallow", "Shallow Barrel"],
    [0.001, "up", "Barrel Up"], [90, "up", "Barrel Up"],
  ])("preserves the exact signed vertical-angle boundary at %s degrees", (value, key, label) => {
    expect(barrelTilt(value as number)).toMatchObject({ key, label });
  });
  it.each([null, NaN, Infinity, -Infinity, -90.001, 90.001])("withholds unusable display geometry %s without clamping", value => {
    expect(attackPath(value)).toBeNull();
    expect(barrelTilt(value)).toBeNull();
  });
});

describe("hitter Swing Profile measurement model", () => {
  it("uses unrounded swing-count-weighted Fall averages, preserving signed angles and inputs", () => {
    const readings = [...report(), ...report({ hash: "b", start: "2026-09-08", end: "2026-09-14", count: 30, attack: 20, vertical: -40, speed: 85 }),
      ...report({ hash: "c", start: "2026-09-08", end: "2026-09-14", count: 30, attack: 80, vertical: 70, speed: 99, kind: "p95" })];
    const cards = performance([body("Height", 180, "cm"), body("Weight", 85, "kg")]);
    const before = structuredClone({ readings, cards });
    const model = hitterSwingProfile(readings, cards);
    expect(model).toMatchObject({ averageBatSpeed: 80, attackAngle: 16, verticalBatAngle: -35, path: { name: "Rising Driver" }, tilt: { label: "Mid-Tilt Barrel" }, summary: { totalSwings: 40, reportCount: 2 } });
    expect(model.summary?.metrics.find(metric => metric.key === "blast_attack_angle")?.peak).toBe(80);
    expect({ readings, cards }).toEqual(before);
  });

  it("does not replace missing Fall averages with a P95-only report or another device", () => {
    const readings = [...report({ kind: "p95" }), ...report({ hash: "b" }).map(reading => ({ ...reading, source: "Full Swing · Practice" }))];
    expect(hitterSwingProfile(readings, performance())).toMatchObject({ averageBatSpeed: null, attackAngle: null, verticalBatAngle: null, path: null, tilt: null, summary: { totalSwings: null } });
    expect(hitterSwingProfile([], performance())).toMatchObject({ summary: null, averageBatSpeed: null, attackAngle: null, verticalBatAngle: null, height: null, weight: null });
  });

  it("withholds only an angle missing from a contributing Average report", () => {
    const readings = [...report(), ...report({ hash: "b", start: "2026-09-08", end: "2026-09-14", attack: 20, vertical: -40 }).filter(reading => reading.metric !== "Attack Angle")];
    expect(hitterSwingProfile(readings, performance())).toMatchObject({ averageBatSpeed: 65, attackAngle: null, path: null, verticalBatAngle: -30, tilt: { key: "mid" }, summary: { totalSwings: 20, issues: [] } });
  });

  it.each([
    { issue: "overlapping_periods", readings: [...report(), ...report({ hash: "b", start: "2026-09-07", end: "2026-09-14" })] },
    { issue: "duplicate_reports", readings: [...report(), ...report({ hash: "b" })] },
    { issue: "missing_counts", readings: report().filter(reading => reading.metric !== "Blast Swing Count") },
    { issue: "multiple_players", readings: [...report(), ...report({ hash: "b", athleteCode: "SYN-SWING-002" })] },
    { issue: "conflicting_observations", readings: [...report(), { ...report()[1], value: 30 }] },
  ])("withholds angles and custom labels for $issue", ({ issue, readings }) => {
    const model = hitterSwingProfile(readings, performance());
    expect(model.summary?.issues).toContain(issue);
    expect(model).toMatchObject({ averageBatSpeed: null, attackAngle: null, verticalBatAngle: null, path: null, tilt: null });
  });

  it("withholds impossible display angles while preserving their recorded summary values", () => {
    const readings = report({ attack: 91, vertical: -91 });
    const model = hitterSwingProfile(readings, performance());
    expect(model).toMatchObject({ averageBatSpeed: 65, attackAngle: null, verticalBatAngle: null, path: null, tilt: null });
    expect(model.summary?.metrics.find(metric => metric.key === "blast_attack_angle")?.average).toBe(91);
    expect(model.summary?.metrics.find(metric => metric.key === "blast_vertical_bat_angle")?.average).toBe(-91);
    expect(readings.find(reading => reading.metric === "Attack Angle")?.value).toBe(91);
  });

  it("withholds nonfinite or invalid-unit angles rather than manufacturing zero", () => {
    const readings = report({ attack: NaN }).map(reading => reading.metric === "Vertical Bat Angle" ? { ...reading, unit: "rad" } : reading);
    expect(hitterSwingProfile(readings, performance())).toMatchObject({ attackAngle: null, verticalBatAngle: null, path: null, tilt: null });
  });

  it("deduplicates identical observations and retains full angle precision", () => {
    const readings = report({ attack: 9.9999, vertical: -20.0001 });
    expect(hitterSwingProfile([...readings, ...readings], performance())).toMatchObject({ attackAngle: 9.9999, verticalBatAngle: -20.0001, path: { key: "flat" }, tilt: { key: "mid" }, summary: { totalSwings: 10 } });
  });

  it("retains a verified bat-speed average independently of missing angle geometry", () => {
    const readings = report({ speed: 65.123456789 }).filter(reading => !["Attack Angle", "Vertical Bat Angle"].includes(reading.metric));
    expect(hitterSwingProfile(readings, performance())).toMatchObject({ averageBatSpeed: 65.123456789, attackAngle: null, verticalBatAngle: null, path: null, tilt: null });
  });

  it.each([-1, NaN, Infinity, -Infinity])("withholds invalid bat-speed averages %s", speed => {
    expect(hitterSwingProfile(report({ speed }), performance()).averageBatSpeed).toBeNull();
  });

  it("preserves zero bat speed and withholds incomplete cumulative speed instead of using P95", () => {
    expect(hitterSwingProfile(report({ speed: 0 }), performance()).averageBatSpeed).toBe(0);
    const readings = [...report(), ...report({ hash: "b", start: "2026-09-08", end: "2026-09-14" }).filter(reading => reading.metric !== "Average Bat Speed"),
      ...report({ hash: "c", start: "2026-09-08", end: "2026-09-14", kind: "p95", speed: 98 })];
    const model = hitterSwingProfile(readings, performance());
    expect(model.averageBatSpeed).toBeNull();
    expect(model.attackAngle).toBe(4);
    expect(model.summary?.metrics.find(metric => metric.key === "avg_bat_speed")).toMatchObject({ average: null, peak: 98, missingReports: 1 });
  });

  it.each([
    { height: 71, heightUnit: "in", inches: 71, weight: 180, weightUnit: "lb", pounds: 180 },
    { height: 180.34, heightUnit: "cm", inches: 71, weight: 85, weightUnit: "kg", pounds: 85 * 2.20462262185 },
    { height: 71, heightUnit: "in", inches: 71, weight: 13, weightUnit: "st", pounds: 182 },
  ])("normalizes body units $heightUnit/$weightUnit only for display matching and retains actual dates", ({ height, heightUnit, inches, weight, weightUnit, pounds }) => {
    const cards = performance([body("Height", height, heightUnit), body("Weight", weight, weightUnit, "2026-09-18")]);
    const model = hitterSwingProfile(report(), cards);
    expect(model.height?.value).toBeCloseTo(inches, 10);
    expect(model.height).toMatchObject({ unit: "in", date: "2026-08-20" });
    expect(model.weight?.value).toBeCloseTo(pounds, 10);
    expect(model.weight).toMatchObject({ unit: "lb", date: "2026-09-18" });
  });

  it("uses canonical latest body readings and never falls back to an older result", () => {
    const cards = performance([body("Height", 70, "in"), body("Height", 71, "in", "2026-09-18"), body("Weight", 180, "lb")]);
    expect(hitterSwingProfile(report(), cards).height).toEqual({ value: 71, unit: "in", date: "2026-09-18" });
    cards.body.find(card => card.metric.key === "height")!.latest = null;
    expect(hitterSwingProfile(report(), cards).height).toBeNull();
  });

  it.each([0, -1, NaN, Infinity])("rejects nonpositive or nonfinite canonical body readings %s", value => {
    const cards = performance([body("Height", 71, "in"), body("Weight", 180, "lb")]);
    for (const key of ["height", "weight"]) cards.body.find(card => card.metric.key === key)!.latest!.value = value;
    expect(hitterSwingProfile(report(), cards)).toMatchObject({ height: null, weight: null });
  });

  it("rejects unsupported body units and conversion overflow", () => {
    const cards = performance([body("Height", 71, "in"), body("Weight", 180, "lb")]);
    cards.body.find(card => card.metric.key === "height")!.latest!.unit = "ft";
    Object.assign(cards.body.find(card => card.metric.key === "weight")!.latest!, { value: Number.MAX_VALUE, unit: "st" });
    expect(hitterSwingProfile(report(), cards)).toMatchObject({ height: null, weight: null });
  });

  it("never combines another athlete's canonical body cards with a Blast report", () => {
    const otherCode = "SYN-SWING-002";
    const cards = performance([body("Height", 75, "in", "2026-09-18", otherCode), body("Weight", 210, "lb", "2026-09-18", otherCode)], otherCode);
    expect(hitterSwingProfile(report(), cards)).toMatchObject({ averageBatSpeed: null, attackAngle: null, verticalBatAngle: null, path: null, tilt: null, height: null, weight: null });
  });

  it("rejects mixed-athlete body cards even when no Blast report is available", () => {
    const cards: PlayerPerformance = performance([body("Height", 71, "in"), body("Weight", 180, "lb")]);
    cards.body.find(card => card.metric.key === "weight")!.latest!.athleteCode = "SYN-SWING-002";
    expect(hitterSwingProfile([], cards)).toMatchObject({ summary: null, height: null, weight: null });
  });
});
