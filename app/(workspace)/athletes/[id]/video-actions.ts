"use server";
import { revalidatePath } from "next/cache";
import { requireAccess, requireImportAccess } from "@/lib/auth";
import { canImportPresentedAccess, canReadPresentedAthlete } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";
import { SWING_VIDEO_BUCKET, SWING_VIDEO_TYPES, isSwingVideoType, validSwingVideoSize, validSwingVideoTitle } from "@/lib/swing-videos";

export async function prepareSwingVideo(input: {id:string;athleteId:string;fileHash:string;sourceRow:number;title:string;mime:string;bytes:number}) {
  const access=await requireImportAccess();
  if(!canImportPresentedAccess(access))return {ok:false as const,message:"Coach access is required."};
  if(!input||!UUID_PATTERN.test(input.id)||!UUID_PATTERN.test(input.athleteId)||!/^[a-f0-9]{64}$/.test(input.fileHash)||!Number.isSafeInteger(input.sourceRow)||input.sourceRow<2||input.sourceRow>1000000||!validSwingVideoTitle(input.title)||!isSwingVideoType(input.mime)||!validSwingVideoSize(input.bytes))return {ok:false as const,message:"Choose an MP4, MOV, or WebM clip under 50 MB and a short title."};
  const path=`${input.athleteId}/${input.id}.${SWING_VIDEO_TYPES[input.mime]}`;
  const {data,error}=await access.supabase.rpc("staff_reserve_swing_video",{p_id:input.id,p_athlete_id:input.athleteId,p_file_hash:input.fileHash,p_source_row:input.sourceRow,p_title:input.title,p_mime_type:input.mime,p_bytes:input.bytes});
  if(error||data?.id!==input.id||data?.path!==path||!["ready","pending"].includes(data?.status))return {ok:false as const,message:error?.code==="40001"?"This swing or upload changed. Refresh before trying again.":"The clip could not be prepared. Refresh and check the swing before retrying."};
  if(data.status==="ready")return {ok:true as const,ready:true as const};
  const {data:upload,error:uploadError}=await access.supabase.storage.from(SWING_VIDEO_BUCKET).createSignedUploadUrl(path,{upsert:false});
  if(uploadError||!upload?.signedUrl)return {ok:false as const,message:"The upload connection could not be opened. Retry this same clip."};
  return {ok:true as const,ready:false as const,url:upload.signedUrl};
}
export async function finishSwingVideo(athleteId:string,id:string,archive=false){
  const access=await requireImportAccess();
  if(!canImportPresentedAccess(access)||!UUID_PATTERN.test(athleteId)||!UUID_PATTERN.test(id)||typeof archive!=="boolean")return {ok:false as const,message:"Coach access and a valid swing are required."};
  const {data,error}=await access.supabase.rpc("staff_finish_swing_video",{p_id:id,p_athlete_id:athleteId,p_archive:archive});
  if(error||data?.id!==id||data?.status!==(archive?"archived":"ready"))return {ok:false as const,message:"The clip save is not confirmed. Retry this same upload or refresh to check it."};
  revalidatePath(`/athletes/${athleteId}`);
  return {ok:true as const};
}
export async function playSwingVideo(athleteId:string,id:string){
  const access=await requireAccess();
  if(!UUID_PATTERN.test(athleteId)||!UUID_PATTERN.test(id)||!canReadPresentedAthlete(access,athleteId))return {ok:false as const,message:"This video is unavailable."};
  const {data,error}=await access.supabase.rpc("athlete_swing_videos",{p_athlete_id:athleteId,p_video_id:id});
  if(error||!Array.isArray(data)||data.length!==1||data[0].id!==id||typeof data[0].objectPath!=="string"||!new RegExp(`^${athleteId}/${id}\\.(mp4|mov|webm)$`).test(data[0].objectPath))return {ok:false as const,message:"This video is unavailable. Refresh the swing and try again."};
  const {data:video,error:videoError}=await access.supabase.storage.from(SWING_VIDEO_BUCKET).createSignedUrl(data[0].objectPath,300);
  if(videoError||!video?.signedUrl)return {ok:false as const,message:"The video could not be opened. Try again."};
  return {ok:true as const,url:video.signedUrl};
}
