import { describe, expect, it } from "vitest";
import type { Measurement } from "@/lib/imports/engine";
import type { ImportBatch } from "@/lib/local-workspace";
import {
  PLAYER_METRICS, getPlayerMetricReadings, getPlayerPerformance, normalizePlayerMetric, validatePlayerMetricValue,
  type PlayerMetricKey, type PlayerPercentileOverride,
} from "@/lib/player-performance";

// Fictional, generated observations only. No real reports, players, requests or storage.
const hash = (letter = "a") => letter.repeat(64);
const athlete = (n: number) => `SYN-${String(n).padStart(3, "0")}`;
const reading = (change: Partial<Measurement> = {}): Measurement => ({
  id: "fictional-observation", athlete_code: athlete(1), metric: "Max EV", value: 10, unit: "mph",
  measured_at: "2026-09-12", source: "Fictional hitting test", source_file: "fictional.csv", source_sheet: "Values",
  source_row: 2, file_hash: hash(), ...change,
});
const batch = (fileHash: string, importedAt: string): ImportBatch => ({
  id: `fictional-${fileHash}`, kind: "measurements", fileHash, importedAt, source: "Fictional hitting test",
  fileName: "fictional.csv", created: 1, updated: 0, unchanged: 0,
});
const report = (change: Partial<Measurement> = {}) => reading({ source: "RENPHO", source_file: "fictional-report.pdf", source_sheet: "RENPHO report · Page 1", ...change });
const own = (readings: Measurement[], batches: ImportBatch[] = []) => getPlayerMetricReadings(readings, batches, athlete(1));
function card(readings: Measurement[], key: PlayerMetricKey, options: Partial<Parameters<typeof getPlayerPerformance>[0]> = {}) {
  const model = getPlayerPerformance({ readings, athleteCode: athlete(1), ...options });
  return Object.values(model).flat().find(row => row.metric.key === key)!;
}
const peers = (values: number[], change: Partial<Measurement> = {}) => values.map((value, index) => reading({
  ...change, id: `fictional-${index}`, athlete_code: athlete(index + 1), value,
}));
const cohort = (count = 5) => Array.from({ length: count }, (_, i) => athlete(i + 1));

