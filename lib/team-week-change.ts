import { gameDirection } from "@/lib/game-metrics";
import type { SharedGameStat } from "@/lib/game-server";
import { pacificDay, type TeamGameTrends } from "@/lib/game-trends";
import type { TeamGameMetric } from "@/lib/team-game-stats";

export type TeamWeekChange = {
  currentDate: string; previousDate: string; previousValue: number;
  percent: number | null; direction: "up" | "down" | "same";
  tone: "good" | "bad" | "neutral";
};

/** Compare saved Fall-to-date rates, not games inferred from cumulative changes. */
export function teamWeekChange(trends: TeamGameTrends, source: SharedGameStat["source"], metric: TeamGameMetric, updatedAt: string | null): TeamWeekChange | null {
  if (!updatedAt || !Number.isFinite(Date.parse(updatedAt)) || metric.pending || metric.value === null || !Number.isFinite(metric.value) || metric.value < 0) return null;
  const currentDate = pacificDay(updatedAt);
  const dates = [...new Set(trends.snapshotDates?.[source] ?? [])].sort();
  // Current stats and streamed history must describe the same source version/day.
  if (dates.at(-1) !== currentDate) return null;
  const points = trends[source]?.[metric.metric] ?? [];
  const current = points.find(p => p.date === currentDate);
  if (!current || current.value !== metric.value) return null;
  const day = new Date(`${currentDate}T12:00:00Z`);
  const mondayOffset = (day.getUTCDay() + 6) % 7;
  const thisMonday = day.getTime() - mondayOffset * 86_400_000;
  const previousMonday = thisMonday - 7 * 86_400_000;
  const previousDate = dates.filter(date => {
    const timestamp = Date.parse(`${date}T12:00:00Z`);
    return timestamp >= previousMonday && timestamp < thisMonday;
  }).at(-1);
  if (!previousDate) return null;
  // The final saved version of the previous week is authoritative, even if pending.
  const previous = points.find(p => p.date === previousDate);
  if (!previous || !Number.isFinite(previous.value) || previous.value < 0) return null;
  const difference = metric.value - previous.value;
  const direction = difference > 0 ? "up" : difference < 0 ? "down" : "same";
  const preference = metric.metric.startsWith("pitching_") && metric.metric.endsWith("strike_pct") || metric.metric === "batting_sb_per_pa" ? "higher" : gameDirection(source, metric.metric);
  const tone = direction === "same" || preference === "neutral" ? "neutral" : (direction === "up") === (preference === "higher") ? "good" : "bad";
  const percent = previous.value === 0 ? difference === 0 ? 0 : null : difference / previous.value * 100;
  if (percent !== null && !Number.isFinite(percent)) return null;
  return { currentDate, previousDate, previousValue: previous.value, percent, direction, tone };
}
