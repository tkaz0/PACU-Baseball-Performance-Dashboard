"use server";
import { revalidatePath } from "next/cache";
import { requireAdminMutation } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/types";
export async function correctWeight(input: { requestId: string; athleteId: string; observationId: string; expectedValue: number; value: number }, reviewed: boolean) {
  const access = await requireAdminMutation();
  if (reviewed !== true || !input || !UUID_PATTERN.test(input.requestId) || !UUID_PATTERN.test(input.athleteId) || typeof input.observationId !== "string" || !input.observationId.length || input.observationId.length > 2000 || !Number.isFinite(input.expectedValue) || input.expectedValue < 0 || !Number.isFinite(input.value) || input.value <= 0 || input.value === input.expectedValue) return { error: "Review the selected reading and enter a different positive weight." };
  const request = { requestId: input.requestId, athleteId: input.athleteId, observationId: input.observationId, expectedValue: input.expectedValue, value: input.value };
  const { data, error } = await access.supabase.rpc("admin_correct_recorded_weight", { p_request: request, p_reviewed: true });
  if (error || data?.requestId !== input.requestId || data?.corrected !== 1) return { error: "The correction could not be confirmed. Keep this review open and retry it. If the reading changed, reload the profile before a new review." };
  revalidatePath(`/athletes/${input.athleteId}`);
  revalidatePath("/leaderboards"); revalidatePath("/testing"); revalidatePath("/admin/correct-weight");
  return { receipt: { requestId: input.requestId, corrected: 1 } };
}
