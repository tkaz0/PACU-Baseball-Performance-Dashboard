"use server";

import { revalidatePath } from "next/cache";
import { requireAdminMutation } from "@/lib/auth";
import { applyRenphoReportReassignment, previewRenphoReportReassignment } from "@/lib/renpho-reassignment-server";

export async function reviewSingleReportCorrection(input: unknown) {
  await requireAdminMutation();
  try { return { preview: await previewRenphoReportReassignment(input) }; }
  catch { return { error: "This report could not be reviewed. Refresh the report list and check the player and selected report IDs." }; }
}

export async function saveSingleReportCorrection(input: unknown, fingerprint: string, confirmed: boolean) {
  await requireAdminMutation();
  if (confirmed !== true) return { error: "Check the original report and its correct player before saving." };
  try {
    const receipt = await applyRenphoReportReassignment(input, fingerprint);
    for (const path of ["/imports", "/roster", "/leaderboards", "/testing", "/admin/import/renpho", "/admin/import/renpho/corrections"]) revalidatePath(path);
    revalidatePath("/athletes", "layout");
    return { receipt };
  } catch { return { error: "The correction could not be confirmed. Keep this page open and retry the same correction." }; }
}
