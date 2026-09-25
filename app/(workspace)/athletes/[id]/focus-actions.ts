"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireImportAccess } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/types";

export async function saveCoachFocus(form:FormData){
  const access=await requireImportAccess();
  const athleteId=form.get("athleteId"),itemId=form.get("itemId"),title=form.get("title"),note=form.get("note"),targetDate=form.get("targetDate");
  if(typeof athleteId!=="string"||!UUID_PATTERN.test(athleteId))throw new Error("Choose an athlete profile.");
  if(typeof itemId!=="string"||(itemId!==""&&!UUID_PATTERN.test(itemId))||typeof title!=="string"||title.trim().length<1||title.trim().length>120||
    typeof note!=="string"||note.trim().length>600||typeof targetDate!=="string"||(targetDate!==""&&!/^20\d{2}-\d{2}-\d{2}$/.test(targetDate)))
    redirect(`/athletes/${athleteId}?focus=invalid`);
  const {error}=await access.supabase.rpc("staff_save_focus_item",{
    p_athlete_id:athleteId,p_item_id:itemId||null,p_title:title,p_staff_note:note,p_target_date:targetDate||null,
    p_shared:form.get("shared")==="on",p_completed:form.get("completed")==="on",
  });
  if(error)redirect(`/athletes/${athleteId}?focus=save-error`);
  revalidatePath(`/athletes/${athleteId}`);
  revalidatePath("/overview");
  redirect(`/athletes/${athleteId}?focus=saved`);
}
