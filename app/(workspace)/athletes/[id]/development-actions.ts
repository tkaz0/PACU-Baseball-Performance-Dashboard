"use server";
import { revalidatePath } from "next/cache";
import { requireAccess,requireImportAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { canCompleteDevelopmentPlan } from "@/lib/development-plans-server";
import { validateDevelopmentPlanInput,type DevelopmentActionState } from "@/lib/development-plans";
import { UUID_PATTERN } from "@/lib/types";

const result=(status:DevelopmentActionState["status"],message:string):DevelopmentActionState=>({status,message});
function request(form:FormData){const values=["athleteId","planId","requestId"].map(key=>form.get(key)),revision=form.get("revision");if(values.some(value=>typeof value!=="string"||!UUID_PATTERN.test(value))||typeof revision!=="string"||!/^\d{1,9}$/.test(revision))return null;return {athleteId:values[0] as string,planId:values[1] as string,requestId:values[2] as string,revision:Number(revision)};}
function saved(athleteId:string,planId:string,revision:number,data:unknown,error:unknown):DevelopmentActionState{
  if(error){const code=typeof error==="object"&&"code" in error?error.code:null;return code==="40001"?result("stale","This plan changed. Refresh to review the latest version."):result("error","We could not confirm the save. Refresh and check the plan before trying again.");}
  if(!data||typeof data!=="object"||!("id" in data)||!("revision" in data)||data.id!==planId||data.revision!==revision+1)return result("unverified","We could not verify the save. Refresh and check the plan before trying again.");
  revalidatePath(`/athletes/${athleteId}`);revalidatePath("/overview");return result("saved","Weekly plan saved.");
}
export async function saveDevelopmentPlan(_previous:DevelopmentActionState,form:FormData):Promise<DevelopmentActionState>{
  const access=await requireImportAccess();
  if(!canImportPresentedAccess(access))return result("error","Weekly plans can only be edited in Coach or Admin view.");
  const identity=request(form);if(!identity)return result("invalid","Refresh the profile, then check your plan.");
  const get=(key:string)=>{const value=form.get(key);return typeof value==="string"?value.trim():"";};
  const rawDrills=form.get("drills");let drills:unknown;try{if(typeof rawDrills!=="string"||rawDrills.length>6000)throw new Error();drills=JSON.parse(rawDrills);}catch{return result("invalid","Add one to four drills with a name for each.");}
  const input={weekStart:get("weekStart"),focus:get("focus"),staffNote:get("staffNote")||null,drills,shared:form.get("shared")==="on",archived:form.get("archived")==="on"};
  if(!validateDevelopmentPlanInput(input))return result("invalid","Choose a Monday and add a focus plus one to four drills. Check the text lengths.");
  // Whitelist drill fields; completion belongs exclusively to the player's RPC.
  const {data,error}=await access.supabase.rpc("staff_save_development_plan",{p_athlete_id:identity.athleteId,p_plan_id:identity.planId,p_request_id:identity.requestId,p_expected_revision:identity.revision,p_week_start:input.weekStart,p_focus:input.focus,p_drills:input.drills.map(({id,title,cue})=>({id,title,cue})),p_staff_note:input.staffNote,p_shared:input.shared,p_archived:input.archived});
  return saved(identity.athleteId,identity.planId,identity.revision,data,error);
}
export async function completeDevelopmentDrill(_previous:DevelopmentActionState,form:FormData):Promise<DevelopmentActionState>{
  const access=await requireAccess(),identity=request(form);
  if(!identity)return result("invalid","Refresh the profile, then try again.");
  if(!canCompleteDevelopmentPlan(access,identity.athleteId))return result("error","Only the player can check off their own drills. Player View is read-only.");
  const drillId=form.get("drillId"),completed=form.get("completed");
  if(identity.revision<1||typeof drillId!=="string"||!UUID_PATTERN.test(drillId)||(completed!=="true"&&completed!=="false"))return result("invalid","Refresh the profile, then choose the drill again.");
  const {data,error}=await access.supabase.rpc("complete_my_development_drill",{p_athlete_id:identity.athleteId,p_plan_id:identity.planId,p_request_id:identity.requestId,p_expected_revision:identity.revision,p_drill_id:drillId,p_completed:completed==="true"});
  const state=saved(identity.athleteId,identity.planId,identity.revision,data,error);return state.status==="saved"?result("saved",completed==="true"?"Drill marked complete.":"Drill reopened."):state;
}
