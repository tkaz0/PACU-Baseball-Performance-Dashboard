import { gameDirection } from "@/lib/game-metrics";
import type { SharedGameStat } from "@/lib/game-server";
import { pacificDay, type TeamGameTrends } from "@/lib/game-trends";
import type { TeamGameMetric } from "@/lib/team-game-stats";
import { fallBallWeekThrough, fallBallWeekDates } from "@/lib/game-weeks";

export type TeamWeekChange = {
  currentDate: string; previousDate: string; previousValue: number;
  /** True when the previous Monday–Sunday week had no saved update and the latest earlier update was used. */
  fallback: boolean;
  percent: number | null; direction: "up" | "down" | "same";
  tone: "good" | "bad" | "neutral";
  /** Pitching's reviewed source weeks, rather than calendar weeks of sheet saves. */
  currentWeek?: number; previousWeek?: number;
  tournament?: boolean;
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
  const before = dates.filter(date => Date.parse(`${date}T12:00:00Z`) < thisMonday);
  const lastWeek = before.filter(date => Date.parse(`${date}T12:00:00Z`) >= previousMonday).at(-1);
  // Owner choice (October 12): if last week had no saved update, compare with the latest earlier one.
  let previousDate = lastWeek ?? before.at(-1);
  let currentWeek: number | undefined, previousWeek: number | undefined;
  const tournament=source==="pitching_fall_2026" && !!trends.pitchingTournamentDates?.includes(currentDate);
  if (source === "pitching_fall_2026" && trends.pitchingWeeks && !tournament) {
    const coverage = trends.pitchingWeeks;
    const week = coverage[currentDate];
    if (!week) return null;
    currentWeek = week;
    const earlier = dates.filter(date => date < currentDate && coverage[date] !== null && coverage[date] !== undefined && coverage[date]! < week);
    previousWeek = earlier.length ? Math.max(...earlier.map(date => coverage[date]!)) : undefined;
    previousDate = earlier.filter(date => coverage[date] === previousWeek).at(-1);
    // A newer unreviewable version must not resurrect an older valid baseline.
    if (previousDate && dates.some(date => date > previousDate! && date < currentDate && coverage[date] == null)) return null;
  }
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
  return { currentDate, previousDate, previousValue: previous.value, percent, direction, tone,
    fallback: currentWeek !== undefined ? previousWeek !== currentWeek - 1 : !lastWeek,
    ...(tournament ? {tournament:true} : {}),
    ...(currentWeek !== undefined ? { currentWeek, previousWeek } : {}) };
}

const shortDay = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
/** Owner choice: name comparisons by BDL game week (e.g. "Week 2 · Sep 26"), not the day the sheet was saved. */
export function weekChangeSince(change: TeamWeekChange): { since: string; byWeek: boolean; before: { week: number; date: string } | null; now: { week: number; date: string } | null } {
  const dates = fallBallWeekDates();
  const before = change.previousWeek !== undefined ? dates[change.previousWeek] ? { week: change.previousWeek, date: dates[change.previousWeek] } : null : fallBallWeekThrough(change.previousDate);
  const now = change.tournament ? null : change.currentWeek !== undefined ? dates[change.currentWeek] ? { week: change.currentWeek, date: dates[change.currentWeek] } : null : fallBallWeekThrough(change.currentDate);
  const byWeek = !!before && !!now && before.week !== now.week;
  return { since: byWeek ? `Week ${before!.week} · ${shortDay(before!.date)}` : change.fallback ? shortDay(change.previousDate) : "last week", byWeek, before, now };
}
