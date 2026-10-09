import { PageHeading } from "@/components/page-heading";
import { LeaderboardNavigation } from "@/components/leaderboard-navigation";
import { TeamRecords } from "@/components/team-records";
import { requireRenderAccess as requireAccess } from "@/lib/render-access";
import { loadTeamRecords } from "@/lib/team-records-server";
import { loadTeamHeadshots } from "@/lib/headshots-server";

export const metadata = { title: "Team Records" };
export default async function TeamRecordsPage() {
  const access = await requireAccess(["admin", "coach", "player"]);
  const [{ records, failed }, headshots] = await Promise.all([loadTeamRecords(access), loadTeamHeadshots(access).catch(() => new Map<string, string>())]);
  return <><PageHeading section="Team" title="Team Records" description="Fall 2026 · The best recorded result on each testing leaderboard."/>
    <div className="mb-5"><LeaderboardNavigation group="records"/></div>
    {failed > 0 && <p role="status" className="notice mb-4 text-sm">{failed === 1 ? "One record is" : `${failed} records are`} temporarily unavailable. Refresh to try again.</p>}
    <TeamRecords records={records} headshots={Object.fromEntries(headshots)}/></>;
}
