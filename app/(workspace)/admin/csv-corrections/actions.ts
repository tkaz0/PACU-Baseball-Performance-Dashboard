"use server";
import { requireAdminMutation } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { validCsvRemovalRequest, type CsvRemovalRequest } from "@/lib/csv-removal";
import { validCsvMaxReadingRequest, type CsvMaxReadingRequest } from "@/lib/csv-max-reading";
export async function setCsvRemoval(input:CsvRemovalRequest,reviewed:boolean) {
 const access=await requireAdminMutation();
 if(reviewed!==true || !validCsvRemovalRequest(input)) return {error:"Review the exact player and CSV before continuing."};
 const {data,error}=await access.supabase.rpc("admin_set_csv_measurement_archive",{p_request_id:input.requestId,p_athlete:input.athleteId,p_file_hash:input.fileHash,p_fingerprint:input.fingerprint,p_restore:input.restore,p_reviewed:true});
 if(error || data?.requestId!==input.requestId || !Number.isSafeInteger(data?.count) || data.count<1 || data.count>500 || data.restored!==input.restore) return {error:"The change could not be confirmed. Keep this review open and retry the same request, or refresh to check saved removals. Changed readings require a fresh review."};
 for(const path of [`/athletes/${input.athleteId}`,"/leaderboards","/analytics","/compare","/team-progress","/testing","/admin/csv-corrections"]) revalidatePath(path);
 return {receipt:{requestId:data.requestId as string,count:data.count as number,restored:data.restored as boolean}};
}

export async function archiveCsvMaxReading(input:CsvMaxReadingRequest,reviewed:boolean) {
 const access=await requireAdminMutation();
 if(reviewed!==true || !validCsvMaxReadingRequest(input)) return {error:"Review the exact player and reading before continuing."};
 const {data,error}=await access.supabase.rpc("admin_archive_csv_max_reading",{p_request_id:input.requestId,p_athlete:input.athleteId,p_observation:input.observationId,p_fingerprint:input.fingerprint,p_reviewed:true});
 if(error || data?.requestId!==input.requestId || data?.count!==1 || data?.removed!==true)
  return {error:"The removal could not be confirmed. Refresh the readings and check saved removals before retrying this request."};
 for(const path of [`/athletes/${input.athleteId}`,"/leaderboards","/analytics","/compare","/team-progress","/testing","/admin/csv-corrections"]) revalidatePath(path);
 return {receipt:{requestId:data.requestId as string,count:1}};
}
