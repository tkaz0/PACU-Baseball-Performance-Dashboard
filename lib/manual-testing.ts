import type { Measurement } from "@/lib/imports/engine";
import { prepareReviewedPerformanceRows } from "@/lib/performance-import";
import { PLAYER_METRICS, validatePlayerMetricValue, type PlayerMetricKey } from "@/lib/player-performance";
import { isTestingEligible, type TestingAthlete } from "@/lib/testing-checklist";
import { UUID_PATTERN } from "@/lib/types";

export type ManualTestingRow = { metricKey: string; unit: string; value: string; feet?: string; inches?: string };
export type ManualTestingInput = {
  submissionId: string; athleteCode: string; testedOn: string; protocol: string; rows: ManualTestingRow[];
};
export type ManualTestingReview = { input: ManualTestingInput; athlete: TestingAthlete; measurements: Measurement[] };
export type ManualTestingSaveResult =
  | { status: "saved"; receipt: { import_id: string; created: number; unchanged: number }; athleteId: string }
  | { status: "invalid" | "uncertain"; error: string };

const dateValid = (date: unknown): date is string => typeof date === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(date)
  && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
function numeric(value: unknown, label: string): number {
  if (typeof value !== "string" || value.length > 40 || !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())) throw new Error(`Enter a number for ${label}.`);
  const number = Number(value.trim());
  if (!Number.isFinite(number)) throw new Error(`Enter a finite number for ${label}.`);
  return number;
}

export function manualHeightInches(feet: unknown, inches: unknown): number {
  const feetValue = numeric(feet, "height in feet"), inchesValue = numeric(inches, "height in inches");
  const total = feetValue * 12 + inchesValue;
  if (!Number.isSafeInteger(feetValue) || inchesValue >= 12 || !Number.isFinite(total) || total <= 0) {
    throw new Error("Use whole feet and inches from 0 up to, but not including, 12.");
  }
  return total;
}

/** One explicit entry gets one identity. Retrying that entry never changes its observation IDs. */
async function submissionHash(id: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`PACU manual testing v1:${id}`));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Prepare a reviewed manual record; the caller must supply a freshly authorized roster athlete and Pacific date. */
export async function prepareManualTesting(value: unknown, athlete: TestingAthlete, today: string): Promise<ManualTestingReview> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Review the player and measurements before saving.");
  const input = value as ManualTestingInput;
  if (Object.keys(input).sort().join(",") !== "athleteCode,protocol,rows,submissionId,testedOn"
    || typeof input.submissionId !== "string" || !UUID_PATTERN.test(input.submissionId)
    || typeof input.athleteCode !== "string" || input.athleteCode !== athlete.athleteCode) throw new Error("Choose a player from the current roster.");
  if (!dateValid(today) || !dateValid(input.testedOn) || input.testedOn > today || input.testedOn < "2026-06-01" || input.testedOn > "2026-12-31") {
    throw new Error("Use an actual testing date from June 1 through December 31, 2026, no later than today.");
  }
  if (typeof input.protocol !== "string" || /[\u0000-\u001f\u007f]/.test(input.protocol)) throw new Error("Name the testing protocol or device used.");
  const protocol = input.protocol.trim().replace(/\s+/g, " ");
  if (!protocol || protocol.length > 80) throw new Error("Name the testing protocol or device used (up to 80 characters).");
  if (!Array.isArray(input.rows) || input.rows.length < 1 || input.rows.length > PLAYER_METRICS.length) throw new Error("Enter at least one measurement, with each metric listed once.");
  const used = new Set<PlayerMetricKey>();
  const checkedRows: { metricKey: PlayerMetricKey; label: string; unit: string; value: number }[] = [];
  const copiedRows: ManualTestingRow[] = [];
  for (const [index, row] of input.rows.entries()) {
    const definition = row && PLAYER_METRICS.find(metric => metric.key === row.metricKey);
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).some(key => !["metricKey", "unit", "value", "feet", "inches"].includes(key))
      || !definition || !isTestingEligible(athlete, definition.key)) throw new Error(`Choose an available measurement for row ${index + 1}.`);
    if (used.has(definition.key)) throw new Error(`${definition.label} is listed twice. Keep one reviewed value for this test.`);
    used.add(definition.key);
    const height = definition.key === "height" && row.unit === "ft-in";
    if (height ? row.value !== "" : row.feet !== undefined || row.inches !== undefined) throw new Error(`Review the input format for ${definition.label}.`);
    const unit = height ? "in" : row.unit;
    const number = height ? manualHeightInches(row.feet, row.inches) : numeric(row.value, definition.label);
    if (!definition.units.includes(unit) || !validatePlayerMetricValue(definition.key, number, unit)) throw new Error(`Use a valid ${definition.label} value and its listed unit.`);
    if (definition.group !== "body" && input.testedOn < "2026-09-01") throw new Error("Use Fall 2026 dates, September 1 through December 31, for baseball and speed tests.");
    checkedRows.push({ metricKey: definition.key, label: definition.label, unit, value: number });
    copiedRows.push({ metricKey: definition.key, unit: row.unit, value: row.value,
      ...(height ? { feet: row.feet, inches: row.inches } : {}) });
  }
  for (const [average, maximum] of [["avg_exit_velocity", "max_exit_velocity"], ["avg_bat_speed", "max_bat_speed"], ["avg_pitch_velocity", "max_pitch_velocity"]]) {
    const avg = checkedRows.find(row => row.metricKey === average), max = checkedRows.find(row => row.metricKey === maximum);
    if (avg && max && avg.unit === max.unit && avg.value > max.value) throw new Error(`${avg.label} cannot exceed ${max.label} for the same test.`);
  }
  // Copy the reviewed input before awaiting crypto; UI edits cannot alter the prepared submission.
  const copy: ManualTestingInput = { submissionId: input.submissionId.toLowerCase(), athleteCode: input.athleteCode,
    testedOn: input.testedOn, protocol, rows: copiedRows };
  const fileHash = await submissionHash(copy.submissionId), sheet = "Manual testing";
  const measurements = checkedRows.map((row, index): Measurement => ({
    id: `observation:${JSON.stringify([fileHash, sheet, 1, index])}`, athlete_code: copy.athleteCode,
    measured_at: copy.testedOn, source: `Manual testing · ${protocol}`, metric: row.label, unit: row.unit, value: row.value,
    source_file: `manual-testing-${copy.submissionId}.json`, source_sheet: sheet, source_row: 1, file_hash: fileHash,
  }));
  prepareReviewedPerformanceRows(measurements);
  return { input: copy, athlete, measurements };
}
