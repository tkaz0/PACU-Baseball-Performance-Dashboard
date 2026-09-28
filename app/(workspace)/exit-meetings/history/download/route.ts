import { getAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";
import { loadSavedExitMeeting } from "@/lib/exit-meeting-history-server";
import { ExitMeetingError } from "@/lib/exit-meeting-server";
import { createExitMeetingPdf } from "@/lib/exit-meeting-pdf";
import { EXIT_MEETING_PRIVATE_HEADERS, exitMeetingErrorResponse, readExitMeetingRequest } from "@/lib/exit-meeting-request";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function POST(request:Request){
 try{
  const {access}=await getAccess();if(!access)return exitMeetingErrorResponse("Sign in again to download this meeting.",401);if(!canImportPresentedAccess(access))return exitMeetingErrorResponse("Saved meetings are available to coaches and admins.",403);
  const body=await readExitMeetingRequest(request);
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).sort().join(",")!=="athleteId,snapshotId")return exitMeetingErrorResponse("Choose a saved meeting.",400);
  const {athleteId,snapshotId}=body as Record<string,unknown>;if(typeof athleteId!=="string"||typeof snapshotId!=="string"||!UUID_PATTERN.test(athleteId)||!UUID_PATTERN.test(snapshotId))return exitMeetingErrorResponse("Choose a saved meeting.",400);
  const saved=await loadSavedExitMeeting(access,athleteId,snapshotId);
  const bytes=await createExitMeetingPdf(saved.report,{meetingDate:saved.meetingDate,talkingPoints:saved.talkingPoints,format:"meeting"});
  return new Response(new Uint8Array(bytes).buffer,{headers:{...EXIT_MEETING_PRIVATE_HEADERS,"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="PACU-Saved-Meeting-${saved.report.code}-${saved.meetingDate}.pdf"`}});
 }catch(error){return error instanceof ExitMeetingError?exitMeetingErrorResponse(error.message,error.status):exitMeetingErrorResponse("This saved meeting could not be verified. Please try again.",503);}
}
