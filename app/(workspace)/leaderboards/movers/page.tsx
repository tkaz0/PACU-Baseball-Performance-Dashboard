import { PageHeading } from "@/components/page-heading";
import { LeaderboardNavigation } from "@/components/leaderboard-navigation";
import { TeamMovers } from "@/components/team-movers";
import { requireRenderImportAccess } from "@/lib/render-access";
import { loadCoachingData } from "@/lib/analytics-server";
import { teamMovers } from "@/lib/team-movers";
import { pacificTestingDate } from "@/lib/testing-checklist";

export const metadata = { title: "Biggest Jumps" };
/** Staff only: repeat-test changes come from every player's readings, which players cannot read. */
export default async function MoversPage() {
  await requireRenderImportAccess();
  const data = await loadCoachingData();
  return <><PageHeading section="Team" title="Biggest Jumps" description="Fall 2026 · The biggest improvements since each player's previous test."/>
    <div className="mb-5"><LeaderboardNavigation group="movers" staff/></div>
    <TeamMovers boards={teamMovers(data, pacificTestingDate())}/></>;
}
