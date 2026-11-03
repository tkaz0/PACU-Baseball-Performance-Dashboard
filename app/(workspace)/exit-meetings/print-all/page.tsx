import { requireRenderImportAccess as requireImportAccess } from "@/lib/render-access";
import { loadStaffAthleteChoices } from "@/lib/staff-athlete-search-server";
import { ExitMeetingPrintAll } from "@/components/exit-meeting-print-all";
import { TeamReviewSheet } from "@/components/team-review-sheet";
import { loadTeamReviewData } from "@/lib/team-review-server";

export const metadata = { title: "Print All Handouts" };
/** November 2 owner request: every current player's exit meeting handout in one print job (Save as PDF). */
export default async function PrintAllHandoutsPage() {
  const access = await requireImportAccess();
  // The whole-team sheet prints first (owner request); its readers run alongside the player list.
  const [players, team] = await Promise.all([loadStaffAthleteChoices(access), loadTeamReviewData(access)]);
  return <ExitMeetingPrintAll players={players.map(p => ({ id: p.id, name: p.name }))} teamSheet={<TeamReviewSheet data={team.data} bundle/>} teamUnavailable={team.unavailable}/>;
}
