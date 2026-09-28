import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";
import { ExitMeetingError, loadExitMeetingReport } from "@/lib/exit-meeting-server";
import { EXIT_MEETING_HISTORY_LIMIT, parseExitMeetingSnapshotMeta, parseExitMeetingSnapshotReport, parseSavedExitMeeting, type ExitMeetingHistory, type ExitMeetingSnapshotMeta, type SavedExitMeeting, type SaveExitMeetingCommand } from "@/lib/exit-meeting-history";

type Access=Awaited<ReturnType<typeof requireAccess>>;
function staff(access:Access){if(!canImportPresentedAccess(access))throw new ExitMeetingError("Saved meetings are available to coaches and admins.",403);}
function identity(id:string){if(!UUID_PATTERN.test(id))throw new ExitMeetingError("Choose a player or saved meeting.",400);}
export async function loadExitMeetingHistory(access:Access,athleteId:string):Promise<ExitMeetingHistory>{
 staff(access);identity(athleteId);
 const {data,error}=await access.supabase.rpc("staff_exit_meeting_history",{p_athlete_id:athleteId});
 if(error)throw new ExitMeetingError("Saved meetings could not be loaded. Please try again.",503);
 if(!data||typeof data!=="object"||Array.isArray(data)||!Array.isArray(data.items)||data.items.length>EXIT_MEETING_HISTORY_LIMIT||typeof data.hasMore!=="boolean"||Object.keys(data).some(key=>!["items","hasMore"].includes(key)))throw new ExitMeetingError("Saved meeting history could not be verified.",503);
 const items:ExitMeetingSnapshotMeta[]=data.items.map((item:unknown)=>parseExitMeetingSnapshotMeta(item,athleteId));
 if(new Set(items.map(item=>item.id)).size!==items.length)throw new ExitMeetingError("Saved meeting history could not be verified.",503);
 return {items,hasMore:data.hasMore};
}
export async function loadSavedExitMeeting(access:Access,athleteId:string,snapshotId:string):Promise<SavedExitMeeting>{
 staff(access);identity(athleteId);identity(snapshotId);
 const {data,error}=await access.supabase.rpc("staff_exit_meeting_snapshot",{p_athlete_id:athleteId,p_snapshot_id:snapshotId});
 if(error)throw new ExitMeetingError("The saved meeting could not be loaded. Please try again.",503);
 if(!data)throw new ExitMeetingError("This saved meeting was not found for the selected player.",404);
 const snapshot=parseSavedExitMeeting(data,athleteId);if(snapshot.id!==snapshotId)throw new ExitMeetingError("The saved meeting could not be verified.",503);return snapshot;
}
/** First inspect an uncertain request; a successful replay returns the original immutable snapshot. */
export async function saveExitMeetingSnapshot(access:Access,command:SaveExitMeetingCommand):Promise<SavedExitMeeting>{
 staff(access);identity(command.athleteId);identity(command.requestId);
 const prior=await access.supabase.rpc("staff_exit_meeting_attempt",{p_request_id:command.requestId});
 if(prior.error)throw new ExitMeetingError("The previous save could not be checked. Retry the same save after reconnecting.",503);
 if(prior.data){const saved=parseSavedExitMeeting(prior.data,command.athleteId);if(saved.meetingDate!==command.meetingDate||saved.talkingPoints!==command.talkingPoints)throw new ExitMeetingError("This save request already belongs to different meeting options.",409);return saved;}
 const report=parseExitMeetingSnapshotReport(await loadExitMeetingReport(access,command.athleteId,"meeting"));
 const result=await access.supabase.rpc("staff_save_exit_meeting_snapshot",{p_request_id:command.requestId,p_athlete_id:command.athleteId,p_meeting_date:command.meetingDate,p_talking_points:command.talkingPoints,p_report:report});
 if(result.error){if(result.error.code==="22023")throw new ExitMeetingError("This save request already belongs to different meeting options.",409);throw new ExitMeetingError("The save could not be confirmed. Retry this same save; do not start another snapshot.",503);}
 const saved=parseSavedExitMeeting(result.data,command.athleteId);
 if(saved.meetingDate!==command.meetingDate||saved.talkingPoints!==command.talkingPoints)throw new ExitMeetingError("The saved meeting receipt could not be verified. Retry this same save.",503);
 return saved;
}
