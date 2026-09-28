"use server";
import { revalidatePath } from "next/cache";
import { requireAdminMutation } from "@/lib/auth";
import { validReclassifyPitchRequest, validRestorePitchRequest, type ReclassifyPitchRequest, type RestorePitchRequest } from "@/lib/legacy-pitch-reclassification";
function refresh(athlete: string) {
  for (const path of [`/athletes/${athlete}`,"/leaderboards","/analytics","/compare","/team-progress","/testing","/overview","/exit-meetings","/imports/sessions","/admin/csv-corrections"])
    revalidatePath(path);
}
export async function reclassifyLegacyPitch(input: ReclassifyPitchRequest, reviewed: boolean) {
  const { supabase } = await requireAdminMutation();
  if (reviewed !== true || !validReclassifyPitchRequest(input)) return { error: "Review the player, original CSV, and pitch group first." };
  const { data, error } = await supabase.rpc("admin_reclassify_legacy_fastball", {p_request_id:input.requestId,p_athlete:input.athleteId,p_file_hash:input.fileHash,p_fingerprint:input.fingerprint,p_source_rows:input.sourceRows,p_reviewed:true});
  if (error || !data || data.requestId !== input.requestId || data.fileHash !== input.fileHash || data.measurementCount !== 7 || data.pitchCount !== input.sourceRows.length || data.restored !== false || !/^[a-f0-9]{64}$/.test(data.afterFingerprint ?? ""))
    return { error: "The correction could not be confirmed. Refresh and check Pitch Label History before retrying the same request." };
  refresh(input.athleteId);
  return { receipt: { requestId: data.requestId as string, pitchCount: data.pitchCount as number } };
}
export async function restoreLegacyPitch(input: RestorePitchRequest, reviewed: boolean) {
  const { supabase } = await requireAdminMutation();
  if (reviewed !== true || !validRestorePitchRequest(input)) return { error: "Review the saved correction before restoring its prior labels." };
  const { data, error } = await supabase.rpc("admin_restore_legacy_pitch_reclassification", {p_request_id:input.requestId,p_correction_request_id:input.correctionRequestId,p_fingerprint:input.fingerprint,p_reviewed:true});
  if (error || !data || data.requestId !== input.requestId || data.restored !== true || data.measurementCount !== 7)
    return { error: "The restore could not be confirmed. Refresh Pitch Label History before retrying the same request." };
  refresh(input.athleteId);
  return { receipt: { requestId: data.requestId as string } };
}
