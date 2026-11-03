import { fallBallWeekDates, type GameWeekSet } from "@/lib/game-weeks";
import { formatInnings } from "@/lib/pitching-stats";
import { formatTeamGameMetric, teamGameSummary, type TeamGameSummary } from "@/lib/team-game-stats";
import type { ReportCardArea } from "@/lib/team-report-card";
import { GAME_METRIC_LABELS, gameDirection, gameValue, type GameLeaderboardRow } from "@/lib/game-metrics";
import { gameSampleText } from "@/lib/game-opportunities";

export const TEAM_REVIEW_HITTING = ["batting_ops", "batting_obp", "batting_est_slg", "batting_est_iso", "qpa_pct", "batting_k_pct", "batting_bb_pct", "batting_hh_pct"] as const;
export const TEAM_REVIEW_PITCHING = ["pitching_whip", "pitching_k_bb", "pitching_k9", "pitching_bb9", "pitching_r9", "strike_pct"] as const;

export type TeamReviewCell = { value: string; pending: boolean };
export type TeamReviewColumn = { key: string; label: string; detail: string | null };
export type TeamReviewTrend = { metric: string; label: string; cells: (TeamReviewCell | null)[] };

/** A pooled team rate, or a pending marker; never zero-filled. */
export function teamRate(summary: TeamGameSummary | null, metric: string): TeamReviewCell | null {
  const rate = summary?.rates.find(r => r.metric === metric);
  if (!rate) return null;
  return rate.pending || rate.value === null ? { value: "—", pending: true } : { value: formatTeamGameMetric(rate), pending: false };
}
export function teamCount(summary: TeamGameSummary | null, metric: string): string {
  const count = summary?.counts.find(c => c.metric === metric);
  if (!count || count.pending || count.value === null) return "—";
  return metric === "innings_outs" ? formatInnings(count.value) : count.value.toLocaleString("en-US");
}
const short = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Team rates for each Fall Ball week, then the Boxer World Series, then the cumulative Fall line. Each week pools
 * only that week's counts (hitting: counts added between saved QPA batches; pitching: the sheet's weekly blocks),
 * with the same team definitions as Team Game Stats. BWS stays its own column, never a Fall Ball week.
 */
export function teamReviewTrends(weeks: GameWeekSet | null, fall: { batting: TeamGameSummary | null; pitching: TeamGameSummary | null }, labels: Record<string, string>) {
  const numbers = [...new Set([...(weeks?.hitting ?? []), ...(weeks?.pitching ?? [])].map(w => w.week))].sort((a, b) => a - b);
  const columns: TeamReviewColumn[] = numbers.map(week => { const date = fallBallWeekDates()[week]; return { key: `week-${week}`, label: `Wk ${week}`, detail: date ? short(date) : null }; });
  const summaries = numbers.map(week => ({
    batting: (() => { const w = weeks?.hitting.find(x => x.week === week); return w ? teamGameSummary(w.rows, "qpa_fall_2026") : null; })(),
    pitching: (() => { const w = weeks?.pitching.find(x => x.week === week); return w ? teamGameSummary(w.rows, "pitching_fall_2026") : null; })(),
  }));
  if (weeks?.bws.hitting || weeks?.bws.pitching) {
    columns.push({ key: "bws", label: "BWS", detail: "Oct 23–31" });
    summaries.push({ batting: weeks.bws.hitting ? teamGameSummary(weeks.bws.hitting.rows, "qpa_fall_2026") : null, pitching: weeks.bws.pitching ? teamGameSummary(weeks.bws.pitching.rows, "pitching_fall_2026") : null });
  }
  columns.push({ key: "fall", label: "Fall", detail: "Final" });
  summaries.push(fall);
  const line = (side: "batting" | "pitching", metric: string): TeamReviewTrend => ({ metric, label: labels[metric] ?? metric, cells: summaries.map(s => teamRate(s[side], metric)) });
  return { columns, hitting: TEAM_REVIEW_HITTING.map(m => line("batting", m)), pitching: TEAM_REVIEW_PITCHING.map(m => line("pitching", m)) };
}

/** Report-card areas at B or better are strengths; D or F are focus areas. C stays in neither list. */
export function teamReviewThemes(areas: readonly ReportCardArea[]) {
  return { working: areas.filter(a => a.level >= 3), focus: areas.filter(a => a.level <= 1).sort((a, b) => a.level - b.level) };
}

export type TeamStatLeader = { metric: string; label: string; value: string; names: string[]; sample: string | null };
const LEADER_LABELS: Record<string, string> = { pumps: "Home Runs", sb: "Stolen Bases", k: "Strikeouts", strike_pct: "Strike %" };
/** Rate leaders come only from qualified players (the Qualified leaderboard minimum); counting stats include everyone. */
export const TEAM_LEADER_METRICS = {
  hitting: { rates: ["batting_avg", "batting_obp", "batting_ops", "batting_est_iso", "qpa_pct", "batting_bb_pct", "batting_k_pct"], counts: ["pumps", "sb"] },
  pitching: { rates: ["pitching_whip", "pitching_k9", "pitching_k_bb", "pitching_bb9", "pitching_r9", "strike_pct"], counts: ["k"] },
} as const;

/**
 * The best Fall value per stat from the signed-in game leaderboard projection, ties listed together. Direction follows
 * the leaderboard (lower K%, WHIP, BB/9 and Runs/9 lead). Pitching uses the cumulative Fall rows only.
 */
export function teamStatLeaders(rows: readonly GameLeaderboardRow[], discipline: "hitting" | "pitching", qualified: ReadonlySet<string>, labels: Record<string, string>): TeamStatLeader[] {
  const source = discipline === "hitting" ? "qpa_fall_2026" : "pitching_fall_2026";
  const pool = rows.filter(r => r.source === source && (discipline === "hitting" || r.eventId === "fall-2026-cumulative") && Number.isFinite(r.value));
  const metrics = TEAM_LEADER_METRICS[discipline];
  return [...metrics.rates.map(m => [m, true] as const), ...metrics.counts.map(m => [m, false] as const)].flatMap(([metric, rate]) => {
    const candidates = pool.filter(r => r.metric === metric && (!rate || qualified.has(r.code)));
    if (!candidates.length) return [];
    const lower = gameDirection(source, metric) === "lower";
    const best = candidates.reduce((b, r) => lower ? Math.min(b, r.value) : Math.max(b, r.value), lower ? Infinity : -Infinity);
    const top = candidates.filter(r => Math.abs(r.value - best) < 1e-9).sort((a, b) => a.name.localeCompare(b.name));
    return [{ metric, label: LEADER_LABELS[metric] ?? labels[metric] ?? GAME_METRIC_LABELS[metric] ?? metric, value: gameValue(best, top[0].unit), names: top.map(r => r.name),
      sample: top.length === 1 && top[0].opportunities != null ? gameSampleText(top[0].source, top[0].metric, top[0].opportunities) : null }];
  });
}
