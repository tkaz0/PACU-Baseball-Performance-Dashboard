import type { Measurement } from "@/lib/imports/engine";
import type { ImportBatch } from "@/lib/local-workspace";
import { getRenphoChartReadings, getRenphoReports } from "@/lib/renpho-charts";

export type PlayerMetricGroup = "body" | "hitting" | "pitching";
export type PlayerMetricDirection = "neutral" | "higher" | "lower";
export type PlayerMetricKey = "height" | "weight" | "body_fat_pct" | "muscle_mass_pct"
  | "max_exit_velocity" | "avg_exit_velocity" | "bat_speed" | "home_to_first" | "home_to_second" | "steal_break" | "boxer_t"
  | "max_pitch_velocity" | "avg_fastball_spin" | "strike_pct" | "k_pct" | "bb_pct";
export type PlayerMetricDefinition = {
  key: PlayerMetricKey; label: string; group: PlayerMetricGroup;
  units: readonly string[]; direction: PlayerMetricDirection;
};

export const PLAYER_METRICS: readonly PlayerMetricDefinition[] = [
  { key: "height", label: "Height", group: "body", units: ["in", "cm"], direction: "neutral" },
  { key: "weight", label: "Weight", group: "body", units: ["lb", "kg", "st"], direction: "neutral" },
  { key: "body_fat_pct", label: "Body fat %", group: "body", units: ["%"], direction: "neutral" },
  { key: "muscle_mass_pct", label: "Muscle mass %", group: "body", units: ["%"], direction: "neutral" },
  { key: "max_exit_velocity", label: "Max EV", group: "hitting", units: ["mph", "km/h", "m/s"], direction: "higher" },
  { key: "avg_exit_velocity", label: "Average EV", group: "hitting", units: ["mph", "km/h", "m/s"], direction: "higher" },
  { key: "bat_speed", label: "Bat speed", group: "hitting", units: ["mph", "km/h", "m/s"], direction: "higher" },
  { key: "home_to_first", label: "Home to 1st", group: "hitting", units: ["s"], direction: "lower" },
  { key: "home_to_second", label: "Home to 2nd", group: "hitting", units: ["s"], direction: "lower" },
  { key: "steal_break", label: "Steal break", group: "hitting", units: ["s"], direction: "lower" },
  { key: "boxer_t", label: "Boxer T", group: "hitting", units: ["s"], direction: "lower" },
  { key: "max_pitch_velocity", label: "Max velocity", group: "pitching", units: ["mph", "km/h", "m/s"], direction: "higher" },
  { key: "avg_fastball_spin", label: "Average fastball spin", group: "pitching", units: ["rpm"], direction: "neutral" },
  { key: "strike_pct", label: "Strike %", group: "pitching", units: ["%"], direction: "higher" },
  { key: "k_pct", label: "K %", group: "pitching", units: ["%"], direction: "higher" },
  { key: "bb_pct", label: "BB %", group: "pitching", units: ["%"], direction: "lower" },
];

export const PLAYER_PERFORMANCE_PERIODS = {
  fall_2026: { label: "Fall 2026 · Sep 1–Dec 31", start: "2026-09-01", end: "2026-12-31" },
  summer_2026: { label: "Summer 2026 baseline · Jun 1–Aug 31", start: "2026-06-01", end: "2026-08-31" },
} as const;
export type PlayerPerformancePeriod = keyof typeof PLAYER_PERFORMANCE_PERIODS;
export type PlayerMetricReading = {
  id: string; athleteCode: string; metricKey: PlayerMetricKey; value: number; unit: string;
  measuredAt: string; period: PlayerPerformancePeriod; source: string; importedAt: string;
  provenance: readonly Measurement[]; derived: boolean; derivation?: string;
};
export type PlayerPercentile = {
  value: number; sampleSize: number; period: PlayerPerformancePeriod; unit: string; direction: PlayerMetricDirection;
};
export type PlayerPercentileOverride = Omit<PlayerPercentile, "value"> & {
  value: number | null; athleteCode: string; metricKey: PlayerMetricKey; measuredAt: string;
  observedValue: number; source: string;
};
export type PlayerMetricCard = {
  metric: PlayerMetricDefinition; latest: PlayerMetricReading | null; summerBaseline: PlayerMetricReading | null;
  history: PlayerMetricReading[]; percentile: PlayerPercentile | null; cohortSampleSize: number | null;
  percentileStatus: "available" | "missing" | "small_cohort" | "not_in_cohort" | "unavailable";
};
export type PlayerPerformance = Record<PlayerMetricGroup, PlayerMetricCard[]>;
export type PlayerPerformanceInput = {
  readings: readonly Measurement[]; batches?: readonly ImportBatch[]; athleteCode: string;
  cohortAthleteCodes?: readonly string[]; percentileOverrides?: readonly PlayerPercentileOverride[];
};

