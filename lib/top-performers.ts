import type { CoachingGame, CoachingPlayer } from "@/lib/coaching-tools";
import { PITCHING_CUMULATIVE } from "@/lib/pitching-cumulative";

export const TOP_PERFORMER_METRICS = {
  hitting: [
    { key: "batting_production_plus", unit: "index", label: "PAC Production+", direction: "higher" },
    { key: "qpa_pct", unit: "%", label: "QPA%", direction: "higher" },
    { key: "batting_obp", unit: "avg", label: "OBP", direction: "higher" },
    { key: "batting_est_iso", unit: "avg", label: "ISO", direction: "higher" },
  ],
  pitching: [
    { key: "pitching_whip", unit: "decimal", label: "WHIP", direction: "lower" },
    { key: "pitching_k_bb", unit: "decimal", label: "K/BB", direction: "higher" },
    { key: "pitching_r9", unit: "per9", label: "Runs/9", direction: "lower" },
  ],
} as const;
export type TopDiscipline = keyof typeof TOP_PERFORMER_METRICS;
export type TopPerformerRow = { player: CoachingPlayer; stats: Record<string, CoachingGame | null>; rank: number | null };

/** Rank each stat on its own. Missing and ambiguous results never become zero. */
export function topPerformers(data: { players: CoachingPlayer[]; games: CoachingGame[] }, discipline: TopDiscipline, sortKey: string): TopPerformerRow[] {
  const metrics = TOP_PERFORMER_METRICS[discipline];
  const selected = metrics.find(m => m.key === sortKey) ?? metrics[0];
  const source = discipline === "hitting" ? "qpa_fall_2026" : "pitching_fall_2026";
  const eventId = discipline === "hitting" ? "" : PITCHING_CUMULATIVE;
  const rows = data.players.filter(player => {
    const type = player.playerType.trim().toLowerCase();
    const pitches = ["pitcher", "two_way"].includes(type) || [player.position, player.secondaryPosition].some(p => p?.trim().toUpperCase() === "P");
    return discipline === "pitching" ? pitches : !pitches || type === "two_way";
  }).map(player => ({
    player, rank: null as number | null,
    stats: Object.fromEntries(metrics.map(metric => {
      const matches = data.games.filter(g => g.athleteId === player.id && g.source === source && g.eventId === eventId && g.metric === metric.key && g.unit === metric.unit && Number.isFinite(g.value) && g.value >= 0);
      return [metric.key, matches.length === 1 ? matches[0] : null];
    })),
  })).filter(row => metrics.some(metric => row.stats[metric.key]));
  rows.sort((a, b) => {
    const av = a.stats[selected.key]?.value, bv = b.stats[selected.key]?.value;
    if (av === undefined || bv === undefined) return av === bv ? a.player.name.localeCompare(b.player.name) : av === undefined ? 1 : -1;
    return (selected.direction === "lower" ? av - bv : bv - av) || a.player.name.localeCompare(b.player.name);
  });
  let previous: number | undefined, rank = 0;
  rows.forEach((row, index) => {
    const value = row.stats[selected.key]?.value;
    if (value === undefined) return;
    if (value !== previous) rank = index + 1;
    row.rank = rank; previous = value;
  });
  return rows;
}
