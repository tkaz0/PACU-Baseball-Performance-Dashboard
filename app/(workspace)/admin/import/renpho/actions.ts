"use server";

import { revalidatePath } from "next/cache";
import { requireAdminMutation } from "@/lib/auth";
import { saveRenphoMappings } from "@/lib/renpho-identity-server";

export async function saveRosterRenphoIds(mappings: unknown, confirmed: boolean): Promise<{ created: number; unchanged: number } | { error: string }> {
  await requireAdminMutation();
  if (confirmed !== true) return { error: "Review the player names and report IDs before saving." };
  try {
    const result = await saveRenphoMappings(mappings);
    revalidatePath("/imports");
    revalidatePath("/admin/import/renpho");
    return result;
  } catch { return { error: "The IDs could not be saved. Check for an ID already assigned to another player, then review again. Existing matches are preserved." }; }
}
