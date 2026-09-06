"use server";

import { revalidatePath } from "next/cache";
import { requireImportAccess } from "@/lib/auth";
import { loadTestingRoster } from "@/lib/testing-checklist-server";
import { pacificTestingDate } from "@/lib/testing-checklist";
import { prepareManualTesting, type ManualTestingSaveResult } from "@/lib/manual-testing";
import { saveReviewedMeasurements } from "@/app/(workspace)/imports/actions";

export async function saveManualTesting(input: unknown, confirmed: boolean): Promise<ManualTestingSaveResult> {
  await requireImportAccess();
  if (confirmed !== true) return { status: "invalid", error: "Review the player, test date and measurements, then confirm before saving." };
  const roster = await loadTestingRoster();
  const code = input && typeof input === "object" && "athleteCode" in input ? input.athleteCode : null;
  const athlete = roster.find(player => player.athleteCode === code);
  if (!athlete) return { status: "invalid", error: "Choose an eligible player from the current roster." };
  let review;
  try { review = await prepareManualTesting(input, athlete, pacificTestingDate()); }
  catch (error) { return { status: "invalid", error: error instanceof Error ? error.message : "Review the entered measurements before saving." }; }
  // This shared action rechecks staff access immediately before its ordinary-session RPC.
  const result = await saveReviewedMeasurements(review.measurements, true);
  if ("error" in result) return { status: "uncertain", error: result.error };
  revalidatePath("/testing");
  revalidatePath("/testing/entry");
  return { status: "saved", receipt: result, athleteId: athlete.id };
}