describe("canonical player metric catalog", () => {
  it("defines exactly the requested ordered groups and directions", () => {
    expect(PLAYER_METRICS.filter(metric => metric.group === "body").map(metric => metric.key)).toEqual(["height", "weight", "grip_strength", "body_fat_pct", "muscle_mass_pct"]);
    expect(PLAYER_METRICS.filter(metric => metric.group === "hitting")).toHaveLength(11);
    expect(PLAYER_METRICS.filter(metric => metric.group === "pitching")).toHaveLength(6);
    expect(new Set(PLAYER_METRICS.map(metric => metric.key)).size).toBe(24);
    expect(PLAYER_METRICS.filter(metric => metric.direction === "neutral").map(metric => metric.key)).toEqual(["height", "weight", "body_fat_pct", "muscle_mass_pct", "avg_fastball_spin"]);
    expect(PLAYER_METRICS.find(metric => metric.key === "bb_pct")?.direction).toBe("lower");
  });
  it.each([
    ["Body Fat Percentage", "%", "body_fat_pct", "%"], ["Muscle Mass Percentage", "percent", "muscle_mass_pct", "%"],
    ["Max Exit Velocity", "MPH", "max_exit_velocity", "mph"], ["Avg EV", "mph", "avg_exit_velocity", "mph"],
    ["Home1st", "sec", "home_to_first", "s"], ["Home2nd", "seconds", "home_to_second", "s"],
    ["BoxerT", "s", "boxer_t", "s"], ["Max Velo", "km/h", "max_pitch_velocity", "km/h"],
    ["Average Fastball Spin Rate", "rpm", "avg_fastball_spin", "rpm"], ["K%", "%", "k_pct", "%"],
    ["BB%", "%", "bb_pct", "%"], ["weight", "lbs", "weight", "lb"], ["height", "inches", "height", "in"],
  ])("normalizes explicit alias %s with %s without converting values", (label, unit, key, normalizedUnit) => {
    expect(normalizePlayerMetric(label, unit)).toEqual({ key, unit: normalizedUnit });
  });
  it("resolves canonical keys, rejects generic/unknown labels and never equates skeletal muscle with muscle mass", () => {
    for (const metric of PLAYER_METRICS) expect(normalizePlayerMetric(metric.key, metric.units[0])).toEqual({ key: metric.key, unit: metric.units[0] });
    for (const [label, unit] of [["Exit Velocity", "mph"], ["Spin Rate", "rpm"], ["Skeletal Muscle Percentage", "%"], ["Muscle Mass", "lb"], ["Max EV", ""], ["Weight", "mph"], ["constructor", "%"], ["__proto__", "%"], ["K", "count"]]) expect(normalizePlayerMetric(label, unit)).toBeNull();
  });
  it("uses finite mathematical bounds and retains meaningful zero values", () => {
    for (const value of [Number.NaN, Infinity, -Infinity, -1]) expect(validatePlayerMetricValue("max_exit_velocity", value, "mph")).toBe(false);
    expect(validatePlayerMetricValue("max_exit_velocity", 0, "mph")).toBe(true);
    expect(validatePlayerMetricValue("max_exit_velocity", Number.MAX_VALUE, "mph")).toBe(true);
    expect(validatePlayerMetricValue("body_fat_pct", 0, "%")).toBe(true);
    expect(validatePlayerMetricValue("body_fat_pct", 100, "%")).toBe(true);
    expect(validatePlayerMetricValue("body_fat_pct", 100.01, "%")).toBe(false);
    for (const [key, unit] of [["height", "in"], ["weight", "kg"], ["home_to_first", "s"]] as const) expect(validatePlayerMetricValue(key, 0, unit)).toBe(false);
    expect(validatePlayerMetricValue("avg_fastball_spin", 0, "rpm")).toBe(true);
    expect(validatePlayerMetricValue("weight", 10, "lbs")).toBe(false); // Normalize aliases first.
  });
  it("keeps generic bat speed distinct from maximum and average, with no derived smash factor", () => {
    const result = getPlayerPerformance({ readings: [reading({ metric: "Bat Speed", value: 70 })], athleteCode: athlete(1) });
    expect(result.hitting.find(item => item.metric.key === "bat_speed")?.latest?.value).toBe(70);
    for (const key of ["max_bat_speed", "avg_bat_speed", "smash_factor"]) expect(result.hitting.find(item => item.metric.key === key)?.latest).toBeNull();
    for (const label of ["Grip", "Throwing Velocity", "Distance", "Average", "Max"]) expect(normalizePlayerMetric(label, "mph")).toBeNull();
  });
  it.each([
    ["Grip Strength", "N", "grip_strength"], ["Maximum Bat Speed", "mph", "max_bat_speed"],
    ["Avg Bat Speed", "mph", "avg_bat_speed"], ["Smash Factor", "ratio", "smash_factor"],
    ["Max Distance", "ft", "max_distance"], ["Average Pitch Velocity", "mph", "avg_pitch_velocity"],
    ["Infield Throwing Velocity", "mph", "infield_velocity"], ["Outfield Velo", "km/h", "outfield_velocity"],
  ])("retains explicit %s observations and their original %s units", (metric, unit, key) => {
    const result = own([reading({ metric, unit, value: 42 })]);
    expect(result[0]).toMatchObject({ metricKey: key, unit, value: 42, measuredAt: "2026-09-12" });
    expect(result[0].derived).toBe(false);
  });
  it("keeps throwing tests in Fall and never uses an infield result as a pitch velocity", () => {
    const input = [reading({ metric: "Infield Velocity", value: 84 }), reading({ metric: "Outfield Velocity", id: "fictional-of", measured_at: "2026-08-09", value: 90 })];
    const model = getPlayerPerformance({ readings: input, athleteCode: athlete(1) });
    expect(model.throwing.find(item => item.metric.key === "infield_velocity")?.latest?.value).toBe(84);
    expect(model.throwing.find(item => item.metric.key === "outfield_velocity")?.latest).toBeNull();
    expect(model.pitching.find(item => item.metric.key === "max_pitch_velocity")?.latest).toBeNull();
  });
});

