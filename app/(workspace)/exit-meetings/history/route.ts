import { getAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { parseSaveExitMeetingCommand } from "@/lib/exit-meeting-history";
import { saveExitMeetingSnapshot } from "@/lib/exit-meeting-history-server";
import { ExitMeetingError } from "@/lib/exit-meeting-server";
import { EXIT_MEETING_PRIVATE_HEADERS, exitMeetingErrorResponse, readExitMeetingRequest } from "@/lib/exit-meeting-request";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function POST(request:Request){
 try{
  const {access}=await getAccess();if(!access)return exitMeetingErrorResponse("Sign in again to save this meeting.",401);if(!canImportPresentedAccess(access))return exitMeetingErrorResponse("Saved meetings are available to coaches and admins.",403);
  const body=await readExitMeetingRequest(request);let command;try{command=parseSaveExitMeetingCommand(body);}catch{return exitMeetingErrorResponse("Choose a player, valid meeting date, and confirm the snapshot. Keep notes under 1,600 characters.",400);}
  const saved=await saveExitMeetingSnapshot(access,command);
  return Response.json({id:saved.id,athleteId:saved.athleteId,meetingDate:saved.meetingDate,createdAt:saved.createdAt},{headers:EXIT_MEETING_PRIVATE_HEADERS});
 }catch(error){return error instanceof ExitMeetingError?exitMeetingErrorResponse(error.message,error.status):exitMeetingErrorResponse("The save could not be verified. Retry the same save after reconnecting.",503);}
}
