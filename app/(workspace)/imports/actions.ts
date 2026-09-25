"use server";

import { validatePitchAssignments, type PitchAssignmentSnapshot } from "@/lib/imports/pitch-assignments";
import { revalidatePath } from "next/cache";
import { requireImportAccess } from "@/lib/auth";
import { prepareReviewedPerformanceRows } from "@/lib/performance-import";
import { importReviewedPerformance, type PerformanceImportReceipt } from "@/lib/performance-server";
import type { Measurement } from "@/lib/imports/engine";
import { importReviewedRenpho, lookupRenphoIdentity } from "@/lib/renpho-identity-server";
import { importFullSwingContacts } from "@/lib/full-swing-contacts-server";
import type { ReviewedContact } from "@/lib/imports/full-swing-contacts";
import { REVIEWED_CONTACT_FIELDS } from "@/lib/imports/full-swing-contacts";
import type { ReviewedFullSwingSample } from "@/lib/imports/full-swing-samples";

export type SaveReviewedMeasurementsResult = PerformanceImportReceipt | { error: string };
const measurementFields = new Set(["id", "athlete_code", "measured_at", "source", "metric", "value", "unit", "source_file", "source_sheet", "source_row", "file_hash"]);

async function saveMeasurements(measurements: unknown, confirmed: boolean, identity?: { athleteCode: string; renphoId: string }): Promise<SaveReviewedMeasurementsResult> {
  await requireImportAccess();
  if (confirmed !== true) return { error: "Review the athletes, dates, values and units before saving." };
  let reviewed: Measurement[];
  try {
    if (!Array.isArray(measurements) || measurements.length < 1 || measurements.length > 500 ||
      new TextEncoder().encode(JSON.stringify(measurements)).byteLength > 1048576 ||
      measurements.some(row => !row || typeof row !== "object" || Array.isArray(row) ||
        Object.keys(row).length !== measurementFields.size || Object.keys(row).some(key => !measurementFields.has(key)))) throw new Error("Invalid reviewed rows");
    reviewed = measurements as Measurement[];
    prepareReviewedPerformanceRows(reviewed);
  } catch { return { error: "These measurements could not be validated. Review the source, athlete IDs, dates, values and units again." }; }
  let receipt: PerformanceImportReceipt;
  try {
    // The adapter checks live staff authorization again immediately before its user-session RPC.
    receipt = identity ? await importReviewedRenpho(reviewed, identity) : await importReviewedPerformance(reviewed);
  } catch { return { error: "The save could not be confirmed. Refresh the profiles before retrying; conflicting observations are never replaced." }; }
  revalidatePath("/imports");
  revalidatePath("/testing");
  revalidatePath("/testing/coverage");
  revalidatePath("/admin/performance");
  revalidatePath("/overview");
  revalidatePath("/leaderboards");
  revalidatePath("/athletes", "layout");
  return receipt;
}

export async function saveReviewedMeasurements(measurements: unknown, confirmed: boolean): Promise<SaveReviewedMeasurementsResult> {
  return saveMeasurements(measurements, confirmed);
}

