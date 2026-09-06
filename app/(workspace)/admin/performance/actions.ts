"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireImportAccess } from "@/lib/auth";
import { importReviewedPerformance } from "@/lib/performance-server";
import { prepareReviewedPerformanceRows } from "@/lib/performance-import";
import type { Measurement } from "@/lib/imports/engine";

export async function shareMeasurements(form: FormData) {
  await requireImportAccess();
  const fields = form.getAll("measurements"), confirmations = form.getAll("confirm");
  if (fields.length !== 1 || typeof fields[0] !== "string" || new TextEncoder().encode(fields[0]).byteLength > 1048576 || confirmations.length !== 1 || confirmations[0] !== "yes") redirect("/admin/performance?error=review");
  let measurements: Measurement[];
  try {
    measurements = JSON.parse(fields[0]);
    prepareReviewedPerformanceRows(measurements);
  } catch { redirect("/admin/performance?error=input"); }
  let receipt;
  try { receipt = await importReviewedPerformance(measurements); }
  catch { redirect("/admin/performance?error=save"); }
  revalidatePath("/overview");
  revalidatePath("/leaderboards");
  revalidatePath("/athletes", "layout");
  redirect(`/admin/performance?import=${receipt.import_id}`);
}