const definitions = new Map(PLAYER_METRICS.map(metric => [metric.key, metric]));
const labelKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9%]/g, "");
const sourceKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const aliases = new Map<string, PlayerMetricKey>();
for (const metric of PLAYER_METRICS) for (const label of [metric.key, metric.label]) aliases.set(labelKey(label), metric.key);
const extraAliases: Record<PlayerMetricKey, readonly string[]> = {
  height: ["Body height"], weight: ["Body weight"],
  body_fat_pct: ["Body Fat Percentage", "Body Fat Percent"],
  muscle_mass_pct: ["Muscle Mass Percentage", "Muscle Mass Percent"],
  max_exit_velocity: ["Maximum Exit Velocity", "Max Exit Velocity", "Max Exit Velo", "Maximum EV"],
  avg_exit_velocity: ["Average Exit Velocity", "Avg Exit Velocity", "Avg EV", "Average Exit Velo"],
  bat_speed: ["Bat Speed"], home_to_first: ["Home1st", "Home 1st", "Home to First", "Home to 1st Time"],
  home_to_second: ["Home2nd", "Home 2nd", "Home to Second", "Home to 2nd Time"],
  steal_break: ["Steal Break Time"], boxer_t: ["BoxerT", "Boxer T Time"],
  max_pitch_velocity: ["Max Velo", "Max Pitch Velocity", "Maximum Pitch Velocity", "Maximum Velocity"],
  avg_fastball_spin: ["Avg Fastball Spin", "Average Fastball Spin Rate", "Avg Fastball Spin Rate"],
  strike_pct: ["Strike Percentage", "Strike Percent", "Strike Rate"],
  k_pct: ["K Percentage", "Strikeout %", "Strikeout Percentage", "Strikeout Rate"],
  bb_pct: ["BB Percentage", "Walk %", "Walk Percentage", "Walk Rate"],
};
for (const [key, labels] of Object.entries(extraAliases)) for (const label of labels) aliases.set(labelKey(label), key as PlayerMetricKey);
const unitAliases = new Map([
  ["in", "in"], ["inch", "in"], ["inches", "in"], ["cm", "cm"],
  ["lb", "lb"], ["lbs", "lb"], ["kg", "kg"], ["st", "st"],
  ["%", "%"], ["percent", "%"], ["mph", "mph"], ["km/h", "km/h"], ["m/s", "m/s"],
  ["s", "s"], ["sec", "s"], ["seconds", "s"], ["rpm", "rpm"],
]);

/** Explicit label/unit aliases only. Generic velocity/spin and unitless values stay unresolved. */
export function normalizePlayerMetric(metric: string, unit: string): { key: PlayerMetricKey; unit: string } | null {
  const normalizedUnit = unitAliases.get(unit.trim().toLowerCase());
  const key = aliases.get(labelKey(metric)) ?? (labelKey(metric) === "musclemass" && normalizedUnit === "%" ? "muscle_mass_pct" : undefined);
  return key && normalizedUnit && definitions.get(key)?.units.includes(normalizedUnit) ? { key, unit: normalizedUnit } : null;
}

/** Mathematical bounds, without invented athletic/medical reference ranges. */
export function validatePlayerMetricValue(key: PlayerMetricKey, value: number, unit: string): boolean {
  const definition = definitions.get(key);
  if (!definition?.units.includes(unit) || !Number.isFinite(value) || value < 0) return false;
  if (unit === "%") return value <= 100;
  if (key === "height" || key === "weight" || unit === "s") return value > 0;
  return true;
}

function periodFor(date: string, group: PlayerMetricGroup): PlayerPerformancePeriod | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) return null;
  for (const period of ["fall_2026", ...(group === "body" ? ["summer_2026"] : [])] as PlayerPerformancePeriod[]) {
    const window = PLAYER_PERFORMANCE_PERIODS[period];
    if (date >= window.start && date <= window.end) return period;
  }
  return null;
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const newestFirst = (a: PlayerMetricReading, b: PlayerMetricReading) => compare(b.measuredAt, a.measuredAt)
  || compare(b.importedAt, a.importedAt) || compare(a.provenance[0]?.file_hash ?? "", b.provenance[0]?.file_hash ?? "") || compare(a.id, b.id);

