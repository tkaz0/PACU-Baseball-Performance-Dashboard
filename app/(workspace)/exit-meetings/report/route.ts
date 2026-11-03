import { getAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { ExitMeetingError, loadExitMeetingReport } from "@/lib/exit-meeting-server";
import { loadAthleteHeadshot } from "@/lib/headshots-server";
import { loadBwsAwardMap } from "@/lib/game-weeks-server";
import { EXIT_MEETING_PRIVATE_HEADERS, exitMeetingErrorResponse } from "@/lib/exit-meeting-request";
import { UUID_PATTERN } from "@/lib/types";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const MAX_PER_REQUEST=4;
/**
 * Current handout projections for Print All (staff only), up to four players per request built one after another
 * so the request shares its team-wide reads. `awards=1` also returns the final BWS award winners once. Same readers
 * and rules as the Exit Meetings page; nothing is saved.
 */
export async function GET(request:Request){
 const {access}=await getAccess();if(!access)return exitMeetingErrorResponse("Sign in again to load handouts.",401);if(!canImportPresentedAccess(access))return exitMeetingErrorResponse("Exit meetings are available to coaches and admins.",403);
 const params=new URL(request.url).searchParams, ids=[...new Set(params.getAll("athlete"))];
 if(!ids.length||ids.length>MAX_PER_REQUEST||!ids.every(id=>UUID_PATTERN.test(id)))return exitMeetingErrorResponse("Choose one to four rostered players.",400);
 const items=[];
 for(const id of ids){
  try{const [report,headshot]=await Promise.all([loadExitMeetingReport(access,id),loadAthleteHeadshot(access,id).catch(()=>null)]);items.push({id,report,headshot});}
  catch(error){items.push({id,error:error instanceof ExitMeetingError?error.message:"This handout could not be loaded. Retry it."});}
 }
 const awards=params.get("awards")==="1"?await loadBwsAwardMap(access).catch(()=>null):undefined;
 return Response.json({items,...(awards===undefined?{}:{awards})},{headers:EXIT_MEETING_PRIVATE_HEADERS});
}
