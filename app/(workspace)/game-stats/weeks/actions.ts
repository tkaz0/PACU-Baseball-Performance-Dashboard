"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireImportAccess } from "@/lib/auth";

/** Staff-only, ordinary session. An empty date removes that week; the RPC keeps weeks in date order. */
export async function saveFallBallWeek(formData: FormData) {
  const { supabase } = await requireImportAccess();
  const week = Number(formData.get("week"));
  const raw = String(formData.get("played_on") ?? "").trim();
  if (!Number.isSafeInteger(week) || week < 1 || week > 12 || (raw && !/^2026-\d{2}-\d{2}$/.test(raw))) redirect("/game-stats/weeks?error=invalid");
  const { error } = await supabase.rpc("staff_set_fall_ball_week", { p_week: week, p_played_on: raw || null });
  if (error) redirect(`/game-stats/weeks?error=${error.message.includes("increase") ? "order" : error.message.includes("Fall 2026") ? "range" : "save"}`);
  revalidatePath("/", "layout");
  redirect(`/game-stats/weeks?saved=${week}`);
}
