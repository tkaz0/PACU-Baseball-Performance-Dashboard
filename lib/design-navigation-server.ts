import "server-only";
import { cache } from "react";
import type { requireAccess } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/types";
import { presentedDesignNavigation, type DesignNavigation } from "@/lib/design-navigation";

type NavigationAccess = Pick<Awaited<ReturnType<typeof requireAccess>>, "roles" | "athleteId" | "supabase">;

/** Request-render deduplication only; no persisted roles or roster-wide player read. */
export const loadDesignNavigation = cache(async (access: NavigationAccess): Promise<DesignNavigation> => {
  if (access.roles.some(role => role === "admin" || role === "coach") || !access.roles.includes("player") || !access.athleteId || !UUID_PATTERN.test(access.athleteId)) return presentedDesignNavigation(access);
  const { data, error } = await access.supabase.from("athlete_seasons")
    .select("athlete_id,season,player_type,primary_position,secondary_position")
    .eq("athlete_id", access.athleteId).eq("season", "2026-27").maybeSingle();
  if (error || !data || typeof data.athlete_id !== "string" || data.athlete_id.toLowerCase() !== access.athleteId.toLowerCase()) return presentedDesignNavigation(access);
  return presentedDesignNavigation(access, data);
});
