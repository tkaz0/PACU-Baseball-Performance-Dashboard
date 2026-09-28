"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireImportAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";

export async function saveNumericGoal(form:FormData){
  const access=await requireImportAccess();
  // Defense in depth: a presented Player never mutates with the actual Admin JWT.
  if(!canImportPresentedAccess(access))redirect("/overview?preview=read-only");
  const value=(key:string)=>form.get(key),athleteId=value("athleteId");
  if(typeof athleteId!=="string"||!UUID_PATTERN.test(athleteId))throw new Error("Choose an athlete profile.");
  const goalId=value("goalId"),revision=value("revision"),title=value("title"),target=value("target"),due=value("due"),note=value("note"),baselineId=value("baselineId"),baselineValue=value("baselineValue");
  const decimal=(v:unknown)=>typeof v==="string"&&v.trim()!==""&&Number.isFinite(Number(v));
  if(typeof goalId!=="string"||!UUID_PATTERN.test(goalId)||typeof revision!=="string"||!/^\d{1,9}$/.test(revision)||
    typeof title!=="string"||title.trim().length<1||title.trim().length>100||/[\u0000-\u001f\u007f]/.test(title)||
    !decimal(target)||Number(target)<0||Number(target)>1e9||typeof due!=="string"||(due!==""&&!/^2026-\d{2}-\d{2}$/.test(due))||
    typeof note!=="string"||note.trim().length>600||/[\u0000-\u001f\u007f]/.test(note)||
    (revision==="0"&&(typeof baselineId!=="string"||!baselineId||baselineId.length>2000||!decimal(baselineValue))))redirect(`/athletes/${athleteId}?goal=invalid`);
  const {data,error}=await access.supabase.rpc("staff_save_numeric_goal",{p_athlete_id:athleteId,p_goal_id:goalId,p_expected_revision:Number(revision),
    p_baseline_observation_id:revision==="0"?baselineId:null,p_baseline_value:revision==="0"?Number(baselineValue):null,
    p_title:title,p_target_value:Number(target),p_target_date:due||null,p_staff_note:note,p_shared:value("shared")==="on",p_completed:value("completed")==="on"});
  if(error)redirect(`/athletes/${athleteId}?goal=${error.code==="40001"?"stale":"save-error"}`);
  if(!data||data.id!==goalId||data.revision!==Number(revision)+1)redirect(`/athletes/${athleteId}?goal=unverified`);
  revalidatePath(`/athletes/${athleteId}`);
  redirect(`/athletes/${athleteId}?goal=saved`);
}
