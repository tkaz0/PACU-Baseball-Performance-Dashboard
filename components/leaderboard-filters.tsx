"use client";
import { useState } from "react";
import { PLAYER_METRICS, PLAYER_PERFORMANCE_PERIODS } from "@/lib/player-performance";
import { leaderboardMetrics, leaderboardSourceLabel, type LeaderboardComparison, type LeaderboardGroup, type LeaderboardSelection } from "@/lib/leaderboards";
export function LeaderboardFilters({ group, comparisons, selection }: { group: LeaderboardGroup; comparisons: LeaderboardComparison[]; selection: LeaderboardSelection }) {
  const [draft, setDraft] = useState(selection);
  const metric = PLAYER_METRICS.find(metric => metric.key === draft.metricKey)!;
  const candidates = comparisons.filter(option => option.metricKey === draft.metricKey && option.period === draft.period);
  const sources = [...new Set(candidates.filter(option => option.unit === draft.unit).map(option => option.source))];
  function change(changes: Partial<LeaderboardSelection>) {
    const next = { ...draft, ...changes }, definition = PLAYER_METRICS.find(metric => metric.key === next.metricKey)!;
    if (definition.group !== "body") next.period = "fall_2026";
    const available = comparisons.filter(option => option.metricKey === next.metricKey && option.period === next.period);
    if (!definition.units.includes(next.unit)) next.unit = available[0]?.unit ?? definition.units[0];
    if (!available.some(option => option.unit === next.unit && option.source === next.source)) next.source = available.find(option => option.unit === next.unit)?.source ?? "";
    setDraft(next);
  }
  return <form method="get" action="/leaderboards" className="panel mb-6 p-5 sm:p-6">
    <input type="hidden" name="group" value={group} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <label>Measurement<select name="metric" value={draft.metricKey} onChange={event => change({ metricKey: event.target.value as LeaderboardSelection["metricKey"] })}>{leaderboardMetrics(group).map(metric => <option key={metric.key} value={metric.key}>{metric.label}</option>)}</select></label>
      <label>Testing Period<select name="period" value={draft.period} onChange={event => change({ period: event.target.value as LeaderboardSelection["period"] })}><option value="fall_2026">{PLAYER_PERFORMANCE_PERIODS.fall_2026.label}</option>{metric.group === "body" && <option value="summer_2026">{PLAYER_PERFORMANCE_PERIODS.summer_2026.label}</option>}</select></label>
      <label>Unit<select name="unit" value={draft.unit} onChange={event => change({ unit: event.target.value })}>{metric.units.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label>
      <label>Source / Protocol<select name="source" value={draft.source} onChange={event => change({ source: event.target.value })}>{!sources.length && <option value="">No reviewed readings</option>}{sources.map(source => <option key={source} value={source}>{leaderboardSourceLabel(source)}</option>)}</select></label>
    </div><button type="submit" className="btn btn-primary mt-5">Show Results</button>
  </form>;
}
