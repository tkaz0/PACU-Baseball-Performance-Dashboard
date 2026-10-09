import "server-only";
import { cache } from "react";
import type { requireAccess } from "@/lib/auth";
import { latestDailySnapshots, type GameSnapshotRow } from "@/lib/game-trends";
import { gameWeeks } from "@/lib/game-weeks";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";

/** Staff only (snapshot RLS is staff-only too). Reads metadata first, then only each day's final version. */
export const loadGameWeeks = cache(async (access: Pick<Awaited<ReturnType<typeof requireAccess>>, "supabase" | "roles">) => {
  if (!access.roles.some(role => role === "admin" || role === "coach")) return null;
  const { data: metadata, error } = await access.supabase.from("game_stat_snapshots").select("id,source,fetched_at").order("fetched_at", { ascending: false }).limit(60);
  if (error || !Array.isArray(metadata) || metadata.some(row => !row || typeof row.id !== "string" || !["qpa_fall_2026", "pitching_fall_2026"].includes(row.source) || typeof row.fetched_at !== "string" || !Number.isFinite(Date.parse(row.fetched_at)))) throw new Error("Game sheet versions could not be loaded.");
  const selected = latestDailySnapshots(metadata as Omit<GameSnapshotRow, "observations">[]);
  if (!selected.length) return { hitting: [], pitching: [] };
  const { data, error: rowsError } = await access.supabase.from("game_stat_snapshots").select("id,source,fetched_at,observations").in("id", selected.map(row => row.id)).limit(60);
  if (rowsError || !Array.isArray(data) || data.length !== selected.length || data.some(row => !selected.some(meta => meta.id === row.id && meta.source === row.source && meta.fetched_at === row.fetched_at) || !Array.isArray(row.observations))) throw new Error("Game sheet versions could not be loaded.");
  return gameWeeks(data as GameSnapshotRow[]);
});

/** Own-player (or staff-selected) week-by-week lines through the scoped reader; failure shows no trend. */
export async function loadAthleteGameWeeks(access: Awaited<ReturnType<typeof requireAccess>>, athleteId: string) {
  if (!UUID_PATTERN.test(athleteId) || !canReadPresentedAthlete(access, athleteId)) throw new Error("Game history access denied.");
  const { data, error } = await access.supabase.rpc("athlete_game_snapshot_history", { p_athlete_id: athleteId });
  if (error || !Array.isArray(data) || data.some(row => !row || typeof row.id !== "string" || !["qpa_fall_2026", "pitching_fall_2026"].includes(row.source) || typeof row.fetched_at !== "string" || !Number.isFinite(Date.parse(row.fetched_at)) || !Array.isArray(row.observations))) return null;
  return gameWeeks(data as GameSnapshotRow[]);
}
