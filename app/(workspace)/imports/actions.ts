"use server";

import { revalidatePath } from "next/cache";
import { requireImportAccess } from "@/lib/auth";
import { prepareReviewedPerformanceRows } from "@/lib/performance-import";
import { importReviewedPerformance, type PerformanceImportReceipt } from "@/lib/performance-server";
import type { Measurement } from "@/lib/imports/engine";

export type SaveReviewedMeasurementsResult = PerformanceImportReceipt | { error: string };
const measurementFields = new Set(["id", "athlete_code", "measured_at", "source", "metric", "value", "unit", "source_file", "source_sheet", "source_row", "file_hash"]);

export async function saveReviewedMeasurements(measurements: unknown, confirmed: boolean): Promise<SaveReviewedMeasurementsResult> {
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
    receipt = await importReviewedPerformance(reviewed);
  } catch { return { error: "The save could not be confirmed. Refresh the profiles before retrying; conflicting observations are never replaced." }; }
  revalidatePath("/imports");
  revalidatePath("/overview");
  revalidatePath("/athletes", "layout");
  return receipt;
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
