import { requireRenderImportAccess as requireImportAccess } from "@/lib/render-access";
import { loadStaffAthleteChoices } from "@/lib/staff-athlete-search-server";
import { ExitMeetingError, loadExitMeetingReport } from "@/lib/exit-meeting-server";
import { ExitMeetingWorkspace } from "@/components/exit-meeting-workspace";
import { loadExitMeetingHistory, loadSavedExitMeeting } from "@/lib/exit-meeting-history-server";
import { loadAthleteHeadshot } from "@/lib/headshots-server";
import { loadBwsAwards, loadGameWeeks, type BwsAward } from "@/lib/game-weeks-server";
import type { SavedExitMeeting, ExitMeetingHistory } from "@/lib/exit-meeting-history";
import { notFound } from "next/navigation";

export const metadata = { title: "Exit Meetings" };
/** One format: the front-and-back meeting handout (the detailed report was retired October 14). */
export default async function ExitMeetingsPage({ searchParams }: { searchParams: Promise<{ athlete?: string; meeting?: string }> }) {
  const access = await requireImportAccess();
  const [query, players] = await Promise.all([searchParams, loadStaffAthleteChoices(access)]);
  let report = null;
  let saved: SavedExitMeeting | null = null;
  let history: ExitMeetingHistory = {items:[],hasMore:false};
  let headshot: string | null = null;
  let awards: BwsAward[] = [];
  if(query.meeting&&!query.athlete)notFound();
  if (query.athlete) {
    // Start the (request-cached) team weekly read now so the award lookup below does not add a round trip.
    void loadGameWeeks(access).catch(() => null);
    try {
      const [result,previous,photo] = await Promise.all([query.meeting ? loadSavedExitMeeting(access,query.athlete,query.meeting) : loadExitMeetingReport(access,query.athlete),loadExitMeetingHistory(access,query.athlete),loadAthleteHeadshot(access,query.athlete).catch(()=>null)]);
      history=previous; headshot=photo;
      if(query.meeting){saved=result as SavedExitMeeting;report=saved.report;}else{report=result as Awaited<ReturnType<typeof loadExitMeetingReport>>;}
      // Final BWS awards are loaded live like the photo; saved snapshot contents are unchanged.
      awards = await loadBwsAwards(access, report.code).catch(() => []);
    }
    catch (error) { if (error instanceof ExitMeetingError && [400, 404].includes(error.status)) notFound(); throw error; }
  }
  return <ExitMeetingWorkspace key={`${query.athlete ?? "none"}:${query.meeting ?? "current"}`} players={players} selectedId={query.athlete ?? ""} report={report} saved={saved} history={history} headshot={headshot} awards={awards} />;
}
