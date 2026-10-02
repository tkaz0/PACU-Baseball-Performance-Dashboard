import { teamGameSummary } from "@/lib/team-game-stats";
import type { SharedGameStat } from "@/lib/game-server";

export type TrendPoint = { date: string; value: number };
/** source → team rate metric → one point per sync date. */
export type TeamGameTrends = Partial<Record<SharedGameStat["source"], Record<string, TrendPoint[]>>>;
export type GameSnapshotRow = { id: string; source: SharedGameStat["source"]; fetched_at: string; observations: unknown };

type Observation = { athleteCode?: unknown; metric?: unknown; value?: unknown; unit?: unknown; scope?: unknown; eventId?: unknown; playedOn?: unknown; sourceRow?: unknown; sourceColumn?: unknown; derivedFrom?: unknown };

/** Rebuilds each saved sheet version as-of its sync and applies the same team calculations used today. */
export function teamGameTrends(snapshots: readonly GameSnapshotRow[]): TeamGameTrends {
  const result: TeamGameTrends = {};
  const ordered = [...snapshots].filter(s => /^\d{4}-\d{2}-\d{2}/.test(s.fetched_at) && Array.isArray(s.observations)).sort((a, b) => a.fetched_at.localeCompare(b.fetched_at));
  for (const snapshot of ordered) {
    const rows: SharedGameStat[] = (snapshot.observations as Observation[]).flatMap(o => typeof o?.athleteCode === "string" && typeof o.metric === "string" && typeof o.value === "number" && Number.isFinite(o.value) && (o.unit === "count" || o.unit === "%") && (o.scope === "cumulative_fall" || o.scope === "pitching_event") ? [{
      source: snapshot.source, athlete_id: o.athleteCode, metric: o.metric, value: o.value, unit: o.unit, scope: o.scope,
      event_id: typeof o.eventId === "string" ? o.eventId : "", played_on: typeof o.playedOn === "string" ? o.playedOn : null,
      source_row: typeof o.sourceRow === "number" ? o.sourceRow : 2, source_column: typeof o.sourceColumn === "number" ? o.sourceColumn : 0,
      derived_from: Array.isArray(o.derivedFrom) ? o.derivedFrom.filter((n): n is number => typeof n === "number") : [],
      snapshot_id: snapshot.id, fetched_at: snapshot.fetched_at, content_hash: snapshot.id,
    }] : []);
    if (!rows.length) continue;
    const summary = teamGameSummary(rows, snapshot.source), date = snapshot.fetched_at.slice(0, 10);
    const bySource = result[snapshot.source] ??= {};
    for (const rate of summary.rates) {
      if (rate.pending || rate.value === null || !Number.isFinite(rate.value)) continue;
      const points = bySource[rate.metric] ??= [];
      // Several syncs on one day keep the latest version.
      if (points.at(-1)?.date === date) points[points.length - 1] = { date, value: rate.value }; else points.push({ date, value: rate.value });
    }
  }
  return result;
}
