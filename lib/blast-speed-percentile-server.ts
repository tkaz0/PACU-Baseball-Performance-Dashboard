import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { parseBlastBatSpeedPercentile, type BlastBatSpeedPercentile } from "@/lib/blast-speed-percentile";
import { UUID_PATTERN } from "@/lib/types";

type Access = Awaited<ReturnType<typeof requireAccess>>;

export async function loadBlastBatSpeedPercentile(access: Access, athleteId: string): Promise<BlastBatSpeedPercentile | null> {
  if (typeof athleteId !== "string" || !UUID_PATTERN.test(athleteId) || !canReadPresentedAthlete(access, athleteId)) {
    throw new Error("Blast bat speed percentile access denied.");
  }
  const { data, error } = await access.supabase.rpc("athlete_blast_bat_speed_percentile", { p_athlete_id: athleteId });
  if (error) throw new Error("Blast bat speed percentile could not be loaded.");
  return parseBlastBatSpeedPercentile(data, athleteId);
}
