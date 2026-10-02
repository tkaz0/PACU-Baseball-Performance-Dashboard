import type { PlayerMetricCard } from "@/lib/player-performance";

/**
 * A recent Fall personal best: the latest reading beats every earlier-dated reading of the same
 * metric/source/unit/period. Neutral measurements (size, spin) never count; timed tests already show best times.
 */
export function recentPersonalBest(card: PlayerMetricCard, today: string, windowDays = 21): { previous: number } | null {
  const latest = card.latest, direction = card.metric.direction;
  if (!latest || latest.derived || card.timedTrials || direction === "neutral" || latest.period !== "fall_2026") return null;
  const earlier = card.history.filter(r => r.source === latest.source && r.unit === latest.unit && r.period === latest.period && !r.derived && r.measuredAt < latest.measuredAt && Number.isFinite(r.value));
  if (!earlier.length) return null;
  const previous = direction === "lower" ? Math.min(...earlier.map(r => r.value)) : Math.max(...earlier.map(r => r.value));
  const improved = direction === "lower" ? latest.value < previous : latest.value > previous;
  const age = (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${latest.measuredAt}T12:00:00Z`)) / 86400000;
  return improved && age >= 0 && age <= windowDays ? { previous } : null;
}
