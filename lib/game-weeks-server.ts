import "server-only";
import { cache } from "react";
import type { requireAccess } from "@/lib/auth";
import type { GameSnapshotRow } from "@/lib/game-trends";
import type { WeekPlayer } from "@/lib/home-spotlight";
import { gameWeeks } from "@/lib/game-weeks";
import { latestDailySnapshots } from "@/lib/game-trends";
import { bwsRaces } from "@/lib/home-spotlight";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";
import { loadFallBallWeeks } from "@/lib/fall-ball-weeks-server";

const text = (value: unknown, max = 100) => typeof value === "string" && value.length > 0 && value.length <= max;
type WeekInputs = { players: unknown[]; snapshots: unknown[] };
type SnapshotMeta = { id: string; source: GameSnapshotRow["source"]; fetched_at: string };

/**
 * Staff speed path (November 3): the same projection as `team_game_week_inputs`, but reading only the saved versions
 * `gameWeeks` uses (each Pacific day's final QPA version and the newest pitching version) instead of all 60. Snapshot
 * and roster RLS already allow staff these rows; observations get the RPC's exact filter (eligible codes, no RBI).
 */
async function staffWeekInputs(access: Pick<Awaited<ReturnType<typeof requireAccess>>, "supabase">): Promise<WeekInputs> {
  const [meta, roster] = await Promise.all([
    access.supabase.from("game_stat_snapshots").select("id,source,fetched_at").order("fetched_at", { ascending: false }).limit(60),
    access.supabase.from("athletes").select("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons!inner(season,roster_status,player_type,primary_position,secondary_position)").eq("athlete_seasons.season", "2026-27"),
  ]);
  if (meta.error || roster.error || !Array.isArray(meta.data) || !Array.isArray(roster.data)) throw new Error("staff week inputs unavailable");
  const rows = meta.data as SnapshotMeta[];
  if (rows.some(row => !row || typeof row.id !== "string" || !["qpa_fall_2026", "pitching_fall_2026"].includes(row.source) || typeof row.fetched_at !== "string" || !Number.isFinite(Date.parse(row.fetched_at)))) throw new Error("staff week inputs unavailable");
  const daily = latestDailySnapshots(rows);
  const pitchingLatest = daily.filter(row => row.source === "pitching_fall_2026").at(-1);
  const wanted = [...daily.filter(row => row.source === "qpa_fall_2026"), ...(pitchingLatest ? [pitchingLatest] : [])];
  const full = wanted.length ? await access.supabase.from("game_stat_snapshots").select("id,source,fetched_at,observations").in("id", wanted.map(row => row.id)) : { data: [], error: null };
  if (full.error || !Array.isArray(full.data) || full.data.length !== wanted.length || full.data.some(row => !wanted.some(w => w.id === row.id && w.source === row.source && w.fetched_at === row.fetched_at) || !Array.isArray(row.observations))) throw new Error("staff week inputs unavailable");
  const players = (roster.data as { id: string; athlete_code: string; first_name: string; preferred_name: string | null; last_name: string; athlete_seasons: { season: string; roster_status: string | null; player_type: string | null; primary_position: string | null; secondary_position: string | null }[] }[])
    .flatMap(a => { const s = a.athlete_seasons.find(x => x.season === "2026-27"); return s && (s.roster_status === null || s.roster_status === "active" || s.roster_status === "redshirt") ? [{ a, s }] : []; })
    .sort((x, y) => x.a.athlete_code < y.a.athlete_code ? -1 : x.a.athlete_code > y.a.athlete_code ? 1 : 0)
    .map(({ a, s }) => ({ code: a.athlete_code, name: `${a.preferred_name ?? a.first_name} ${a.last_name}`, player_type: s.player_type, primary_position: s.primary_position, secondary_position: s.secondary_position, profile_id: a.id }));
  const eligible = new Set(players.map(p => p.code));
  const snapshots = [...full.data].sort((x, y) => Date.parse(x.fetched_at) - Date.parse(y.fetched_at)).map(row => ({ id: row.id, source: row.source, fetched_at: row.fetched_at,
    observations: (row.observations as Record<string, unknown>[]).filter(o => o && typeof o.athleteCode === "string" && eligible.has(o.athleteCode) && o.metric !== "rbi")
      .map(o => ({ athleteCode: o.athleteCode ?? null, metric: o.metric ?? null, value: o.value ?? null, unit: o.unit ?? null, scope: o.scope ?? null, eventId: o.eventId ?? null })) }));
  return { players, snapshots };
}
/**
 * Every linked player and staff account: the narrow weekly-ranking projection (eligible names, codes,
 * roster roles and count observations). Peer profile ids arrive null for players, so no peer links render.
 */
