import { requireAdminWorkspaceAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { BwsTeam } from "@/components/bws-team";
import { loadBwsPlayerStats, loadBwsTeamPlan } from "@/lib/bws-team-server";
import { loadStaffAthleteChoices } from "@/lib/staff-athlete-search-server";
import { pacificTestingDate } from "@/lib/testing-checklist";

export const metadata = { title: "BWS Team" };
export default async function BwsTeamPage() {
  const access = await requireAdminWorkspaceAccess();
  const [plan, athletes, stats] = await Promise.all([loadBwsTeamPlan(access), loadStaffAthleteChoices(access), loadBwsPlayerStats().catch(() => null)]);
  return <><PageHeading section="Administration" title="BWS Team" description="Your private Boxer World Series team: roster, depth chart, lineups and pitching plan."/>
    <BwsTeam initial={plan} athletes={athletes.map(a => ({ id: a.id, name: a.name }))} stats={stats} today={pacificTestingDate()}/></>;
}