describe("profile observations and fixed date windows", () => {
  it("isolates exact athlete identity and retains untouched provenance", () => {
    const first = reading();
    const input = [first, reading({ athlete_code: athlete(2) })];
    const result = own(input);
    expect(result).toHaveLength(1); expect(result[0].provenance[0]).toBe(first);
    expect(getPlayerMetricReadings(input, [], "syn-001")).toEqual([]);
    expect(getPlayerMetricReadings(input, [], "")).toEqual([]);
    expect(input).toEqual([first, reading({ athlete_code: athlete(2) })]);
  });
  it("includes Sep1–Dec31 baseball only, rejects invalid calendar dates and excludes summer baseball", () => {
    const dates = ["2026-08-31", "2026-09-01", "2026-12-31", "2027-01-01", "2026-09-31", "2026-2-01", "2026-09-01T00:00:00Z"];
    const result = own(dates.map((measured_at, i) => reading({ measured_at, id: `fictional-date-${i}` })));
    expect(result.map(item => item.measuredAt)).toEqual(["2026-12-31", "2026-09-01"]);
    expect(result.every(item => item.period === "fall_2026")).toBe(true);
  });
  it("keeps a Jun1–Aug31 body baseline, shows its own date and never pools it with Fall", () => {
    const rows = ["2026-05-31", "2026-06-01", "2026-08-31", "2026-09-01"].map((measured_at, i) => reading({ metric: "Weight", unit: "kg", measured_at, id: `fictional-body-${i}` }));
    const result = card(rows, "weight");
    expect(result.latest?.measuredAt).toBe("2026-09-01");
    expect(result.summerBaseline?.measuredAt).toBe("2026-08-31");
    expect(result.history.map(item => item.measuredAt)).toEqual(["2026-06-01", "2026-08-31", "2026-09-01"]);
    expect(card(rows.slice(0, 3), "weight").latest?.period).toBe("summer_2026");
  });
  it("retains individual tests/units and sorts tied dates by import time, hash then ID", () => {
    const rows = [reading({ id: "fictional-z", file_hash: hash("b"), unit: "km/h" }), reading({ id: "fictional-b" }), reading({ id: "fictional-a" })];
    const old = batch(hash("b"), "2026-09-13T00:00:00Z");
    const recent = batch(hash(), "2026-09-14T00:00:00Z");
    const result = card(rows, "max_exit_velocity", { batches: [old, recent] });
    expect(result.latest?.id).toBe("fictional-a");
    expect(result.history.map(item => item.id)).toEqual(["fictional-z", "fictional-b", "fictional-a"]);
    expect(new Set(result.history.map(item => item.unit)).size).toBe(2);
    expect(own([...rows].reverse(), [recent, old])).toEqual(own(rows, [old, recent]));
  });
  it("omits invalid values and duplicate observation IDs without mutating or fabricating measurements", () => {
    const rows = [reading(), reading(), reading({ id: "fictional-negative", value: -10 }), reading({ id: "fictional-nan", value: NaN })];
    expect(own(rows)).toEqual([]);
    const result = card(rows, "max_exit_velocity");
    expect(result.latest).toBeNull(); expect(result.percentileStatus).toBe("missing");
    expect(result.history).toEqual([]);
    expect(card([], "avg_exit_velocity").latest).toBeNull();
  });
  it("uses each stored observation's batch timestamp so a later partial import cannot reorder old readings", () => {
    const rows = [{ ...reading({ id: "fictional-old" }), batch_id: "fictional-old-batch" },
      { ...reading({ id: "fictional-latest", file_hash: hash("b") }), batch_id: "fictional-current-batch" }];
    const batches = [{ ...batch(hash(), "2026-09-13T00:00:00Z"), id: "fictional-old-batch" },
      { ...batch(hash("b"), "2026-09-14T00:00:00Z"), id: "fictional-current-batch" },
      { ...batch(hash(), "2026-09-15T00:00:00Z"), id: "fictional-unrelated-later-batch" }];
    expect(card(rows, "max_exit_velocity", { batches }).latest?.id).toBe("fictional-latest");
  });
  it("does not derive averages or rate percentages from count-like or other metric readings", () => {
    const result = getPlayerPerformance({ readings: [reading(), reading({ id: "fictional-k", metric: "K", unit: "count" })], athleteCode: athlete(1) });
    expect(result.hitting.find(item => item.metric.key === "avg_exit_velocity")?.latest).toBeNull();
    expect(result.pitching.find(item => item.metric.key === "k_pct")?.latest).toBeNull();
  });
});

