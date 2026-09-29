import { UUID_PATTERN } from "@/lib/types";

/** One athlete's verified weighted Fall average and eligible-team percentile. */
export type BlastBatSpeedPercentile = {
  athleteId: string;
  observedValue: number;
  percentile: number | null;
  sampleSize: number;
  swingCount: number;
  reportCount: number;
  firstDate: string;
  lastDate: string;
};

const FIELDS = [
  "athleteId", "observedValue", "percentile", "sampleSize",
  "swingCount", "reportCount", "firstDate", "lastDate",
] as const;
const DAY_MS = 86_400_000;

function invalid(): never {
  throw new Error("Blast bat speed percentile could not be verified.");
}

function integerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function fallDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^2026-\d{2}-\d{2}$/.test(value) ||
    value < "2026-09-01" || value > "2026-12-31") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

/** Null means unavailable; malformed or mismatched projections fail closed. */
export function parseBlastBatSpeedPercentile(data: unknown, athleteId: string): BlastBatSpeedPercentile | null {
  if (typeof athleteId !== "string" || !UUID_PATTERN.test(athleteId)) return invalid();
  if (data === null) return null;
  if (!data || typeof data !== "object" || Array.isArray(data)) return invalid();

  const row = data as Record<string, unknown>;
  if (Reflect.ownKeys(row).length !== FIELDS.length || !FIELDS.every(field => Object.hasOwn(row, field))) return invalid();
  if (typeof row.athleteId !== "string" || !UUID_PATTERN.test(row.athleteId) ||
    row.athleteId.toLowerCase() !== athleteId.toLowerCase() ||
    typeof row.observedValue !== "number" || !Number.isFinite(row.observedValue) || row.observedValue < 0 ||
    !integerInRange(row.sampleSize, 1, 1000) ||
    (row.percentile !== null && (typeof row.percentile !== "number" || !Number.isFinite(row.percentile) || row.percentile < 0 || row.percentile > 100)) ||
    (row.sampleSize < 5 && row.percentile !== null) ||
    !integerInRange(row.swingCount, 1, Number.MAX_SAFE_INTEGER) ||
    !integerInRange(row.reportCount, 1, 122) ||
    !fallDate(row.firstDate) || !fallDate(row.lastDate) || row.firstDate > row.lastDate ||
    row.reportCount > (Date.parse(row.lastDate) - Date.parse(row.firstDate)) / DAY_MS + 1 ||
    row.swingCount < row.reportCount) return invalid();

  return {
    athleteId: row.athleteId,
    observedValue: row.observedValue,
    percentile: row.percentile,
    sampleSize: row.sampleSize,
    swingCount: row.swingCount,
    reportCount: row.reportCount,
    firstDate: row.firstDate,
    lastDate: row.lastDate,
  };
}