export async function saveReviewedFullSwingSamples(input: unknown): Promise<{ created: number; unchanged: number } | { error: string }> {
  const { supabase } = await requireImportAccess();
  const fields = ["athleteCode", "expectedValue", "fileHash", "metricKey", "sampleCount", "sourceRow", "unit"].join(",");
  if (!Array.isArray(input) || input.length < 1 || input.length > 500 ||
    new TextEncoder().encode(JSON.stringify(input)).byteLength > 1048576 || input.some(row =>
      !row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).sort().join(",") !== fields ||
      typeof row.athleteCode !== "string" || !/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(row.athleteCode) ||
      typeof row.fileHash !== "string" || !/^[a-f0-9]{64}$/.test(row.fileHash) ||
      typeof row.metricKey !== "string" || !["max_exit_velocity", "avg_exit_velocity", "max_bat_speed", "avg_bat_speed", "max_distance", "max_pitch_velocity", "avg_pitch_velocity"].includes(row.metricKey) ||
      !["mph", "ft"].includes(row.unit) || !Number.isSafeInteger(row.sourceRow) || row.sourceRow < 2 || row.sourceRow > 1000000 ||
      !Number.isSafeInteger(row.sampleCount) || row.sampleCount < 1 || row.sampleCount > 100000 ||
      !Number.isFinite(row.expectedValue) || Math.abs(row.expectedValue) > 10000))
    return { error: "Review the session sample counts and player matches." };
  try {
    const { data, error } = await supabase.rpc("save_full_swing_session_samples", { p_rows: input as ReviewedFullSwingSample[] });
    if (error || !data || typeof data !== "object" || Object.keys(data).sort().join(",") !== "created,unchanged" ||
      !Number.isSafeInteger(data.created) || !Number.isSafeInteger(data.unchanged) || data.created + data.unchanged !== input.length)
      throw new Error("Unverified sample receipt");
    revalidatePath("/leaderboards");
    return data as { created: number; unchanged: number };
  } catch { return { error: "Sample counts were not confirmed. Review the original CSV and saved measurements before retrying." }; }
}

export async function saveReviewedContacts(input: unknown, confirmed: boolean): Promise<{ created: number; unchanged: number } | { error: string }> {
  await requireImportAccess();
  if (confirmed !== true) return { error: "Review the batter matches and paired readings before saving." };
  if (!Array.isArray(input) || input.length < 1 || input.length > 500 ||
    new TextEncoder().encode(JSON.stringify(input)).byteLength > 1048576) return { error: "Review 1–500 batted-ball readings from one file." };
  const rows = input as ReviewedContact[];
  const first = rows[0], coordinates = new Set<number>(), pitches = new Set<number>();
  if (rows.some(row => !row || typeof row !== "object" || Array.isArray(row) ||
    JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(REVIEWED_CONTACT_FIELDS) ||
    !/^PAC-\d{4,6}$/.test(row.athleteCode) || !/^[a-f0-9]{64}$/.test(row.fileHash) ||
    typeof row.sourceFile !== "string" || !row.sourceFile || row.sourceFile.length > 300 || row.sourceFile !== row.sourceFile.trim() ||
    !/^2026-(09|10|11|12)-\d{2}$/.test(row.playedOn) || Number.isNaN(Date.parse(row.playedOn)) ||
    !["game", "intrasquad", "practice"].includes(row.category) ||
    !Number.isSafeInteger(row.sourceRow) || row.sourceRow < 2 || !Number.isSafeInteger(row.pitchNumber) || row.pitchNumber < 1 ||
    !Number.isFinite(row.exitVelocity) || row.exitVelocity <= 0 || row.exitVelocity > 200 ||
    !Number.isFinite(row.launchAngle) || Math.abs(row.launchAngle) > 90 ||
    (row.direction !== null && (typeof row.direction !== "number" || !Number.isFinite(row.direction) || Math.abs(row.direction)>90)) ||
    (row.distance !== null && (typeof row.distance !== "number" || !Number.isFinite(row.distance) || row.distance<0 || row.distance>1000)) ||
    (row.direction===null)!==(row.distance===null) ||
    row.fileHash !== first.fileHash || row.sourceFile !== first.sourceFile || row.playedOn !== first.playedOn || row.category !== first.category ||
    coordinates.has(row.sourceRow) || pitches.has(row.pitchNumber) ||
    (coordinates.add(row.sourceRow), pitches.add(row.pitchNumber), false)))
    return { error: "Contact readings need one reviewed session with unique original CSV rows and pitch numbers." };
  try {
    const receipt = await importFullSwingContacts(rows);
    revalidatePath("/athletes", "layout");
    return receipt;
  } catch { return { error: "The save could not be confirmed. Check the player profile before retrying the same file." }; }
}

