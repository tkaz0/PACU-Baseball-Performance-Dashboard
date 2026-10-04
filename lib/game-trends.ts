import { teamGameSummary } from "@/lib/team-game-stats";
import type { SharedGameStat } from "@/lib/game-server";

export type TrendPoint = { date: string; value: number };
/** source → team rate metric → one point per sync date. */
export type TeamGameTrends = Partial<Record<SharedGameStat["source"], Record<string, TrendPoint[]>>>;
export type GameSnapshotRow = { id: string; source: SharedGameStat["source"]; fetched_at: string; observations: unknown };

type Observation = { athleteCode?: unknown; metric?: unknown; value?: unknown; unit?: unknown; scope?: unknown; eventId?: unknown; playedOn?: unknown; sourceRow?: unknown; sourceColumn?: unknown; derivedFrom?: unknown };

function pacificDay(timestamp: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(timestamp));
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Same deterministic daily selection for metadata fetches and rate rebuilding. */
export function latestDailySnapshots<T extends Omit<GameSnapshotRow,"observations">>(snapshots: readonly T[]): T[] {
  const ordered=[...snapshots].filter(s=>/^\d{4}-\d{2}-\d{2}/.test(s.fetched_at)&&Number.isFinite(Date.parse(s.fetched_at))).sort((a,b)=>Date.parse(a.fetched_at)-Date.parse(b.fetched_at)||a.id.localeCompare(b.id));
  const latest=new Map<string,T>();
  for(const snapshot of ordered)latest.set(`${snapshot.source}:${pacificDay(snapshot.fetched_at)}`,snapshot);
  return [...latest.values()];
}

/** Rebuilds each saved sheet version as-of its sync and applies the same team calculations used today. */
export function teamGameTrends(snapshots: readonly GameSnapshotRow[]): TeamGameTrends {
  const result: TeamGameTrends = {};
  // A later pending/empty source version cannot resurrect an earlier result.
  for (const snapshot of latestDailySnapshots(snapshots)) {
    if(!Array.isArray(snapshot.observations))continue;
    const rows: SharedGameStat[] = (snapshot.observations as Observation[]).flatMap(o => typeof o?.athleteCode === "string" && typeof o.metric === "string" && typeof o.value === "number" && Number.isFinite(o.value) && (o.unit === "count" || o.unit === "%") && (o.scope === "cumulative_fall" || o.scope === "pitching_event") ? [{
      source: snapshot.source, athlete_id: o.athleteCode, metric: o.metric, value: o.value, unit: o.unit, scope: o.scope,
      event_id: typeof o.eventId === "string" ? o.eventId : "", played_on: typeof o.playedOn === "string" ? o.playedOn : null,
      source_row: typeof o.sourceRow === "number" ? o.sourceRow : 2, source_column: typeof o.sourceColumn === "number" ? o.sourceColumn : 0,
      derived_from: Array.isArray(o.derivedFrom) ? o.derivedFrom.filter((n): n is number => typeof n === "number") : [],
      snapshot_id: snapshot.id, fetched_at: snapshot.fetched_at, content_hash: snapshot.id,
    }] : []);
    if (!rows.length) continue;
    const summary = teamGameSummary(rows, snapshot.source), date = pacificDay(snapshot.fetched_at);
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
