import Link from "next/link";
import { Trophy } from "lucide-react";
import { LeaderboardResults } from "@/components/leaderboard-results";
import { LEADERBOARD_GROUPS, leaderboardGroupLabels, leaderboardMetricLabel, leaderboardMetrics, type LeaderboardComparison, type LeaderboardGroup, type LeaderboardRow } from "@/lib/leaderboards";
import { PLAYER_METRICS } from "@/lib/player-performance";

export type LeaderboardPanel = { comparison: LeaderboardComparison; rows: LeaderboardRow[] };

export function LeaderboardBoard({ group, panels }: { group: LeaderboardGroup; panels: LeaderboardPanel[] }) {
  const populated = panels.filter(panel => panel.rows.length > 0);
  const waiting = leaderboardMetrics(group).filter(metric => metric.key !== "bat_speed" && !populated.some(panel => panel.comparison.metricKey === metric.key));
  return <>
    <nav className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-1" aria-label="Leaderboard group">{LEADERBOARD_GROUPS.map(item => <Link key={item} href={`/leaderboards?group=${item}`} aria-current={group === item ? "page" : undefined} className={`flex-1 whitespace-nowrap rounded-md px-3 py-3 text-center text-sm font-semibold transition-colors ${group === item ? "bg-[#990000] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"}`}>{leaderboardGroupLabels[item]}</Link>)}</nav>
    {populated.length > 0 ? <div className="grid items-start gap-5 xl:grid-cols-2">{populated.map(({ comparison, rows }) => <LeaderboardResults key={comparison.metricKey} rows={rows} metric={PLAYER_METRICS.find(metric => metric.key === comparison.metricKey)!} unit={comparison.unit} source={comparison.source} />)}</div>
      : <section className="panel px-6 py-10 text-center sm:py-14"><span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-raised)] text-[var(--accent-readable)]"><Trophy size={23} aria-hidden="true" /></span><h2 className="mb-2 text-xl font-bold">No {leaderboardGroupLabels[group]} Results Yet</h2><p className="muted mx-auto mb-0 max-w-md text-sm">Rankings will appear here as testing results are added.</p></section>}
    {waiting.length > 0 && <section className="mt-6 rounded-lg border border-dashed border-[var(--line-subtle)] p-5" aria-label="Awaiting testing"><h2 className="muted mb-3 text-xs font-semibold uppercase tracking-wider">Awaiting Testing</h2><div className="flex flex-wrap gap-x-5 gap-y-2">{waiting.map(metric => <span key={metric.key} className="text-sm text-[var(--text-secondary)]">{leaderboardMetricLabel(metric)}</span>)}</div></section>}
    {populated.length > 0 && <details className="mt-6 text-xs text-[var(--text-secondary)]"><summary className="w-fit cursor-pointer font-medium">About These Rankings</summary><div className="mt-3 max-w-3xl space-y-2 leading-relaxed"><p>Each table uses the latest result per athlete from the same source, unit and testing period. Fall 2026 results are shown first; earlier body readings remain available when Fall results have not been recorded. Every reading shows its test date.</p><p>Where several comparisons exist, the table with the most measured athletes is shown, with the preferred recorded unit and source name used to break ties. Sources, units and testing periods are never combined. Height is displayed in feet and inches while its original unit remains separate for comparisons.</p><p>Only measured active and redshirt members of the 2026–27 roster appear. Equal results share a place. Body and spin values are numerical comparisons, not health or performance ratings.</p></div></details>}
  </>;
}
