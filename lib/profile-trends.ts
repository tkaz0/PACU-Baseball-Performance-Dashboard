import { profileMetricLabel } from "@/lib/profile-metric-label";
import type { PlayerMetricCard } from "@/lib/player-performance";

export type ProfileTrend = { key: string; label: string; unit: string; source: string; period: string; points: { date: string; value: number }[] };
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
/** Only the latest reading's exact partition; conflicting dates suppress the series. */
export function profileTrends(cards: readonly PlayerMetricCard[]): ProfileTrend[] {
  return cards.flatMap(card => {
    const latest = card.latest;
    if (!latest || latest.derived || !validDate(latest.measuredAt)) return [];
    const dates = new Map<string, number>();
    for (const reading of [...card.history, latest]) {
      if (reading.athleteCode !== latest.athleteCode || reading.metricKey !== latest.metricKey || reading.source !== latest.source || reading.unit !== latest.unit || reading.period !== latest.period || reading.derived || reading.measuredAt > latest.measuredAt) continue;
      if (!validDate(reading.measuredAt) || !Number.isFinite(reading.value) || reading.value < 0 || (dates.has(reading.measuredAt) && dates.get(reading.measuredAt) !== reading.value)) return [];
      dates.set(reading.measuredAt, reading.value);
    }
    if (dates.size < 2) return [];
    return [{ key: card.metric.key, label: profileMetricLabel(card.metric.key,card.metric.label,latest.source), unit: latest.unit, source: latest.source, period: latest.period === "fall_2026" ? "Fall 2026" : "June–August 2026", points: [...dates].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value })) }];
  });
}
/** Preserve original scale; invalid and unbounded ratios never become progress bars. */
export function gameRateWidth(value: number | null, unit: string): number | null {
  if (value === null || !Number.isFinite(value) || !["%", "avg"].includes(unit)) return null;
  const width = unit === "avg" ? value * 100 : value;
  return width >= 0 && width <= 100 ? width : null;
}
