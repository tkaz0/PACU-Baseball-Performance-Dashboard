import { requireRenderImportAccess as requireImportAccess } from "@/lib/render-access";
import { loadStaffAthleteChoices } from "@/lib/staff-athlete-search-server";
import { ExitMeetingPrintAll } from "@/components/exit-meeting-print-all";

export const metadata = { title: "Print All Handouts" };
/** November 2 owner request: every current player's exit meeting handout in one print job (Save as PDF). */
export default async function PrintAllHandoutsPage() {
  const access = await requireImportAccess();
  const players = await loadStaffAthleteChoices(access);
  return <ExitMeetingPrintAll players={players.map(p => ({ id: p.id, name: p.name }))}/>;
}
