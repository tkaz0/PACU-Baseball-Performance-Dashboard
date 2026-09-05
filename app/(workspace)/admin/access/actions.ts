"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminMutation } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/types";
export async function configureAccount(form: FormData) {
  const { supabase } = await requireAdminMutation();
  const id = String(form.get("user_id") ?? "");
  const athlete = String(form.get("athlete_id") ?? "");
  const roles = form.getAll("roles").map(String);
  if (!UUID_PATTERN.test(id) || (athlete && !UUID_PATTERN.test(athlete)) || !roles.length || roles.some(r => !["admin","coach","player"].includes(r)) || form.get("confirm") !== "yes") redirect("/admin/access?error=input");
  const { error } = await supabase.rpc("admin_configure_account", { target_user: id, active: form.get("active") === "yes", roles, linked_athlete: athlete || null });
  if (error) redirect("/admin/access?error=save");
  revalidatePath("/admin/access");
  redirect("/admin/access?saved=1");
}
