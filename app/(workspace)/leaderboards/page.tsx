import { requireAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { LeaderboardBoard } from "@/components/leaderboard-board";
import { loadLeaderboard, loadLeaderboardComparisons } from "@/lib/leaderboard-server";
import { LEADERBOARD_GROUPS, visibleLeaderboardComparisons } from "@/lib/leaderboards";

export default async function LeaderboardsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requireAccess(["admin", "coach", "player"]);
  const query = await searchParams;
  const group = LEADERBOARD_GROUPS.find(group => group === query.group) ?? "physicality";
  const comparisons = visibleLeaderboardComparisons(group, await loadLeaderboardComparisons(access));
  const panels = await Promise.all(comparisons.map(async comparison => ({ comparison, rows: await loadLeaderboard(access, comparison) })));
  return <><PageHeading section="Pacific Baseball / Team Results" title="Leaderboards" description="Team rankings from the latest testing results." /><LeaderboardBoard group={group} panels={panels} /></>;
}
