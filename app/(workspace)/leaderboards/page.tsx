import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { LeaderboardFilters } from "@/components/leaderboard-filters";
import { LeaderboardResults } from "@/components/leaderboard-results";
import { loadLeaderboard, loadLeaderboardComparisons } from "@/lib/leaderboard-server";
import { initialLeaderboardSelection, LEADERBOARD_GROUPS, leaderboardComparisonMatches, leaderboardGroupLabels, leaderboardSourceLabel, type LeaderboardGroup } from "@/lib/leaderboards";
import { PLAYER_METRICS, PLAYER_PERFORMANCE_PERIODS } from "@/lib/player-performance";
export default async function LeaderboardsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requireAccess(["admin", "coach", "player"]), query = await searchParams;
  const group: LeaderboardGroup = LEADERBOARD_GROUPS.find(group => group === query.group) ?? "physicality";
  const comparisons = await loadLeaderboardComparisons(access), selection = initialLeaderboardSelection(group, comparisons, query);
  const selected = comparisons.some(option => leaderboardComparisonMatches(option, selection));
  const rows = selected ? await loadLeaderboard(access, selection) : [];
  const metric = PLAYER_METRICS.find(metric => metric.key === selection.metricKey)!;
  return <><PageHeading section="Pacific Baseball / Team Results" title="Leaderboards" description="Reviewed team measurements, organized by the same source, unit and testing period." />
    <nav className="mb-6 flex flex-wrap gap-3" aria-label="Leaderboard group">{LEADERBOARD_GROUPS.map(item => <Link key={item} href={`/leaderboards?group=${item}&period=fall_2026`} aria-current={group === item ? "page" : undefined} className={`btn ${group === item ? "btn-primary" : "btn-secondary"}`}>{leaderboardGroupLabels[item]}</Link>)}</nav>
    <LeaderboardFilters key={JSON.stringify(selection)} group={group} comparisons={comparisons} selection={selection} />
    <p className="muted mb-4 text-sm">{PLAYER_PERFORMANCE_PERIODS[selection.period].label}{selection.source ? ` · ${leaderboardSourceLabel(selection.source)}` : ""} · {selection.unit}</p>
    <LeaderboardResults rows={rows} metric={metric} unit={selection.unit} />
    <p className="muted mt-5 text-xs">2026–27 active and redshirt roster. Athletes without a comparable reviewed reading are omitted. Different sources, units and periods stay separate.</p>
  </>;
}
