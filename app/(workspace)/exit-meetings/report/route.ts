import { getAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { ExitMeetingError, loadExitMeetingReport } from "@/lib/exit-meeting-server";
import { loadAthleteHeadshot } from "@/lib/headshots-server";
import { loadBwsAwards, loadGameWeeks } from "@/lib/game-weeks-server";
import { EXIT_MEETING_PRIVATE_HEADERS, exitMeetingErrorResponse } from "@/lib/exit-meeting-request";
import { UUID_PATTERN } from "@/lib/types";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
/** One player's current handout projection for Print All (staff only); same readers and rules as the Exit Meetings page. */
export async function GET(request:Request){
 try{
  const {access}=await getAccess();if(!access)return exitMeetingErrorResponse("Sign in again to load handouts.",401);if(!canImportPresentedAccess(access))return exitMeetingErrorResponse("Exit meetings are available to coaches and admins.",403);
  const athlete=new URL(request.url).searchParams.get("athlete")??"";if(!UUID_PATTERN.test(athlete))return exitMeetingErrorResponse("Choose a rostered player.",400);
  void loadGameWeeks(access).catch(()=>null);
  const [report,headshot]=await Promise.all([loadExitMeetingReport(access,athlete),loadAthleteHeadshot(access,athlete).catch(()=>null)]);
  const awards=await loadBwsAwards(access,report.code).catch(()=>[]);
  return Response.json({report,headshot,awards},{headers:EXIT_MEETING_PRIVATE_HEADERS});
 }catch(error){return error instanceof ExitMeetingError?exitMeetingErrorResponse(error.message,error.status):exitMeetingErrorResponse("This handout could not be loaded. Retry it.",503);}
}