describe("same-report muscle mass percentage", () => {
  const pair = () => [report({ id: "fictional-weight", metric: "Weight", unit: "kg", value: 10 }), report({ id: "fictional-muscle", metric: "Muscle Mass", unit: "kg", value: 4, source_row: 7 })];
  it("derives exact ratio only from same report/unit and preserves both source readings", () => {
    const rows = pair();
    const result = card(rows, "muscle_mass_pct").latest!;
    expect(result.value).toBe(40); expect(result.unit).toBe("%"); expect(result.derived).toBe(true);
    expect(result.provenance).toEqual(rows); expect(result.provenance[0]).toBe(rows[0]);
    expect(result.derivation).toContain("same report and unit");
    expect(card([rows[0], { ...rows[1], value: 0 }], "muscle_mass_pct").latest?.value).toBe(0);
  });
  it.each([
    { file_hash: hash("b") }, { measured_at: "2026-09-13" }, { athlete_code: athlete(2) }, { unit: "lb" },
    { source: "Other source" }, { source_sheet: "CSV" }, { value: 11 }, { value: -1 }, { value: Infinity },
  ])("refuses mismatched or invalid contributing measurement %j", change => {
    const [weight, muscle] = pair();
    expect(card([weight, { ...muscle, ...change }], "muscle_mass_pct").latest).toBeNull();
  });
  it("does not cross-fill missing reports, divide by zero, or let invalid duplicates pick a winner", () => {
    const [weight, muscle] = pair();
    for (const rows of [[weight], [muscle], [{ ...weight, value: 0 }, muscle], [weight, muscle, { ...weight, id: "fictional-duplicate", value: -1 }], [weight, muscle, { ...muscle, id: "fictional-duplicate" }]]) expect(card(rows, "muscle_mass_pct").latest).toBeNull();
    expect(card([weight, muscle, { ...weight, id: "fictional-alias", metric: "Body Weight" }], "muscle_mass_pct").latest).toBeNull();
    expect(card([weight, muscle, { ...weight, id: "fictional-lb-weight", unit: "lb" }, { ...muscle, id: "fictional-lb-muscle", unit: "lb" }], "muscle_mass_pct").latest).toBeNull();
  });
  it("prefers explicit muscle percentage and treats duplicate aliases as ambiguous even if equal", () => {
    const measured = report({ id: "fictional-measured", metric: "Muscle Mass Percentage", value: 42, unit: "%" });
    expect(card([...pair(), measured], "muscle_mass_pct").latest).toMatchObject({ value: 42, derived: false });
    expect(card([...pair(), measured, { ...measured, id: "fictional-duplicate", metric: "muscle_mass_pct" }], "muscle_mass_pct").latest).toBeNull();
    expect(card([...pair(), { ...measured, value: 101 }], "muscle_mass_pct").latest).toBeNull();
  });
  it("keeps finite ratios at numeric extremes instead of multiplying a mass first", () => {
    const [weight, muscle] = pair();
    expect(card([{ ...weight, value: Number.MAX_VALUE }, { ...muscle, value: Number.MAX_VALUE / 2 }], "muscle_mass_pct").latest?.value).toBe(50);
  });
});

