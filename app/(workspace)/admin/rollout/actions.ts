"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminMutation } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/types";

export async function prepareCoach(form: FormData) {
  const { supabase } = await requireAdminMutation();
  const fields = ["display_name", "email", "confirm"] as const;
  const values = fields.map(key => form.getAll(key));
  if (values.some(value => value.length !== 1 || typeof value[0] !== "string")) redirect("/admin/rollout?error=input");
  const [rawName, rawEmail, confirmation] = values.map(value => value[0] as string);
  const displayName = rawName.trim(), email = rawEmail.trim().toLowerCase();
  if (!displayName || displayName.length > 160 || /[\u0000-\u001f\u007f]/.test(rawName + rawEmail)
    || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || confirmation !== "yes") redirect("/admin/rollout?error=input");
  const { data, error } = await supabase.rpc("admin_prepare_coach", { p_display_name: displayName, p_email: email, p_reviewed: true });
  if (error || typeof data !== "string" || !UUID_PATTERN.test(data)) redirect("/admin/rollout?error=save");
  revalidatePath("/admin/rollout");
  redirect("/admin/rollout?saved=1");
}
