import "server-only";
import { cache } from "react";
import type { requireAccess } from "@/lib/auth";
import { teamGameTrends, latestDailySnapshots, type GameSnapshotRow, type TeamGameTrends } from "@/lib/game-trends";

/** Staff only (snapshot RLS is staff-only too). Failures return no trends rather than breaking the page. */
export const loadTeamGameTrends = cache(async (access: Pick<Awaited<ReturnType<typeof requireAccess>>, "supabase" | "roles">): Promise<TeamGameTrends> => {
  if (!access.roles.some(role => role === "admin" || role === "coach")) return {};
  // Read cheap metadata first; fetch large JSON observations only for the final
  // saved version of each Pacific day. Older same-day versions never affect charts.
  const { data: metadata, error: metadataError } = await access.supabase.from("game_stat_snapshots").select("id,source,fetched_at").order("fetched_at", { ascending: false }).limit(40);
  if (metadataError || !Array.isArray(metadata) || metadata.length > 40 || metadata.some(row => !row || typeof row.id !== "string" || !["qpa_fall_2026","pitching_fall_2026"].includes(row.source) || typeof row.fetched_at !== "string" || !Number.isFinite(Date.parse(row.fetched_at)))) return {};
  const selected = latestDailySnapshots(metadata as Omit<GameSnapshotRow,"observations">[]);
  if (!selected.length) return {};
  const ids = selected.map(row => row.id);
  const { data, error } = await access.supabase.from("game_stat_snapshots").select("id,source,fetched_at,observations").in("id",ids).limit(40);
  if (error || !Array.isArray(data) || data.length !== ids.length || new Set(data.map(row=>row.id)).size !== ids.length || data.some(row=>!selected.some(meta=>meta.id===row.id && meta.source===row.source && meta.fetched_at===row.fetched_at) || !Array.isArray(row.observations))) return {};
  return teamGameTrends(data as GameSnapshotRow[]);
});
