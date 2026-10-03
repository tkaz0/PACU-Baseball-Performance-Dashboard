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
export type TopPerformerRow = {
  player: CoachingPlayer; stats: Record<string, CoachingGame | null>; rank: number | null;
  score: number | null; percentiles: Record<string, number>; cohortSize: number;
  pending: "missing_stats" | "small_cohort" | "mixed_snapshots" | null;
};

/** Equal-weight blend of team percentiles, using the same tied-midrank convention as profiles.
 * All components use one complete same-snapshot cohort. This is a team-relative ranking,
 * not an independently calibrated talent or predictive score. Missing stats never become zero.
 */
export function topPerformers(data: { players: CoachingPlayer[]; games: CoachingGame[] }, discipline: TopDiscipline): TopPerformerRow[] {
  const metrics = TOP_PERFORMER_METRICS[discipline];
  const source = discipline === "hitting" ? "qpa_fall_2026" : "pitching_fall_2026";
  const eventId = discipline === "hitting" ? "" : PITCHING_CUMULATIVE;
  const rows: TopPerformerRow[] = data.players.filter(player => {
    const type = player.playerType.trim().toLowerCase();
    const pitches = ["pitcher", "two_way"].includes(type) || [player.position, player.secondaryPosition].some(p => p?.trim().toUpperCase() === "P");
    return discipline === "pitching" ? pitches : !pitches || type === "two_way";
  }).map(player => ({
    player, rank: null, score: null, percentiles: {}, cohortSize: 0, pending: null,
    stats: Object.fromEntries(metrics.map(metric => {
      const matches = data.games.filter(g => g.athleteId === player.id && g.source === source && g.eventId === eventId && g.metric === metric.key && g.unit === metric.unit && Number.isFinite(g.value) && g.value >= 0);
      return [metric.key, matches.length === 1 ? matches[0] : null];
    })),
  })).filter(row => metrics.some(metric => row.stats[metric.key]));
  const complete = rows.filter(row => metrics.every(metric => row.stats[metric.key]));
  const snapshots = new Set(complete.flatMap(row => metrics.map(metric => row.stats[metric.key]!.snapshotId)));
  for (const row of rows) {
    row.cohortSize = complete.length;
    row.pending = !metrics.every(metric => row.stats[metric.key]) ? "missing_stats"
      : snapshots.size !== 1 || snapshots.has("") ? "mixed_snapshots"
      : complete.length < 5 ? "small_cohort" : null;
    if (row.pending) continue;
    // Integer midrank points avoid different floating-point sums creating false ties.
    let points = 0;
    for (const metric of metrics) {
      const value = row.stats[metric.key]!.value;
      const values = complete.map(peer => peer.stats[metric.key]!.value);
      const betterThan = values.filter(peer => metric.direction === "higher" ? peer < value : peer > value).length;
      const tied = values.filter(peer => peer === value).length;
      const midrankPoints = 2 * betterThan + tied - 1;
      row.percentiles[metric.key] = 50 * midrankPoints / (complete.length - 1);
      points += midrankPoints;
    }
    row.score = 50 * points / ((complete.length - 1) * metrics.length);
  }
  rows.sort((a, b) => {
    if (a.score === null || b.score === null) return a.score === b.score ? a.player.name.localeCompare(b.player.name) : a.score === null ? 1 : -1;
    return b.score - a.score || a.player.name.localeCompare(b.player.name);
  });
  let previous: number | undefined, rank = 0;
  rows.forEach((row, index) => {
    const value = row.score;
    if (value === null) return;
    if (value !== previous) rank = index + 1;
    row.rank = rank; previous = value;
  });
  return rows;
}