type WeeksAccess = Pick<Awaited<ReturnType<typeof requireAccess>>, "supabase" | "roles" | "athleteId">;
type WeeksResult = { players: WeekPlayer[]; weeks: ReturnType<typeof gameWeeks>; champions: string[] | null } | null;
// React `cache` only dedupes inside a render; route handlers (Print All's handout batches) share one access object,
// so the read is also kept per access object for that request.
const weeksByAccess = new WeakMap<object, Promise<WeeksResult>>();
export const loadGameWeeks = (access: WeeksAccess): Promise<WeeksResult> => {
  const known = weeksByAccess.get(access);
  if (known) return known;
  const pending = renderCachedGameWeeks(access);
  weeksByAccess.set(access, pending);
  pending.catch(() => weeksByAccess.delete(access));
  return pending;
};
const renderCachedGameWeeks = cache(async (access: WeeksAccess): Promise<WeeksResult> => {
  const staff = access.roles.some(role => role === "admin" || role === "coach");
  if (!staff && !(access.roles.includes("player") && access.athleteId)) return null;
  await loadFallBallWeeks(access);
  // Staff read only the versions they need; any problem falls back to the original projection RPC.
  const inputs = (staff ? staffWeekInputs(access).then(data => ({ data, error: null })) : Promise.reject(new Error("player"))).catch(() => access.supabase.rpc("team_game_week_inputs"));
  const [{ data, error }, champs] = await Promise.all([inputs, access.supabase.rpc("bws_champion_codes")]);
  // Champion PAC codes (November 2): a missing or failed reader keeps the series standings instead of awards.
  const champions = !champs.error && Array.isArray(champs.data) && champs.data.length > 0 && champs.data.every(code => text(code, 40)) ? champs.data as string[] : null;
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
  return { players, weeks: gameWeeks(snapshots), champions };
});

/** Own-player (or staff-selected) week-by-week lines through the scoped reader; failure shows no trend. */
export async function loadAthleteGameWeeks(access: Awaited<ReturnType<typeof requireAccess>>, athleteId: string) {
  if (!UUID_PATTERN.test(athleteId) || !canReadPresentedAthlete(access, athleteId)) throw new Error("Game history access denied.");
  await loadFallBallWeeks(access);
  const { data, error } = await access.supabase.rpc("athlete_game_snapshot_history", { p_athlete_id: athleteId });
  if (error || !Array.isArray(data) || data.some(row => !row || typeof row.id !== "string" || !["qpa_fall_2026", "pitching_fall_2026"].includes(row.source) || typeof row.fetched_at !== "string" || !Number.isFinite(Date.parse(row.fetched_at)) || !Array.isArray(row.observations))) return null;
  return gameWeeks(data as GameSnapshotRow[]);
}

export type BwsAward = "mvp" | "cy_young";
/** Every final BWS award winner (winners and co-winners) by PAC code, from the same calculation as Home. */
export async function loadBwsAwardMap(access: Parameters<typeof loadGameWeeks>[0]): Promise<Record<string, BwsAward[]>> {
  const weekly = await loadGameWeeks(access);
  const races = weekly ? bwsRaces(weekly.players, weekly.weeks.bws, weekly.champions) : null;
  const map: Record<string, BwsAward[]> = {};
  if (!races?.final) return map;
  for (const [award, race] of [["mvp", races.mvp], ["cy_young", races.cyYoung]] as const)
    for (const entry of race?.entries ?? []) if (entry.rank === 1) (map[entry.code] ??= []).push(award);
  return map;
}
/** Final BWS awards won by one PAC code. */
export async function loadBwsAwards(access: Parameters<typeof loadGameWeeks>[0], athleteCode: string): Promise<BwsAward[]> {
  return (await loadBwsAwardMap(access))[athleteCode] ?? [];
}
