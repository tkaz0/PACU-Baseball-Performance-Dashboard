import { requireRenderImportAccess as requireImportAccess } from "@/lib/render-access";
import { loadStaffAthleteChoices } from "@/lib/staff-athlete-search-server";
import { ExitMeetingError, loadExitMeetingReport } from "@/lib/exit-meeting-server";
import { ExitMeetingWorkspace } from "@/components/exit-meeting-workspace";
import { exitMeetingFormat, type ExitMeetingFormat } from "@/lib/exit-meeting";
import { loadExitMeetingHistory, loadSavedExitMeeting } from "@/lib/exit-meeting-history-server";
import type { SavedExitMeeting, ExitMeetingHistory } from "@/lib/exit-meeting-history";
import { notFound } from "next/navigation";

export const metadata = { title: "Exit Meetings" };
export default async function ExitMeetingsPage({ searchParams }: { searchParams: Promise<{ athlete?: string; format?: string; meeting?: string }> }) {
  const access = await requireImportAccess();
  const [query, players] = await Promise.all([searchParams, loadStaffAthleteChoices(access)]);
  let format: ExitMeetingFormat; try { format = exitMeetingFormat(query.format); } catch { notFound(); }
  let report = null;
  let saved: SavedExitMeeting | null = null;
  let history: ExitMeetingHistory = {items:[],hasMore:false};
  if(query.meeting&&!query.athlete)notFound();
  if (query.athlete) {
    try {
      const [result,previous] = await Promise.all([query.meeting ? loadSavedExitMeeting(access,query.athlete,query.meeting) : loadExitMeetingReport(access,query.athlete,format),loadExitMeetingHistory(access,query.athlete)]);
      history=previous;
      if(query.meeting){saved=result as SavedExitMeeting;report=saved.report;format="meeting";}else{report=result as Awaited<ReturnType<typeof loadExitMeetingReport>>;}
    }
    catch (error) { if (error instanceof ExitMeetingError && [400, 404].includes(error.status)) notFound(); throw error; }
  }
  return <ExitMeetingWorkspace key={`${query.athlete ?? "none"}:${query.meeting ?? "current"}`} players={players} selectedId={query.athlete ?? ""} report={report} format={format} saved={saved} history={history} />;
}
