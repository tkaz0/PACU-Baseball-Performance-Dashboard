import type { ReactNode } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { LeaderboardResults } from "@/components/leaderboard-results";
import { LEADERBOARD_METRICS, LEADERBOARD_GROUPS, leaderboardGroupLabels, leaderboardMetricLabel, leaderboardMetrics, type LeaderboardComparison, type LeaderboardGroup, type LeaderboardRow } from "@/lib/leaderboards";

export type LeaderboardPanel = { comparison: LeaderboardComparison; rows: LeaderboardRow[] };

export function LeaderboardBoard({ group, panels, composite }: { group: LeaderboardGroup; panels: LeaderboardPanel[]; composite?: ReactNode }) {
  const populated = panels.filter(panel => panel.rows.length > 0);
  const waiting = leaderboardMetrics(group).filter(metric => metric.key !== "bat_speed" && !populated.some(panel => panel.comparison.metricKey === metric.key));
  return <>
    <nav className="leaderboard-navigation" aria-label="Leaderboard group">{LEADERBOARD_GROUPS.map(item => <Link key={item} href={`/leaderboards?group=${item}`} aria-current={group === item ? "page" : undefined}>{leaderboardGroupLabels[item]}</Link>)}</nav>
    {composite}
    {populated.length > 0 ? <div className="leaderboard-grid">{populated.map(({ comparison, rows }) => <LeaderboardResults key={comparison.metricKey} rows={rows} metric={LEADERBOARD_METRICS.find(metric => metric.key === comparison.metricKey)!} unit={comparison.unit} source={comparison.source} period={comparison.period} />)}</div>
      : <section className="panel px-6 py-10 text-center sm:py-14"><span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-raised)] text-[var(--accent-readable)]"><Trophy size={23} aria-hidden="true" /></span><h2 className="mb-2 text-xl font-bold">No {leaderboardGroupLabels[group]} Results Yet</h2><p className="muted mx-auto mb-0 max-w-md text-sm">Rankings will appear here as testing results are added.</p></section>}
    {waiting.length > 0 && <details className="leaderboard-waiting" open={populated.length === 0}><summary>Awaiting Testing <span>{waiting.length} {waiting.length === 1 ? "metric" : "metrics"}</span></summary><div className="flex flex-wrap gap-2 pt-4">{waiting.map(metric => <span key={metric.key} className="rounded-md bg-[var(--surface-raised)] px-3 py-2 text-xs text-[var(--text-secondary)]">{leaderboardMetricLabel(metric)}</span>)}</div></details>}
    {populated.length > 0 && <details className="mt-6 text-xs text-[var(--text-secondary)]"><summary className="w-fit cursor-pointer font-medium">About These Rankings</summary><div className="mt-3 max-w-3xl space-y-2 leading-relaxed"><p>Each table uses the latest result per athlete from the same source, unit and testing period. Fall 2026 results are shown first; earlier body readings remain available when Fall results have not been recorded. Every reading shows its test date.</p><p>Where several comparisons exist, the table with the most measured athletes is shown, with the preferred recorded unit and source name used to break ties. Sources, units and testing periods are never combined. Height is displayed in feet and inches while its original unit remains separate for comparisons.</p><p>Height ranks tallest first, total Muscle Mass highest first, and Body Fat % lowest first. Only measured active and redshirt members of the 2026–27 roster appear. Equal results share a rank, such as 1, 1, 3. Body and spin values are numerical comparisons, not health or performance ratings.</p></div></details>}
  </>;
}
