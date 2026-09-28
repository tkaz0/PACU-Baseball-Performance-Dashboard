import { UUID_PATTERN } from "@/lib/types";
import { CLASSIFIED_METRICS } from "@/lib/imports/classified-pitch-results";
import { summarizeAssignedPitches, type PitchAssignmentSnapshot } from "@/lib/imports/pitch-assignments";
import type { FullSwingSession } from "@/lib/imports/full-swing-session";

export type LegacyPitchReview = {
  fileHash: string; sourceFile: string; date: string; source: string; currentType: "Fastball";
  measurementCount: 7; summaryRow: number; assignmentVersion: number; fingerprint: string;
  metrics: { metricKey: string; value: number; unit: string; sourceColumn: number }[];
};
export type LegacyPitchHistory = {
  requestId: string; fileHash: string; sourceFile: string; date: string; source: string;
  measurementCount: number; pitchCount: number; afterFingerprint: string; canRestore: boolean;
};
export type ReclassifyPitchRequest = { requestId: string; athleteId: string; fileHash: string; fingerprint: string; sourceRows: number[] };
export type RestorePitchRequest = { requestId: string; athleteId: string; correctionRequestId: string; fingerprint: string };
const hash = (x: unknown): x is string => typeof x === "string" && /^[a-f0-9]{64}$/.test(x);
const id = (x: unknown): x is string => typeof x === "string" && UUID_PATTERN.test(x);
const day = (x: unknown): x is string => typeof x === "string" && /^2026-(09|10|11|12)-\d{2}$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0,10) === x;
const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const integer = (x: unknown, min: number, max: number): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= min && x <= max;
const fileName = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 300 && !/[\u0000-\u001f\u007f]/.test(x);
export function parseLegacyPitchReview(value: unknown): LegacyPitchReview[] {
  if (!Array.isArray(value) || value.length > 200 || value.some(r => !obj(r) || !hash(r.fileHash) || !fileName(r.sourceFile) || !day(r.date)
    || typeof r.source !== "string" || !/^Full Swing · (Game|Intrasquad|Practice) · Fastball$/.test(r.source)
    || r.currentType !== "Fastball" || r.measurementCount !== 7 || !integer(r.summaryRow,2,5001) || !integer(r.assignmentVersion,1,1000000) || !hash(r.fingerprint)
    || !Array.isArray(r.metrics) || r.metrics.length !== 7 || CLASSIFIED_METRICS.some((metric,index) => {
      const rows = (r.metrics as unknown[]).filter(v => obj(v) && v.metricKey === metric.key);
      const m = rows[0]; return rows.length !== 1 || !obj(m) || m.sourceColumn !== index || m.unit !== metric.unit || typeof m.value !== "number" || !Number.isFinite(m.value) || m.value <= 0;
    }))) throw new Error("Saved pitch groups could not be verified.");
  const rows = value as LegacyPitchReview[];
  if (new Set(rows.map(r => r.fileHash)).size !== rows.length) throw new Error("Review one saved pitch group per file.");
  for (const r of rows) {
    const count = (key: string) => r.metrics.find(m => m.metricKey === key)!.value;
    const pitches = count("classified_pitch_count");
    if (!integer(pitches,1,5000) || !integer(count("classified_velocity_count"),1,pitches) || !integer(count("classified_spin_count"),1,pitches)
      || count("classified_avg_velocity") > count("classified_max_velocity") || count("classified_avg_spin") > count("classified_max_spin"))
      throw new Error("Saved pitch counts and results need review.");
  }
  return rows;
}
export function parseLegacyPitchHistory(value: unknown): LegacyPitchHistory[] {
  if (!Array.isArray(value) || value.length > 200 || value.some(r => !obj(r) || !id(r.requestId) || !hash(r.fileHash) || !fileName(r.sourceFile) || !day(r.date)
    || typeof r.source !== "string" || !/^Full Swing · (Game|Intrasquad|Practice) · Fastball$/.test(r.source) || r.measurementCount !== 7 || !integer(r.pitchCount,1,5000) || !hash(r.afterFingerprint) || typeof r.canRestore !== "boolean")) throw new Error("Pitch correction history could not be verified.");
  return value as LegacyPitchHistory[];
}
export function validReclassifyPitchRequest(v: unknown): v is ReclassifyPitchRequest {
  return obj(v) && Object.keys(v).sort().join(",") === "athleteId,fileHash,fingerprint,requestId,sourceRows" && id(v.requestId) && id(v.athleteId) && hash(v.fileHash) && hash(v.fingerprint)
    && Array.isArray(v.sourceRows) && v.sourceRows.length > 0 && v.sourceRows.length <= 5000 && v.sourceRows.every(r => integer(r,2,5001)) && new Set(v.sourceRows).size === v.sourceRows.length;
}
export function validRestorePitchRequest(v: unknown): v is RestorePitchRequest {
  return obj(v) && Object.keys(v).sort().join(",") === "athleteId,correctionRequestId,fingerprint,requestId" && id(v.requestId) && id(v.athleteId) && id(v.correctionRequestId) && hash(v.fingerprint);
}
/** Compare every summary and original coordinate before a staff-approved relabel. No raw CSV leaves the browser. */
export function verifyLegacyPitchFile(review: LegacyPitchReview, fileHash: string, session: FullSwingSession, labels: PitchAssignmentSnapshot, identity: string): number[] {
  if (fileHash !== review.fileHash || session.date !== review.date || session.mode !== "Live at Bat" || labels.version !== review.assignmentVersion)
    throw new Error("Choose this saved report’s exact original CSV and reload its current pitch labels.");
  const pitches = session.pitches.filter(p => p.identity === identity);
  if (!pitches.length || Math.min(...pitches.map(p => p.sourceRow)) !== review.summaryRow)
    throw new Error("This export pitcher does not match the saved pitch group’s original rows.");
  const group = summarizeAssignedPitches(pitches, labels.assignments).find(g => g.pitchType === "Fastball");
  if (!group || CLASSIFIED_METRICS.some(metric => {
    const expected = review.metrics.find(m => m.metricKey === metric.key)?.value;
    const actual = group[metric.field];
    return expected === undefined || actual === null || Math.abs(expected-actual) > Math.max(1,Math.abs(expected)) * 1e-12;
  })) throw new Error("The original CSV does not match all seven saved results. Keep these readings unchanged and review the original session.");
  const genericRows = new Set(labels.assignments.filter(a => a.pitchType === "Fastball").map(a => a.sourceRow));
  return pitches.filter(p => genericRows.has(p.sourceRow)).map(p => p.sourceRow).sort((a,b)=>a-b);
}
