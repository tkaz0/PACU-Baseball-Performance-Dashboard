"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTrustedAccess } from "@/lib/auth";
import { ACCESS_PREVIEW_COOKIE, ACCESS_PREVIEW_SECONDS, type AccessPreview } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";

export async function startAccessPreview(form: FormData) {
  const { supabase, user } = await requireTrustedAccess(["admin"]);
  const role = String(form.get("role") ?? "");
  const athleteId = String(form.get("athlete_id") ?? "").toLowerCase();
  if ((role !== "coach" && role !== "player") || (role === "player" && !UUID_PATTERN.test(athleteId)) || (role === "coach" && athleteId)) redirect("/overview?preview=invalid");
  if (role === "player") {
    const { data, error } = await supabase.from("athletes").select("id").eq("id", athleteId).maybeSingle();
    if (error || !data) redirect("/overview?preview=invalid");
  }
  const preview: AccessPreview = { version: 1, actorId: user.id, role, athleteId: role === "player" ? athleteId : null, expiresAt: Date.now() + ACCESS_PREVIEW_SECONDS * 1000 };
  (await cookies()).set(ACCESS_PREVIEW_COOKIE, JSON.stringify(preview), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  revalidatePath("/", "layout");
  redirect("/overview");
}

export async function exitAccessPreview() {
  // Clearing a display preference also lets an account recover after losing admin access.
  await requireTrustedAccess();
  (await cookies()).delete(ACCESS_PREVIEW_COOKIE);
  revalidatePath("/", "layout");
  redirect("/overview");
}
