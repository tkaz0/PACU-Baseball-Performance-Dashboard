import "server-only";
import { PITCH_TYPES } from "@/lib/imports/pitch-assignments";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import type { requireAccess } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/types";
import type { AllowedContact } from "@/lib/contacts-allowed";

/** In-game batted balls hit against this pitcher (practice excluded); batter identities never arrive. */
export async function loadContactsAllowed(access: Awaited<ReturnType<typeof requireAccess>>, athleteId: string): Promise<AllowedContact[]> {
  if (!UUID_PATTERN.test(athleteId) || !canReadPresentedAthlete(access, athleteId)) throw new Error("Contact access denied.");
  const { data, error } = await access.supabase.rpc("athlete_contacts_allowed_by_pitch", { p_athlete_id: athleteId });
  if (error || !Array.isArray(data)) throw new Error("Contact allowed could not be loaded.");
  const num = (v: unknown, max: number) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max;
  return data.map(row => { if (!(row && typeof row.played_on === "string" && /^2026-\d{2}-\d{2}$/.test(row.played_on) && (row.category === "game" || row.category === "intrasquad")
    && num(row.exit_velocity, 200) && row.exit_velocity > 0 && num(row.launch_angle, 90) && (row.direction === null || num(row.direction, 90)) && (row.distance === null || num(row.distance, 1000))
    && (row.squared_up === null || (num(row.squared_up, 1) && row.squared_up > 0))
    && (row.potential_exit_velocity === null || (num(row.potential_exit_velocity,200) && row.potential_exit_velocity>0))
    && (row.pitch_type === null || (PITCH_TYPES.includes(row.pitch_type) && row.pitch_type !== "Fastball"))
    )) throw new Error("Contact allowed could not be verified.");
    return { playedOn: row.played_on, category: row.category, exitVelocity: row.exit_velocity, launchAngle: row.launch_angle, direction: row.direction, distance: row.distance, squaredUp: row.squared_up, potentialExitVelocity: row.potential_exit_velocity, pitchType: row.pitch_type };
  });
}