/** Normalize one athlete's eligible observations, retaining original objects as provenance. */
export function getPlayerMetricReadings(readings: readonly Measurement[], batches: readonly ImportBatch[], athleteCode: string): PlayerMetricReading[] {
  if (!athleteCode) return [];
  const own = readings.filter(reading => reading.athlete_code === athleteCode);
  const idCounts = new Map<string, number>();
  for (const reading of own) idCounts.set(reading.id, (idCounts.get(reading.id) ?? 0) + 1);
  const imported = new Map<string, string>();
  const importedByBatch = new Map<string, string>();
  for (const batch of batches) {
    if (batch.kind !== "measurements" || !batch.fileHash || !Number.isFinite(Date.parse(batch.importedAt))) continue;
    const key = JSON.stringify([batch.fileHash, sourceKey(batch.source)]);
    const time = new Date(batch.importedAt).toISOString();
    if (time > (imported.get(key) ?? "")) imported.set(key, time);
    importedByBatch.set(JSON.stringify([batch.id, batch.fileHash, sourceKey(batch.source)]), time);
  }
  const importTime = (reading: Measurement) => {
    const batchId = (reading as Measurement & { batch_id?: string }).batch_id;
    return batchId ? importedByBatch.get(JSON.stringify([batchId, reading.file_hash, sourceKey(reading.source)])) ?? ""
      : imported.get(JSON.stringify([reading.file_hash, sourceKey(reading.source)])) ?? "";
  };
  const result: PlayerMetricReading[] = [];
  const ambiguousReportMetrics = new Set<string>();
  const reportCounts = new Map<string, number>();
  const reportKey = (reading: Measurement, key: PlayerMetricKey, unit: string) => JSON.stringify([reading.file_hash, reading.measured_at, key, unit]);
  const isRenpho = (reading: Measurement) => reading.source === "RENPHO" && /^RENPHO report · Page [1-9][0-9]*$/.test(reading.source_sheet) && /^[a-f0-9]{64}$/.test(reading.file_hash);
  for (const reading of own) {
    const normalized = normalizePlayerMetric(reading.metric, reading.unit);
    if (!normalized || !isRenpho(reading)) continue;
    const key = reportKey(reading, normalized.key, normalized.unit);
    const count = (reportCounts.get(key) ?? 0) + 1;
    reportCounts.set(key, count);
    if (count > 1) ambiguousReportMetrics.add(key);
  }
  for (const reading of own) {
    const normalized = normalizePlayerMetric(reading.metric, reading.unit);
    if (!normalized || !reading.id || idCounts.get(reading.id) !== 1 || !reading.source.trim()
      || !validatePlayerMetricValue(normalized.key, reading.value, normalized.unit)) continue;
    if (isRenpho(reading) && ambiguousReportMetrics.has(reportKey(reading, normalized.key, normalized.unit))) continue;
    const period = periodFor(reading.measured_at, definitions.get(normalized.key)!.group);
    if (!period) continue;
    result.push({ id: reading.id, athleteCode, metricKey: normalized.key, value: reading.value, unit: normalized.unit,
      measuredAt: reading.measured_at, period, source: reading.source, importedAt: importTime(reading), provenance: [reading], derived: false });
  }
  for (const report of getRenphoReports([...own], [...batches], athleteCode)) {
    const period = periodFor(report.reference.measured_at, "body");
    if (!period || report.readings.some(reading => normalizePlayerMetric(reading.metric, reading.unit)?.key === "muscle_mass_pct")) continue;
    // Count all candidates first: an invalid duplicate never selects a convenient winner.
    const weights = report.readings.filter(reading => aliases.get(labelKey(reading.metric)) === "weight");
    const muscles = report.readings.filter(reading => labelKey(reading.metric) === "musclemass");
    if (weights.length !== 1 || muscles.length !== 1) continue;
    const [weight] = weights, [muscle] = muscles;
    const chartable = getRenphoChartReadings(report);
    if (!chartable.includes(weight) || !chartable.includes(muscle) || weight.unit !== muscle.unit
      || !["lb", "kg"].includes(weight.unit) || weight.value <= 0 || muscle.value > weight.value
      || idCounts.get(weight.id) !== 1 || idCounts.get(muscle.id) !== 1) continue;
    const value = muscle.value / weight.value * 100;
    if (!validatePlayerMetricValue("muscle_mass_pct", value, "%")) continue;
    result.push({ id: JSON.stringify(["derived_muscle_mass_pct", weight.id, muscle.id]), athleteCode, metricKey: "muscle_mass_pct",
      value, unit: "%", measuredAt: weight.measured_at, period, source: "RENPHO", importedAt: [importTime(weight), importTime(muscle)].sort().at(-1) ?? "", provenance: [weight, muscle],
      derived: true, derivation: "Muscle mass ÷ weight × 100, from the same report and unit." });
  }
  return result.sort(newestFirst);
}

type Comparison = Pick<PlayerMetricCard, "percentile" | "cohortSampleSize" | "percentileStatus">;
const unavailable = (): Comparison => ({ percentile: null, cohortSampleSize: null, percentileStatus: "unavailable" });

