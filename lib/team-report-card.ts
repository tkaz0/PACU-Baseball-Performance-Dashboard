import { benchmarkGrade, statBenchmark, GRADE_LABELS } from "@/lib/stat-benchmarks";
import { formatTeamGameMetric, type TeamGameMetric, type TeamGameSummary } from "@/lib/team-game-stats";

export const REPORT_CARD_AREAS = [
  { key: "offense", label: "On-Base", metric: "batting_obp", side: "hitting" },
  { key: "power", label: "Power", metric: "batting_est_iso", side: "hitting" },
  { key: "contact", label: "Contact", metric: "batting_k_pct", side: "hitting" },
  { key: "discipline", label: "Discipline", metric: "batting_bb_pct", side: "hitting" },
  { key: "speed", label: "Speed", metric: "batting_sb_per_pa", side: "hitting" },
  { key: "prevention", label: "Run Prevention", metric: "pitching_r9", side: "pitching" },
  { key: "miss", label: "Miss Bats", metric: "pitching_k9", side: "pitching" },
  { key: "command", label: "Command", metric: "pitching_bb9", side: "pitching" },
  { key: "traffic", label: "Traffic", metric: "pitching_whip", side: "pitching" },
] as const;
const LETTERS = ["F", "D", "C", "B", "A"] as const;

export type ReportCardArea = { key: string; label: string; metric: string; statLabel: string; value: string; grade: (typeof LETTERS)[number]; band: (typeof GRADE_LABELS)[number]; level: number; sample: string | null };

/**
 * Pooled Pacific team rates graded against the published 2025 NWC team distribution (9 teams):
 * each fifth of that distribution is one letter. Pending or unmatched rates are left out, never zero.
 * There is no overall grade; each area stands alone.
 */
export function teamReportCard(batting: TeamGameSummary | null, pitching: TeamGameSummary | null): ReportCardArea[] {
  return REPORT_CARD_AREAS.flatMap(area => {
    const rate: TeamGameMetric | undefined = (area.side === "hitting" ? batting : pitching)?.rates.find(r => r.metric === area.metric);
    if (!rate || rate.pending || rate.value === null || !Number.isFinite(rate.value)) return [];
    const benchmark = statBenchmark(area.metric, { scope: "team", unit: rate.unit });
    if (!benchmark || benchmark.direction === "neutral") return [];
    const level = benchmarkGrade(rate.value, benchmark);
    return [{ key: area.key, label: area.label, metric: area.metric, statLabel: rate.label, value: formatTeamGameMetric(rate), grade: LETTERS[level], band: GRADE_LABELS[level], level,
      sample: rate.opportunities != null && rate.opportunityLabel ? `${rate.opportunities.toLocaleString("en-US")} ${rate.opportunityLabel}` : null }];
  });
}
