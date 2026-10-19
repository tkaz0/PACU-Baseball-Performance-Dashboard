import "server-only";
import { loadTopPerformersData } from "@/lib/analytics-server";
import { gameValue } from "@/lib/game-metrics";
import { gameSampleText } from "@/lib/game-opportunities";
import { PITCHING_CUMULATIVE } from "@/lib/pitching-cumulative";

export type RosterCardStat = { label: string; value: string; sample: string | null };
/**
 * One headline cumulative Fall game stat per discipline for staff roster cards: OPS for hitters and
 * WHIP for pitchers, from the existing staff Top Performers reader. Missing stats are simply absent.
 */
export async function loadRosterCardStats(): Promise<Record<string, RosterCardStat[]>> {
  const data = await loadTopPerformersData();
  const out: Record<string, RosterCardStat[]> = {};
  const picks = [{ metric: "batting_ops", source: "qpa_fall_2026", eventId: "", label: "OPS" }, { metric: "pitching_whip", source: "pitching_fall_2026", eventId: PITCHING_CUMULATIVE, label: "WHIP" }];
  for (const player of data.players) {
    const stats = picks.flatMap(pick => {
      const rows = data.games.filter(g => g.athleteId === player.id && g.metric === pick.metric && g.source === pick.source && g.eventId === pick.eventId && Number.isFinite(g.value));
      return rows.length === 1 ? [{ label: pick.label, value: gameValue(rows[0].value, rows[0].unit), sample: gameSampleText(rows[0].source, rows[0].metric, rows[0].opportunities) }] : [];
    });
    if (stats.length) out[player.id] = stats;
  }
  return out;
}