describe("observed Pacific cohort comparisons", () => {
  it("requires an explicit cohort and five comparable athletes, without fabricating missing rows", () => {
    expect(card(peers([1, 2, 3, 4, 5]), "max_exit_velocity").cohortSampleSize).toBeNull();
    const small = card(peers([1, 2, 3, 4]), "max_exit_velocity", { cohortAthleteCodes: cohort() });
    expect(small.percentile).toBeNull(); expect(small.cohortSampleSize).toBe(4); expect(small.percentileStatus).toBe("small_cohort");
    const excluded = card(peers([1, 2, 3, 4, 5]), "max_exit_velocity", { cohortAthleteCodes: cohort().slice(1) });
    expect(excluded.percentileStatus).toBe("not_in_cohort");
  });
  it("uses the latest observation for each athlete, not every test or a repeated cohort entry", () => {
    const rows = [...peers([10, 20, 30, 40, 50]), reading({ id: "fictional-old", athlete_code: athlete(2), value: 0, measured_at: "2026-09-01" }), reading({ id: "fictional-new", athlete_code: athlete(2), value: 5, measured_at: "2026-09-20" })];
    const result = card(rows, "max_exit_velocity", { cohortAthleteCodes: [...cohort(), athlete(2)] });
    expect(result.percentile).toMatchObject({ value: 25, sampleSize: 5, direction: "higher" });
  });
  it("does not mix units, sources, seasons or unlisted athletes, but normalizes source whitespace/case", () => {
    const rows = peers([10, 20, 30, 40, 50]);
    const options = { cohortAthleteCodes: cohort(6) };
    for (const change of [{ unit: "km/h" }, { source: "Different test" }, { measured_at: "2026-08-31" }, { measured_at: "2027-09-12" }]) {
      const result = card([...rows.slice(0, 4), { ...rows[4], ...change }, reading({ id: "fictional-unlisted", athlete_code: athlete(99) })], "max_exit_velocity", options);
      expect(result.cohortSampleSize).toBe(4); expect(result.percentile).toBeNull();
    }
    expect(card([...rows.slice(0, 4), { ...rows[4], source: "  FICTIONAL   HITTING TEST " }], "max_exit_velocity", options).cohortSampleSize).toBe(5);
  });
  it("keeps body summer and Fall cohorts separate", () => {
    const rows = peers([10, 20, 30, 40, 50], { metric: "Weight", unit: "kg", measured_at: "2026-07-10" });
    const summer = card(rows, "weight", { cohortAthleteCodes: cohort() });
    expect(summer.percentile).toMatchObject({ period: "summer_2026", sampleSize: 5, direction: "neutral" });
    const fall = card([...rows, reading({ id: "fictional-fall", metric: "Weight", unit: "kg" })], "weight", { cohortAthleteCodes: cohort() });
    expect(fall.latest?.period).toBe("fall_2026"); expect(fall.cohortSampleSize).toBe(1); expect(fall.percentile).toBeNull();
  });
  it("uses tied midranks, keeps all-equal peers at 50 and reverses lower-is-better metrics", () => {
    expect(card(peers([20, 10, 20, 30, 40]), "max_exit_velocity", { cohortAthleteCodes: cohort() }).percentile?.value).toBe(37.5);
    expect(card(peers([10, 10, 10, 10, 10]), "max_exit_velocity", { cohortAthleteCodes: cohort() }).percentile?.value).toBe(50);
    expect(card(peers([1, 2, 3, 4, 5], { metric: "Home1st", unit: "s" }), "home_to_first", { cohortAthleteCodes: cohort() }).percentile).toMatchObject({ value: 100, direction: "lower" });
    expect(card(peers([0, 10, 20, 30, 40], { metric: "BB%", unit: "%" }), "bb_pct", { cohortAthleteCodes: cohort() }).percentile?.value).toBe(100);
    expect(card(peers([50, 20, 30, 40, 10], { metric: "Average Fastball Spin", unit: "rpm" }), "avg_fastball_spin", { cohortAthleteCodes: cohort() }).percentile).toMatchObject({ value: 100, direction: "neutral" });
  });
  it("preserves valid zero percentiles and finite results for extreme values", () => {
    expect(card(peers([0, 1, 2, 3, Number.MAX_VALUE]), "max_exit_velocity", { cohortAthleteCodes: cohort() }).percentile?.value).toBe(0);
    expect(card(peers([Number.MAX_VALUE, 1, 2, 3, 4]), "max_exit_velocity", { cohortAthleteCodes: cohort() }).percentile?.value).toBe(100);
  });
});

describe("server-provided aggregate overlays without peer readings", () => {
  const overlay = (changes: Partial<PlayerPercentileOverride> = {}): PlayerPercentileOverride => ({
    athleteCode: athlete(1), metricKey: "max_exit_velocity", measuredAt: "2026-09-12", observedValue: 10,
    value: 75, sampleSize: 9, period: "fall_2026", unit: "mph", source: "Fictional hitting test", direction: "higher", ...changes,
  });
  it("attaches an exactly matched server percentile while receiving only the owner's observation", () => {
    const result = card([reading()], "max_exit_velocity", { percentileOverrides: [overlay()] });
    expect(result.percentile).toMatchObject({ value: 75, sampleSize: 9 }); expect(result.history).toHaveLength(1);
    expect(result.percentileStatus).toBe("available");
  });
  it("displays a verified small cohort size without a percentile bar", () => {
    const result = card([reading()], "max_exit_velocity", { percentileOverrides: [overlay({ value: null, sampleSize: 3 })] });
    expect(result.percentile).toBeNull(); expect(result.cohortSampleSize).toBe(3); expect(result.percentileStatus).toBe("small_cohort");
  });
  it.each([
    { athleteCode: athlete(2) }, { metricKey: "avg_exit_velocity" as const }, { measuredAt: "2026-09-13" }, { observedValue: 11 },
    { unit: "km/h" }, { period: "summer_2026" as const }, { source: "Different test" }, { direction: "lower" as const },
    { sampleSize: 4 }, { sampleSize: -1 }, { sampleSize: 5.5 }, { value: 101 }, { value: NaN },
  ])("rejects stale, mismatched or invalid overlay %j", changes => {
    const result = card([reading()], "max_exit_velocity", { percentileOverrides: [overlay(changes)] });
    expect(result.percentile).toBeNull(); expect(result.cohortSampleSize).toBeNull();
  });
  it("rejects ambiguous duplicate overlays and never grants an observation from an overlay alone", () => {
    expect(card([reading()], "max_exit_velocity", { percentileOverrides: [overlay(), overlay()] }).percentile).toBeNull();
    expect(card([], "max_exit_velocity", { percentileOverrides: [overlay()] }).latest).toBeNull();
  });
});
