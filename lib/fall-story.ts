import type { Measurement } from "@/lib/imports/engine";
import { isTimedMetric, normalizePlayerMetric, PLAYER_METRICS } from "@/lib/player-performance";
import { sessionTimeline, type TimelineSession } from "@/lib/session-timeline";

export type FallBestPin = { key: string; metric: string; label: string; source: string; unit: string; value: number; date: string };
/**
 * A player's Fall at a glance: saved testing/session dates, confirmed game weeks, and where each Fall
 * best happened. A best needs repeat results on at least two dates for the same metric/source/unit, and
 * only directional metrics qualify (neutral body/spin measurements never become a "best").
 */
export function fallStory(readings: readonly Measurement[], weekDates: Readonly<Record<number, string>>, today: string) {
  const fall = readings.filter(r => r.measured_at >= "2026-09-01" && r.measured_at <= today && r.measured_at <= "2026-12-31");
  const sessions: TimelineSession[] = sessionTimeline(fall);
  const groups = new Map<string, Measurement[]>();
  for (const row of fall) {
    const metric = normalizePlayerMetric(row.metric, row.unit);
    const def = metric ? PLAYER_METRICS.find(m => m.key === metric.key) : undefined;
    if (!metric || !def || def.direction === "neutral" || !Number.isFinite(row.value)) continue;
    const key = JSON.stringify([metric.key, row.source, row.unit]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const bests: FallBestPin[] = [];
  for (const [key, rows] of groups) {
    if (new Set(rows.map(r => r.measured_at)).size < 2) continue;
    const metric = normalizePlayerMetric(rows[0].metric, rows[0].unit)!, def = PLAYER_METRICS.find(m => m.key === metric.key)!;
    const lower = isTimedMetric(metric.key) || def.direction === "lower";
    const best = [...rows].sort((a, b) => (lower ? a.value - b.value : b.value - a.value) || b.measured_at.localeCompare(a.measured_at))[0];
    bests.push({ key, metric: metric.key, label: def.label, source: best.source, unit: best.unit, value: best.value, date: best.measured_at });
  }
  bests.sort((a, b) => b.date.localeCompare(a.date) || a.label.localeCompare(b.label));
  const weeks = Object.entries(weekDates).map(([week, date]) => ({ week: Number(week), date })).filter(w => Number.isSafeInteger(w.week) && w.date <= today).sort((a, b) => a.week - b.week);
  return { sessions, bests, weeks };
}
