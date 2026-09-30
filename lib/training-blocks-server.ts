import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";
import type { TrainingBlockReadingCount } from "@/lib/training-blocks";

export type { TrainingBlockReadingCount } from "@/lib/training-blocks";
function parseCountPage(data: unknown): TrainingBlockReadingCount[] {
  if (!Array.isArray(data) || data.length > 1000) throw new Error("Training-block samples could not be verified.");
  return data.map(value => {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "count,measuredAt,metricKey,observationId,source,unit,value"
      || typeof value.observationId !== "string" || value.observationId.length < 1 || value.observationId.length > 2000 || /[\u0000-\u001f\u007f]/.test(value.observationId)
      || typeof value.value !== "number" || !Number.isFinite(value.value) || value.value < 0
      || typeof value.measuredAt !== "string" || !/^2026-\d{2}-\d{2}$/.test(value.measuredAt) || !Number.isFinite(Date.parse(value.measuredAt)) || new Date(value.measuredAt).toISOString().slice(0, 10) !== value.measuredAt || value.measuredAt < "2026-09-01" || value.measuredAt > "2026-12-31"
      || !["Full Swing · Game", "Full Swing · Intrasquad", "Full Swing · Practice"].includes(value.source)
      || !["max_exit_velocity", "avg_exit_velocity", "max_bat_speed", "avg_bat_speed", "max_distance", "max_pitch_velocity", "avg_pitch_velocity"].includes(value.metricKey)
      || value.unit !== (value.metricKey === "max_distance" ? "ft" : "mph")
      || !Number.isSafeInteger(value.count) || value.count < 1 || value.count > 100000) throw new Error("Training-block samples could not be verified.");
    return { observationId: value.observationId, count: value.count, value: value.value, measuredAt: value.measuredAt, source: value.source, metricKey: value.metricKey, unit: value.unit };
  });
}

/** Use the same trusted effective-role restriction as the parent profile. These
 * exact observation IDs are consumed server-side by buildTrainingBlockSeries;
 * only its numerical display projection reaches the browser.
 */
export async function loadTrainingBlockCounts(access: Awaited<ReturnType<typeof requireAccess>>, athleteId: string): Promise<TrainingBlockReadingCount[]> {
  if (!UUID_PATTERN.test(athleteId) || !canReadPresentedAthlete(access, athleteId)) throw new Error("Training-block access denied.");
  const result: TrainingBlockReadingCount[] = [], seen = new Set<string>();
  for (let offset = 0; offset <= 20000; offset += 1000) {
    const { data, error } = await access.supabase.rpc("athlete_training_block_samples", { p_athlete_id: athleteId, p_offset: offset });
    if (error) throw new Error("Training-block samples could not be loaded.");
    const page = parseCountPage(data);
    for (const row of page) {
      if (seen.has(row.observationId)) throw new Error("Training-block samples changed while loading. Refresh this profile.");
      seen.add(row.observationId);
      result.push(row);
    }
    if (result.length > 20000) throw new Error("This profile exceeds the supported training-block history.");
    if (page.length < 1000) return result;
  }
  return result;
}
