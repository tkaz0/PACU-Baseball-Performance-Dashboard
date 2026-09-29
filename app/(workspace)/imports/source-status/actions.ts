"use server";
import { redirect } from "next/navigation";
import { requireImportAccess } from "@/lib/auth";
import { checkOutcome, weeklySource } from "@/lib/weekly-source-contract";

export async function recordWeeklySourceCheck(form:FormData) {
  const access=await requireImportAccess();
  const source=form.get("source"),outcome=form.get("outcome");
  if(!weeklySource(source)||!checkOutcome(outcome))redirect("/imports/source-status?error=input");
  const {data,error}=await access.supabase.rpc("record_weekly_source_check",{p_source:source,p_outcome:outcome});
  if(error||!data||data.source!==source||data.outcome!==outcome||typeof data.checkedAt!=="string")redirect("/imports/source-status?error=save");
  redirect("/imports/source-status?recorded=1");
}
