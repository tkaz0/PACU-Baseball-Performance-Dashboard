import "server-only";
import { cache } from "react";
import type { requireAccess } from "@/lib/auth";

type Access = Pick<Awaited<ReturnType<typeof requireAccess>>, "supabase">;

/** PAC code → headshot path for teammates. Missing table/RPC (before the migration) means initials everywhere. */
export const loadTeamHeadshots = cache(async (access: Access): Promise<Map<string, string>> => {
  const { data, error } = await access.supabase.rpc("team_headshots");
  if (error || !Array.isArray(data)) return new Map();
  return new Map((data as { athlete_code: unknown; image_path: unknown }[])
    .filter(row => typeof row.athlete_code === "string" && typeof row.image_path === "string")
    .map(row => [row.athlete_code as string, row.image_path as string]));
});

/** One readable athlete's headshot path, or null (no photo, no access, or migration not yet applied). */
export async function loadAthleteHeadshot(access: Access, athleteId: string): Promise<string | null> {
  const { data, error } = await access.supabase.from("athlete_headshots").select("image_path").eq("athlete_id", athleteId).maybeSingle();
  return !error && data && typeof data.image_path === "string" ? data.image_path : null;
}
