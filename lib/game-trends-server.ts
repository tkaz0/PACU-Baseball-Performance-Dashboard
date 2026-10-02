import "server-only";
import type { requireAccess } from "@/lib/auth";
import { teamGameTrends, type GameSnapshotRow, type TeamGameTrends } from "@/lib/game-trends";

/** Staff only (snapshot RLS is staff-only too). Failures return no trends rather than breaking the page. */
export async function loadTeamGameTrends(access: Pick<Awaited<ReturnType<typeof requireAccess>>, "supabase" | "roles">): Promise<TeamGameTrends> {
  if (!access.roles.some(role => role === "admin" || role === "coach")) return {};
  const { data, error } = await access.supabase.from("game_stat_snapshots").select("id,source,fetched_at,observations").order("fetched_at", { ascending: false }).limit(40);
  if (error || !Array.isArray(data)) return {};
  return teamGameTrends(data as GameSnapshotRow[]);
}