/** Latest per athlete, exact source/unit/window. Tied midrank maps unique endpoints to 0 and 100. */
export function getPlayerMetricPercentile(readings: readonly PlayerMetricReading[], target: PlayerMetricReading, cohortAthleteCodes: readonly string[]): Comparison {
  const cohort = new Set(cohortAthleteCodes.filter(Boolean));
  if (!cohort.has(target.athleteCode)) return { percentile: null, cohortSampleSize: 0, percentileStatus: "not_in_cohort" };
  const direction = definitions.get(target.metricKey)?.direction;
  if (!direction || !validatePlayerMetricValue(target.metricKey, target.value, target.unit)) return unavailable();
  const latest = new Map<string, PlayerMetricReading>();
  for (const reading of [...readings].sort(newestFirst)) {
    if (!cohort.has(reading.athleteCode) || latest.has(reading.athleteCode) || reading.metricKey !== target.metricKey
      || reading.period !== target.period || reading.unit !== target.unit || sourceKey(reading.source) !== sourceKey(target.source)
      || !validatePlayerMetricValue(reading.metricKey, reading.value, reading.unit)) continue;
    latest.set(reading.athleteCode, reading);
  }
  const own = latest.get(target.athleteCode);
  if (!own || own.id !== target.id || own.value !== target.value || own.measuredAt !== target.measuredAt) return unavailable();
  const values = [...latest.values()].map(reading => reading.value);
  const sampleSize = values.length;
  if (sampleSize < 5) return { percentile: null, cohortSampleSize: sampleSize, percentileStatus: "small_cohort" };
  const below = values.filter(value => value < target.value).length;
  const equal = values.filter(value => value === target.value).length;
  const ascending = 100 * (below + (equal - 1) / 2) / (sampleSize - 1);
  return { percentile: { value: direction === "lower" ? 100 - ascending : ascending, sampleSize, period: target.period, unit: target.unit, direction },
    cohortSampleSize: sampleSize, percentileStatus: "available" };
}

function applyOverride(target: PlayerMetricReading, overrides: readonly PlayerPercentileOverride[]): Comparison | null {
  const direction = definitions.get(target.metricKey)!.direction;
  const matches = overrides.filter(item => item.athleteCode === target.athleteCode && item.metricKey === target.metricKey
    && item.measuredAt === target.measuredAt && item.observedValue === target.value && item.unit === target.unit && item.period === target.period
    && sourceKey(item.source) === sourceKey(target.source) && item.direction === direction);
  if (matches.length !== 1) return null;
  const item = matches[0];
  if (!Number.isSafeInteger(item.sampleSize) || item.sampleSize < 0) return null;
  if (item.sampleSize < 5) return item.value === null ? { percentile: null, cohortSampleSize: item.sampleSize, percentileStatus: "small_cohort" } : null;
  if (item.value === null) return { percentile: null, cohortSampleSize: item.sampleSize, percentileStatus: "unavailable" };
  if (!Number.isFinite(item.value) || item.value < 0 || item.value > 100) return null;
  return { percentile: { value: item.value, sampleSize: item.sampleSize, period: item.period, unit: item.unit, direction }, cohortSampleSize: item.sampleSize, percentileStatus: "available" };
}

/** Caller supplies the permitted cohort or server-only aggregates; this function never expands access. */
export function getPlayerPerformance({ readings, batches = [], athleteCode, cohortAthleteCodes, percentileOverrides = [] }: PlayerPerformanceInput): PlayerPerformance {
  const grouped = new Map<string, Measurement[]>();
  for (const reading of readings) {
    const group = grouped.get(reading.athlete_code) ?? [];
    group.push(reading); grouped.set(reading.athlete_code, group);
  }
  const own = getPlayerMetricReadings(grouped.get(athleteCode) ?? [], batches, athleteCode);
  const cohort = cohortAthleteCodes === undefined ? [] : [...new Set(cohortAthleteCodes)].flatMap(code => code === athleteCode ? own : getPlayerMetricReadings(grouped.get(code) ?? [], batches, code));
  const model: PlayerPerformance = { body: [], hitting: [], pitching: [] };
  for (const metric of PLAYER_METRICS) {
    const matching = own.filter(reading => reading.metricKey === metric.key);
    const latest = matching[0] ?? null;
    const summerBaseline = metric.group === "body" ? matching.find(reading => reading.period === "summer_2026") ?? null : null;
    const comparison = latest ? applyOverride(latest, percentileOverrides)
      ?? (cohortAthleteCodes === undefined ? unavailable() : getPlayerMetricPercentile(cohort, latest, cohortAthleteCodes))
      : { percentile: null, cohortSampleSize: null, percentileStatus: "missing" } as const;
    model[metric.group].push({ metric, latest, summerBaseline, history: [...matching].reverse(), ...comparison });
  }
  return model;
}