export async function saveReviewedRenphoMeasurements(measurements: unknown, confirmed: boolean, identity: { athleteCode: string; renphoId: string }): Promise<SaveReviewedMeasurementsResult> {
  await requireImportAccess();
  if (!identity || typeof identity !== "object" || Array.isArray(identity) || Object.keys(identity).length !== 2 ||
    typeof identity.athleteCode !== "string" || typeof identity.renphoId !== "string") return { error: "Check the player and RENPHO ID before saving." };
  return saveMeasurements(measurements, confirmed, identity);
}

export async function matchSharedRenphoPlayer(reportId: string): Promise<{ athleteCode: string | null } | { error: string }> {
  await requireImportAccess();
  try {
    const match = await lookupRenphoIdentity(reportId);
    return { athleteCode: match?.athlete_code ?? null };
  } catch { return { error: "The roster ID could not be checked. Check the ID and try again before saving." }; }
}

/** Numeric provenance only: report images, OCR and account metadata never leave this read. */
export async function loadSharedReportMeasurements(fileHash: string): Promise<{ measurements: Measurement[] } | { error: string }> {
  const { supabase } = await requireImportAccess();
  if (typeof fileHash !== "string" || fileHash.length !== 64 || !/^[a-f0-9]{64}$/.test(fileHash)) return { error: "This report could not be identified. Choose the original report again." };
  try {
    const { data, error } = await supabase.rpc("performance_report_measurements", { p_file_hash: fileHash });
    if (error || !Array.isArray(data) || data.length > 500 || data.some(row =>
      !row || typeof row !== "object" || Array.isArray(row) || row.file_hash !== fileHash ||
      Object.keys(row).length !== measurementFields.size || Object.keys(row).some(key => !measurementFields.has(key)))) throw new Error("Invalid report measurements");
    // The same canonical validator verifies dates, IDs, finite values and provenance.
    if (data.length) prepareReviewedPerformanceRows(data);
    return { measurements: data as Measurement[] };
  } catch { return { error: "Existing report measurements could not be verified. Refresh and try again before saving this report." }; }
}

function parsePitchSnapshot(value: unknown): PitchAssignmentSnapshot {
  if(!value || typeof value!=="object" || !("version" in value) || !("assignments" in value) || !Number.isSafeInteger(value.version) || Number(value.version)<0) throw new Error("The saved pitch labels could not be verified.");
  return {version: Number(value.version), assignments: validatePitchAssignments(value.assignments)};
}
export async function loadPitchAssignments(fileHash: string): Promise<PitchAssignmentSnapshot | {error:string}> {
  const { supabase } = await requireImportAccess();
  if (typeof fileHash!=="string" || !/^[a-f0-9]{64}$/.test(fileHash)) return {error:"Choose the original CSV again."};
  try {
    const { data, error } = await supabase.rpc("staff_full_swing_pitch_labels", { p_hash: fileHash });
    if(error) return {error:"Saved pitch labels could not be loaded. Retry before editing assignments."};
    return parsePitchSnapshot(data);
  } catch {return {error:"Saved pitch labels could not be verified. Retry before editing assignments."};}
}
export async function savePitchAssignments(fileHash: string, version: number, assignments: unknown): Promise<PitchAssignmentSnapshot | {error:string}> {
  const { supabase } = await requireImportAccess();
  if (typeof fileHash!=="string" || !/^[a-f0-9]{64}$/.test(fileHash) || !Number.isSafeInteger(version) || version<0) return {error:"Reload this CSV before saving labels."};
  let reviewed;
  try {reviewed=validatePitchAssignments(assignments);} catch {return {error:"Review the pitch assignments before saving."};}
  try {
    const { data, error } = await supabase.rpc("staff_full_swing_pitch_labels", { p_hash: fileHash, p_version: version, p_assignments: reviewed });
    if(error?.code==="40001") return {error:"Another staff member changed these labels. Reopen the CSV to load their changes before editing again."};
    if(error) return {error:"The pitch-label save could not be confirmed. Retry with these same labels."};
    return parsePitchSnapshot(data);
  } catch {return {error:"The pitch-label save could not be confirmed. Retry with these same labels."};}
}
