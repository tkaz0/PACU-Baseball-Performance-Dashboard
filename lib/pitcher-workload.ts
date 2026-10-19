import type { SharedGameStat } from "@/lib/game-server";
import type { CoachingPlayer } from "@/lib/coaching-tools";

export type WorkloadWeek = { week: number; pitches: number | null; outs: number | null };
export type WorkloadRow = { player: CoachingPlayer; weeks: WorkloadWeek[]; total: number; latest: WorkloadWeek | null; previous: WorkloadWeek | null; jump: number | null; flagged: boolean };
/** A week is flagged when pitches rose by at least half over the pitcher's previous pitched week and reached 30+. */
export const WORKLOAD_JUMP = 0.5, WORKLOAD_MIN_PITCHES = 30;
const WEEK = /^fall-2026-week-([1-9])$/;

/**
 * Pitches and outs per pitcher for each reviewed Fall Ball week block of the current pitching sheet
 * (never dated games or cumulative totals, so nothing is counted twice). Descriptive usage only;
 * no rest or pitch-count rules.
 */
export function pitcherWorkload(players: readonly CoachingPlayer[], stats: readonly SharedGameStat[]) {
  const weekly = stats.filter(s => s.source === "pitching_fall_2026" && s.scope === "pitching_event" && s.event_id && WEEK.test(s.event_id) && Number.isFinite(s.value) && s.value >= 0);
  const snapshots = new Set(weekly.map(s => s.snapshot_id));
  if (snapshots.size > 1) return { weeks: [] as number[], rows: [] as WorkloadRow[] };
  const weekNumbers = [...new Set(weekly.map(s => Number(WEEK.exec(s.event_id!)![1])))].sort((a, b) => a - b);
  const rows: WorkloadRow[] = [];
  for (const player of players) {
    const own = weekly.filter(s => s.athlete_id === player.id);
    if (!own.length) continue;
    const value = (week: number, metric: string) => { const hits = own.filter(s => s.event_id === `fall-2026-week-${week}` && s.metric === metric); return hits.length === 1 ? hits[0].value : null; };
    const weeks = weekNumbers.map(week => ({ week, pitches: value(week, "pitches"), outs: value(week, "innings_outs") }));
    const pitched = weeks.filter(w => (w.pitches ?? 0) > 0);
    const latest = pitched.at(-1) ?? null, previous = pitched.length > 1 ? pitched.at(-2)! : null;
    const jump = latest?.pitches != null && previous?.pitches ? (latest.pitches - previous.pitches) / previous.pitches : null;
    rows.push({ player, weeks, total: weeks.reduce((t, w) => t + (w.pitches ?? 0), 0), latest, previous, jump,
      flagged: jump !== null && jump >= WORKLOAD_JUMP && (latest?.pitches ?? 0) >= WORKLOAD_MIN_PITCHES && latest?.week === weekNumbers.at(-1) });
  }
  rows.sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.total - a.total || a.player.name.localeCompare(b.player.name));
  return { weeks: weekNumbers, rows };
}
