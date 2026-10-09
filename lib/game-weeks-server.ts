import "server-only";
import { cache } from "react";
import type { requireAccess } from "@/lib/auth";
import type { GameSnapshotRow } from "@/lib/game-trends";
import type { WeekPlayer } from "@/lib/home-spotlight";
import { gameWeeks } from "@/lib/game-weeks";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";

const text = (value: unknown, max = 100) => typeof value === "string" && value.length > 0 && value.length <= max;
/**
 * Every linked player and staff account: the narrow weekly-ranking projection (eligible names, codes,
 * roster roles and count observations). Peer profile ids arrive null for players, so no peer links render.
 */
export const loadGameWeeks = cache(async (access: Pick<Awaited<ReturnType<typeof requireAccess>>, "supabase" | "roles" | "athleteId">): Promise<{ players: WeekPlayer[]; weeks: ReturnType<typeof gameWeeks> } | null> => {
  const staff = access.roles.some(role => role === "admin" || role === "coach");
  if (!staff && !(access.roles.includes("player") && access.athleteId)) return null;
  const { data, error } = await access.supabase.rpc("team_game_week_inputs");
  if (error || !data || typeof data !== "object" || !Array.isArray(data.players) || !Array.isArray(data.snapshots)) throw new Error("Weekly game stats could not be loaded.");
  const players: WeekPlayer[] = [];
  for (const row of data.players) {
    if (!row || !text(row.code, 40) || !text(row.name, 200) || (row.profile_id !== null && (typeof row.profile_id !== "string" || !UUID_PATTERN.test(row.profile_id)))) throw new Error("Weekly game stats could not be loaded.");
    // Player View strips every peer link, even when the underlying staff session returned one.
    const profileId = row.profile_id && (staff ? canReadPresentedAthlete(access, row.profile_id) : row.profile_id === access.athleteId) ? row.profile_id : null;
    players.push({ id: row.code, code: row.code, name: row.name, profileId, playerType: row.player_type ?? "", position: row.primary_position ?? "", secondaryPosition: row.secondary_position ?? "", academicClass: "", bats: "", throws: "" });
  }
  const snapshots = data.snapshots as GameSnapshotRow[];
  if (snapshots.some(row => !row || typeof row.id !== "string" || !["qpa_fall_2026", "pitching_fall_2026"].includes(row.source) || typeof row.fetched_at !== "string" || !Number.isFinite(Date.parse(row.fetched_at)) || !Array.isArray(row.observations))) throw new Error("Weekly game stats could not be loaded.");
  return { players, weeks: gameWeeks(snapshots) };
});

/** Own-player (or staff-selected) week-by-week lines through the scoped reader; failure shows no trend. */
export async function loadAthleteGameWeeks(access: Awaited<ReturnType<typeof requireAccess>>, athleteId: string) {
  if (!UUID_PATTERN.test(athleteId) || !canReadPresentedAthlete(access, athleteId)) throw new Error("Game history access denied.");
  const { data, error } = await access.supabase.rpc("athlete_game_snapshot_history", { p_athlete_id: athleteId });
  if (error || !Array.isArray(data) || data.some(row => !row || typeof row.id !== "string" || !["qpa_fall_2026", "pitching_fall_2026"].includes(row.source) || typeof row.fetched_at !== "string" || !Number.isFinite(Date.parse(row.fetched_at)) || !Array.isArray(row.observations))) return null;
  return gameWeeks(data as GameSnapshotRow[]);
}
