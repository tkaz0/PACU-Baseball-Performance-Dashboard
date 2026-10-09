import { isTimedMetric } from "@/lib/player-performance";
import { formatMetricNumber } from "@/lib/measurement-display";
import { profileMetricLabel } from "@/lib/profile-metric-label";
import { LEADERBOARD_METRICS, leaderboardMetricLabel, leaderboardSession, leaderboardSourceLabel, leaderboardPitchType, pitchLeaderboardLabel, selectPitchLeaderboards, visibleLeaderboardComparisons, type LeaderboardComparison, type LeaderboardRow } from "@/lib/leaderboards";

export type RecordHolder = { name: string; code: string; profileId: string | null; measuredAt: string; sample: string | null };
export type TeamRecord = { key: string; category: string; label: string; context: string; value: string; holders: RecordHolder[]; players: number };

const CATEGORIES = ["Speed & Agility", "Strength", "Hitting · In-Game", "Hitting · Practice", "Throwing", "Pitching · Velocity"] as const;

/**
 * Directional testing boards only: neutral body measurements and spin stay out, and Blast weekly
 * P95 is not a record. Pitching uses each classified pitch's Max Velocity board. Records reuse the
 * signed-in leaderboard projection, so value, Fall-best basis, ties and peer-link rules are unchanged.
 */
export function teamRecordSelections(options: readonly LeaderboardComparison[]): { comparison: LeaderboardComparison; category: (typeof CATEGORIES)[number] }[] {
  const directional = (comparison: LeaderboardComparison) => { const metric = LEADERBOARD_METRICS.find(m => m.key === comparison.metricKey); return !!metric && metric.direction !== "neutral" && comparison.metricKey !== "p95_bat_speed" && comparison.period === "fall_2026"; };
  return [
    ...visibleLeaderboardComparisons("physicality", options).filter(directional).map(comparison => ({ comparison, category: isTimedMetric(comparison.metricKey) ? "Speed & Agility" as const : "Strength" as const })),
    ...visibleLeaderboardComparisons("hitting", options, "in_game").filter(directional).map(comparison => ({ comparison, category: "Hitting · In-Game" as const })),
    ...visibleLeaderboardComparisons("hitting", options, "practice").filter(directional).map(comparison => ({ comparison, category: "Hitting · Practice" as const })),
    ...visibleLeaderboardComparisons("throwing", options, "practice").filter(directional).map(comparison => ({ comparison, category: "Throwing" as const })),
    ...selectPitchLeaderboards(options).comparisons.filter(c => c.metricKey === "classified_max_velocity" && c.period === "fall_2026").map(comparison => ({ comparison, category: "Pitching · Velocity" as const })),
  ];
}

export function teamRecord(comparison: LeaderboardComparison, category: string, rows: readonly LeaderboardRow[]): TeamRecord | null {
  const holders = rows.filter(row => row.rank === 1);
  const metric = LEADERBOARD_METRICS.find(m => m.key === comparison.metricKey);
  if (!holders.length || !metric) return null;
  const v = holders[0].value;
  const value = isTimedMetric(metric.key) && comparison.unit === "s" ? `${v.toFixed(2)} s` : `${formatMetricNumber(v, metric.key, comparison.source)} ${comparison.unit}`;
  const label = leaderboardPitchType(comparison.source) ? pitchLeaderboardLabel(metric, comparison.source) : profileMetricLabel(metric.key, leaderboardMetricLabel(metric), comparison.source);
  return {
    key: JSON.stringify([comparison.metricKey, comparison.source, comparison.unit]), category, label, value, players: rows.length,
    context: leaderboardPitchType(comparison.source) ? (leaderboardSession(comparison.source) === "in_game" ? "In-Game" : "Practice") : leaderboardSourceLabel(comparison.source),
    holders: holders.map(row => ({ name: row.name, code: row.athleteCode, profileId: row.profileId, measuredAt: row.measuredAt,
      sample: row.sampleCount != null && row.sampleUnit ? `${row.sampleCount} ${row.sampleCount === 1 ? row.sampleUnit.replace(/s$/, "") : row.sampleUnit}` : null })),
  };
}
export const TEAM_RECORD_CATEGORIES = CATEGORIES;
