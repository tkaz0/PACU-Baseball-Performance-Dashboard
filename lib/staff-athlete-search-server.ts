import "server-only";
import { cache } from "react";
import type { requireAccess } from "@/lib/auth";
import { staffAthleteChoice, type StaffAthleteChoice } from "@/lib/staff-athlete-search";
import { seasonDesignNavigation } from "@/lib/design-navigation";

/** Caller has fresh requireAccess(). Effective Player access never queries a roster. */
export const loadStaffAthleteChoices = cache(async (access: Pick<Awaited<ReturnType<typeof requireAccess>>, "roles" | "supabase">): Promise<StaffAthleteChoice[]> => {
  if (!access.roles.some(role => role === "admin" || role === "coach")) return [];
  const { data, error } = await access.supabase.from("athletes")
    .select("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons!inner(season)")
    .eq("athlete_seasons.season", "2026-27").order("last_name").limit(1000);
  if (error) throw new Error("Unable to load player search choices.");
  return (data ?? []).map(staffAthleteChoice);
});

/** Staff choices limited to players eligible for Pitch Design (pitchers/two-way) or Swing Design (position/two-way). */
export const loadDesignAthleteChoices = cache(async (access: Pick<Awaited<ReturnType<typeof requireAccess>>, "roles" | "supabase">, kind: "pitch" | "swing"): Promise<StaffAthleteChoice[]> => {
  if (!access.roles.some(role => role === "admin" || role === "coach")) return [];
  const { data, error } = await access.supabase.from("athletes")
    .select("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons!inner(season,player_type,primary_position,secondary_position)")
    .eq("athlete_seasons.season", "2026-27").order("last_name").limit(1000);
  if (error) throw new Error("Unable to load player search choices.");
  return (data ?? []).filter(athlete => seasonDesignNavigation(athlete.athlete_seasons.find(season => season.season === "2026-27"))[kind]).map(staffAthleteChoice);
});
