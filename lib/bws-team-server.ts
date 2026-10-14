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
export type BwsPlayerStats = { athleteId: string; name: string; playerType: string; position: string; secondaryPosition: string; bats: string; throws: string; hitting: BwsStat[]; pitching: BwsStat[]; atBats: number | null; plateAppearances: number | null };
export const BWS_HITTING_STATS = ["batting_production_plus", "batting_ops", "batting_obp", "batting_avg", "qpa_pct", "batting_k_pct", "batting_bb_pct", "batting_est_iso", "sb"];
export const BWS_PITCHING_STATS = ["pitching_whip", "pitching_k_bb", "pitching_r9", "strike_pct", "pitching_k9", "pitching_bb9"];

/** Cumulative Fall game stats for the current eligible roster, from the existing staff reader (Admin only here). */
export async function loadBwsPlayerStats(): Promise<BwsPlayerStats[]> {
  const data = await loadTopPerformersData();
  return data.players.map(player => {
    const own = data.games.filter(g => g.athleteId === player.id);
    const pick = (keys: string[], source: string) => keys.flatMap(key => {
      const g = own.find(row => row.metric === key && row.source === source);
      return g ? [{ key, label: g.label, value: gameValue(g.value, g.unit), raw: g.value, sample: gameSampleText(g.source, g.metric, g.opportunities) }] : [];
    });
    // AVG's sample is official AB and QPA%'s is PA, so the pair gives the player's own AB/PA rate.
    const count = (metric: string) => own.find(g => g.metric === metric && g.source === "qpa_fall_2026")?.opportunities ?? null;
    return { athleteId: player.id, name: player.name, playerType: player.playerType, position: player.position, secondaryPosition: player.secondaryPosition ?? "", bats: player.bats, throws: player.throws,
      hitting: pick(BWS_HITTING_STATS, "qpa_fall_2026"), pitching: pick(BWS_PITCHING_STATS, "pitching_fall_2026"), atBats: count("batting_avg"), plateAppearances: count("qpa_pct") };
  });
}
