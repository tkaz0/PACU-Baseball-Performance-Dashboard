import type { Measurement } from "@/lib/imports/engine";
import type { ImportBatch } from "@/lib/local-workspace";

export type RenphoChartReport = {
  key: string;
  reference: Measurement;
  readings: Measurement[];
  importedAt: string;
};
export type RenphoHistoryPoint = { reportKey: string; reading: Measurement };

export const RENPHO_MASS_METRICS = [
  "Weight", "Body Fat Mass", "Bone Mass", "Protein Mass", "Body Water Mass",
  "Muscle Mass", "Skeletal Muscle Mass", "Fat-Free Mass",
] as const;
export const RENPHO_PERCENT_METRICS = [
  "Body Fat Percentage", "Subcutaneous Fat", "Skeletal Muscle Percentage",
  "Body Water Percentage", "Protein Percentage", "Bone Mass Percentage", "Muscle Mass Percentage",
] as const;

const REPORT_PAGE = /^RENPHO report · Page [1-9][0-9]*$/;
const REPORT_HASH = /^[a-f0-9]{64}$/;
const ALLOWED_UNITS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ...RENPHO_MASS_METRICS.map(metric => [metric, metric === "Weight" ? ["kg", "lb", "st"] : ["kg", "lb"]] as const),
  ...RENPHO_PERCENT_METRICS.map(metric => [metric, ["%"]] as const),
  ["BMI", ["kg/m²"]], ["BMR", ["kcal", "kcal/day"]],
  ["Visceral Fat", ["index", "grade"]], ["Skeletal Muscle Index", ["kg/m²"]],
  ["Metabolic Age", ["years"]], ["Waist-to-Hip Ratio", ["ratio"]],
]);
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const isReportReading = (reading: Measurement) => reading.source === "RENPHO" && REPORT_PAGE.test(reading.source_sheet) && REPORT_HASH.test(reading.file_hash);
const metricUnitKey = (reading: Measurement) => JSON.stringify([reading.metric, reading.unit]);
const groupKey = (reading: Measurement) => JSON.stringify([reading.athlete_code, reading.file_hash, reading.measured_at]);

/** Reviewed report groups for exactly one permanent athlete code, newest first. */
export function getRenphoReports(readings: Measurement[], batches: ImportBatch[], athleteCode: string): RenphoChartReport[] {
  const importTimes = new Map<string, string>();
  for (const batch of batches) {
    if (batch.kind !== "measurements" || batch.source !== "RENPHO" || !batch.fileHash) continue;
    if (batch.importedAt > (importTimes.get(batch.fileHash) ?? "")) importTimes.set(batch.fileHash, batch.importedAt);
  }
  const reports = new Map<string, RenphoChartReport>();
  for (const reading of readings) {
    if (reading.athlete_code !== athleteCode || !isReportReading(reading)) continue;
    const key = groupKey(reading);
    const report = reports.get(key) ?? { key, reference: reading, readings: [], importedAt: importTimes.get(reading.file_hash) ?? "" };
    report.readings.push(reading); reports.set(key, report);
  }
  // Stable references do not depend on the caller's filtering or input order. The
  // original Measurement objects are retained, including all source provenance.
  for (const report of reports.values()) {
    report.readings.sort((a, b) => compare(a.source_sheet, b.source_sheet) || a.source_row - b.source_row
      || compare(a.metric, b.metric) || compare(a.unit, b.unit) || compare(a.id, b.id) || compare(a.source_file, b.source_file));
    report.reference = report.readings[0];
  }
  return [...reports.values()].sort((a, b) => compare(b.reference.measured_at, a.reference.measured_at)
    || compare(b.importedAt, a.importedAt) || compare(a.reference.file_hash, b.reference.file_hash) || compare(a.key, b.key));
}

/**
 * Return individually chartable readings without changing raw report data. Count
 * duplicates before value validation, so an invalid duplicate cannot select a winner.
 */
export function getRenphoChartReadings(report: RenphoChartReport): Measurement[] {
  const key = groupKey(report.reference);
  const readings = report.readings.filter(reading => isReportReading(reading) && groupKey(reading) === key);
  const counts = new Map<string, number>();
  for (const reading of readings) counts.set(metricUnitKey(reading), (counts.get(metricUnitKey(reading)) ?? 0) + 1);
  return readings.filter(reading => counts.get(metricUnitKey(reading)) === 1
    && ALLOWED_UNITS.get(reading.metric)?.includes(reading.unit)
    && Number.isFinite(reading.value) && reading.value >= 0
    && (reading.unit !== "%" || reading.value <= 100));
}

/** Exact reverse of newest-first report order; ties do not imply a test timestamp. */
export function getRenphoHistory(reports: RenphoChartReport[], metric: string, unit: string): RenphoHistoryPoint[] {
  return [...reports].sort((a, b) => compare(a.reference.measured_at, b.reference.measured_at)
    || compare(a.importedAt, b.importedAt) || compare(b.reference.file_hash, a.reference.file_hash) || compare(b.key, a.key))
    .flatMap(report => {
      const reading = getRenphoChartReadings(report).find(reading => reading.metric === metric && reading.unit === unit);
      return reading ? [{ reportKey: report.key, reading }] : [];
    });
}
