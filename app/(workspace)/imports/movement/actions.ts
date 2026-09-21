"use server";
import { requireImportAccess } from "@/lib/auth";
import { parseMovementPayload } from "@/lib/movement-screening";
import { revalidatePath } from "next/cache";
import { UUID_PATTERN } from "@/lib/types";
export async function saveMovementScreenings(input:unknown, confirmed:boolean) {
 const {supabase}=await requireImportAccess();
 if(confirmed!==true)return {error:"Review every player and reading before saving."};
 try {
  const payload=parseMovementPayload(input);
  const {data,error}=await supabase.rpc("staff_import_movement_screenings",{p_payload:payload});
  if(error)return {error:"Screenings could not be saved. A changed source or player match needs review. Your existing results are preserved."};
  if(!data||!Number.isInteger(data.created)||!Number.isInteger(data.unchanged)||data.created<0||data.unchanged<0||data.created+data.unchanged!==payload.reports.length||!Array.isArray(data.ids)||data.ids.length!==payload.reports.length||data.ids.some((v:unknown)=>typeof v!=="string"||!UUID_PATTERN.test(v)))throw new Error();
  const {data:stored,error:readError}=await supabase.from("movement_screenings").select("id,source_sheet_id,screened_on,source_hash,readings,athlete_id,athletes(athlete_code)").in("id",data.ids);
  if(readError||stored?.length!==payload.reports.length)throw new Error();
  for(const report of payload.reports){
   const row=stored.find(r=>r.source_sheet_id===report.sheetId&&r.screened_on===report.screenedOn);
   const athlete=row?.athletes as unknown as {athlete_code:string}|null;
   // JSONB key order is immaterial; compare every field explicitly.
   if(!row||athlete?.athlete_code!==report.athleteCode||row.source_hash!==report.sourceHash||!Array.isArray(row.readings)||row.readings.length!==24||row.readings.some((r:Record<string,unknown>,i:number)=>Object.entries(report.readings[i]).some(([key,value])=>r[key]!==value)))throw new Error();
   revalidatePath(`/athletes/${row.athlete_id}`);
  }
  revalidatePath("/imports/movement");
  return {created:data.created as number,unchanged:data.unchanged as number,verified:stored.length};
 }catch{return {error:"The save could not be verified. Keep this reviewed file and check profiles before retrying the identical file."};}
}
