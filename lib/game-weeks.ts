import type { SharedGameStat } from "@/lib/game-server";
import { latestDailySnapshots, type GameSnapshotRow } from "@/lib/game-trends";

type Observation = { athleteCode?: unknown; metric?: unknown; value?: unknown; unit?: unknown; scope?: unknown; eventId?: unknown };
export type GameWeek = {
  week: number; source: SharedGameStat["source"]; label: string; detail: string;
  /** Count rows keyed by PAC code in athlete_id until the caller maps them to roster ids. */
  rows: SharedGameStat[]; withheld: number;
};

function pacificDay(timestamp: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(timestamp));
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
/** Owner-confirmed Fall Ball week dates; sheet updates for a week may be saved days later. */
export const FALL_BALL_WEEK_DATES: Readonly<Record<number, string>> = { 1: "2026-09-12", 2: "2026-09-26" };
const ordinalDay = (day: number) => `${day}${day % 100 >= 11 && day % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][day % 10] ?? "th"}`;
export function fallBallWeekDate(week: number): string | null {
  const date = FALL_BALL_WEEK_DATES[week];
  if (!date) return null;
  const [, month, day] = date.split("-").map(Number);
  return `${new Date(Date.UTC(2026, month - 1, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })} ${ordinalDay(day)}`;
}
const shortDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dayGap = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;

function observations(snapshot: GameSnapshotRow): Observation[] {
  return Array.isArray(snapshot.observations) ? snapshot.observations as Observation[] : [];
}
function counts(snapshot: GameSnapshotRow, scope: "cumulative_fall" | "pitching_event", eventId: string | null) {
  const players = new Map<string, Map<string, { value: number; unit: "count" | "%" }>>();
  let invalid = false;
  for (const o of observations(snapshot)) {
    if (o.scope !== scope || (scope === "pitching_event" ? o.eventId !== eventId : false)) continue;
    if (typeof o.athleteCode !== "string" || typeof o.metric !== "string" || typeof o.value !== "number" || !Number.isFinite(o.value) || o.value < 0 || (o.unit !== "count" && o.unit !== "%")) { invalid = true; continue; }
    const own = players.get(o.athleteCode) ?? new Map();
    if (own.has(o.metric)) invalid = true;
    own.set(o.metric, { value: o.value, unit: o.unit });
    players.set(o.athleteCode, own);
  }
  return { players, invalid };
}
const row = (source: SharedGameStat["source"], snapshot: GameSnapshotRow, code: string, metric: string, value: number, unit: "count" | "%", scope: SharedGameStat["scope"], eventId: string | null, index: number): SharedGameStat => ({
  source, athlete_id: code, metric, value, unit, scope, event_id: eventId, played_on: null, source_row: 2 + index, source_column: 1,
  derived_from: [], snapshot_id: `${snapshot.id}:${eventId ?? "week"}`, fetched_at: snapshot.fetched_at, content_hash: snapshot.id,
});

/**
 * Pitching weeks come straight from the reviewed `fall-2026-week-N` blocks in the latest saved sheet.
 * The QPA sheet is cumulative only, so a hitting week is the change between the final saved versions
 * of consecutive update batches (versions saved within two days of each other are one batch).
 * A player whose count went down between versions is withheld for that week, never clipped to zero.
 */
export function gameWeeks(snapshots: readonly GameSnapshotRow[]): { hitting: GameWeek[]; pitching: GameWeek[] } {
  const daily = latestDailySnapshots(snapshots.filter(s => Array.isArray(s.observations))) as GameSnapshotRow[];
  const pitchingLatest = daily.filter(s => s.source === "pitching_fall_2026").at(-1);
  const pitching: GameWeek[] = [];
  if (pitchingLatest) {
    const weekIds = [...new Set(observations(pitchingLatest).map(o => o.eventId).filter((id): id is string => typeof id === "string" && /^fall-2026-week-[1-5]$/.test(id)))].sort();
    for (const eventId of weekIds) {
      const { players, invalid } = counts(pitchingLatest, "pitching_event", eventId);
      if (invalid) continue;
      const week = Number(eventId.at(-1));
      const rows = [...players].flatMap(([code, metrics]) => [...metrics].map(([metric, item], i) => row("pitching_fall_2026", pitchingLatest, code, metric, item.value, item.unit, "pitching_event", eventId, i)));
      pitching.push({ week, source: "pitching_fall_2026", label: `Week ${week}`, detail: fallBallWeekDate(week) ?? `Fall Ball Week ${week} pitching totals`, rows, withheld: 0 });
    }
  }
  const batches: { first: string; last: string; snapshot: GameSnapshotRow }[] = [];
  for (const snapshot of daily.filter(s => s.source === "qpa_fall_2026")) {
    const day = pacificDay(snapshot.fetched_at), batch = batches.at(-1);
    if (batch && dayGap(batch.last, day) <= 2) { batch.last = day; batch.snapshot = snapshot; } else batches.push({ first: day, last: day, snapshot });
  }
  const hitting: GameWeek[] = [];
  let previous: Map<string, Map<string, { value: number; unit: "count" | "%" }>> | null = null;
  for (const [index, batch] of batches.entries()) {
    const { players, invalid } = counts(batch.snapshot, "cumulative_fall", null);
    if (invalid) { previous = null; continue; }
    const rows: SharedGameStat[] = [];
    let withheld = 0;
    for (const [code, metrics] of players) {
      const before = previous?.get(code);
      const delta = new Map<string, number>();
      let decreased = false;
      for (const [metric, item] of metrics) {
        if (item.unit !== "count") continue;
        const change = item.value - (before?.get(metric)?.value ?? 0);
        if (change < 0) decreased = true;
        delta.set(metric, change);
      }
      if (decreased) { withheld++; continue; }
      const pa = delta.get("pa") ?? 0, qpa = delta.get("qpa");
      if (!(pa > 0)) continue;
      let i = 0;
      for (const [metric, value] of delta) rows.push(row("qpa_fall_2026", batch.snapshot, code, metric, value, "count", "cumulative_fall", null, i++));
      if (qpa !== undefined) rows.push(row("qpa_fall_2026", batch.snapshot, code, "qpa_pct", 100 * qpa / pa, "%", "cumulative_fall", null, i));
    }
    // Without a valid earlier version, a later batch would count the whole Fall as one week.
    if (index === 0 || previous) hitting.push({ week: index + 1, source: "qpa_fall_2026", label: `Week ${index + 1}`,
      detail: fallBallWeekDate(index + 1) ?? `Sheet changes saved ${batch.first === batch.last ? shortDate(batch.first) : `${shortDate(batch.first)}–${shortDate(batch.last)}`}`, rows, withheld });
    previous = players;
  }
  return { hitting, pitching };
}
