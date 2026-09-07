"use server";

import { revalidatePath } from "next/cache";
import { requireAdminMutation } from "@/lib/auth";
import { applyRenphoReportSwap, previewRenphoReportSwap } from "@/lib/renpho-correction-server";

export async function reviewReportCorrection(input: unknown) {
  await requireAdminMutation();
  try { return { preview: await previewRenphoReportSwap(input) }; }
  catch { return { error: "These reports could not be reviewed. Refresh the report list and check the selected players and report IDs." }; }
}

export async function saveReportCorrection(input: unknown, fingerprint: string, confirmed: boolean) {
  await requireAdminMutation();
  if (confirmed !== true) return { error: "Check both assignments before saving." };
  try {
    const receipt = await applyRenphoReportSwap(input, fingerprint);
    for (const path of ["/imports", "/roster", "/leaderboards", "/testing", "/admin/import/renpho", "/admin/import/renpho/corrections"]) revalidatePath(path);
    revalidatePath("/athletes", "layout");
    return { receipt };
  } catch { return { error: "The correction could not be confirmed. Retry this same correction to verify or complete it." }; }
}
