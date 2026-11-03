import { fallBallWeekDate, type GameWeekSet } from "@/lib/game-weeks";
import { formatInnings } from "@/lib/pitching-stats";
import { formatTeamGameMetric, teamGameSummary, type TeamGameSummary } from "@/lib/team-game-stats";
import type { ReportCardArea } from "@/lib/team-report-card";

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
  const columns: TeamReviewColumn[] = numbers.map(week => { const date = fallBallWeekDate(week); return { key: `week-${week}`, label: `Wk ${week}`, detail: date ? short(date) : null }; });
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
