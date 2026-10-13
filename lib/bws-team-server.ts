import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canMutatePresentedAccess } from "@/lib/access-preview";
import { validateBwsSnapshot } from "@/lib/bws-team";
import { loadTopPerformersData } from "@/lib/analytics-server";
import { gameValue } from "@/lib/game-metrics";
import { gameSampleText } from "@/lib/game-opportunities";

type Access = Awaited<ReturnType<typeof requireAccess>>;
export async function loadBwsTeamPlan(access: Access) {
  if (!canMutatePresentedAccess(access)) throw new Error("Your private administrator workspace is required.");
  const { data, error } = await access.supabase.rpc("my_bws_team_plan");
  if (error) throw new Error("The team plan could not be loaded. Refresh to try again.");
  return data === null ? null : validateBwsSnapshot(data);
}

export type BwsStat = { key: string; label: string; value: string; raw: number; sample: string | null };
export type BwsPlayerStats = { athleteId: string; playerType: string; position: string; secondaryPosition: string; hitting: BwsStat[]; pitching: BwsStat[] };
export const BWS_HITTING_STATS = ["batting_production_plus", "batting_ops", "batting_obp", "qpa_pct", "batting_k_pct", "sb"];
export const BWS_PITCHING_STATS = ["pitching_whip", "pitching_k_bb", "pitching_r9", "strike_pct", "pitching_k9"];

/** Cumulative Fall game stats for the current eligible roster, from the existing staff reader (Admin only here). */
export async function loadBwsPlayerStats(): Promise<BwsPlayerStats[]> {
  const data = await loadTopPerformersData();
  return data.players.map(player => {
    const own = data.games.filter(g => g.athleteId === player.id);
    const pick = (keys: string[], source: string) => keys.flatMap(key => {
      const g = own.find(row => row.metric === key && row.source === source);
      return g ? [{ key, label: g.label, value: gameValue(g.value, g.unit), raw: g.value, sample: gameSampleText(g.source, g.metric, g.opportunities) }] : [];
    });
    return { athleteId: player.id, playerType: player.playerType, position: player.position, secondaryPosition: player.secondaryPosition ?? "",
      hitting: pick(BWS_HITTING_STATS, "qpa_fall_2026"), pitching: pick(BWS_PITCHING_STATS, "pitching_fall_2026") };
  });
}
