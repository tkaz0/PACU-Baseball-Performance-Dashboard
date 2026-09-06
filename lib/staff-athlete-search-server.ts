import "server-only";
import type { requireAccess } from "@/lib/auth";
import { staffAthleteChoice, type StaffAthleteChoice } from "@/lib/staff-athlete-search";

/** Caller has fresh requireAccess(). Effective Player access never queries a roster. */
export async function loadStaffAthleteChoices(access: Pick<Awaited<ReturnType<typeof requireAccess>>, "roles" | "supabase">): Promise<StaffAthleteChoice[]> {
  if (!access.roles.some(role => role === "admin" || role === "coach")) return [];
  const { data, error } = await access.supabase.from("athletes")
    .select("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons!inner(season)")
    .eq("athlete_seasons.season", "2026-27").order("last_name").limit(1000);
  if (error) throw new Error("Unable to load player search choices.");
  return (data ?? []).map(staffAthleteChoice);
}
