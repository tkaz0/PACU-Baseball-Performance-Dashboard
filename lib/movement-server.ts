import "server-only";
import { requireAccess } from "@/lib/auth";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";
import { MOVEMENT_SOURCE, parseMovementPayload, type MovementReport } from "@/lib/movement-screening";
export async function loadMovementScreening(access: Awaited<ReturnType<typeof requireAccess>>, athleteId: string, athleteCode: string): Promise<MovementReport|null> {
 if(!UUID_PATTERN.test(athleteId)||!canReadPresentedAthlete(access,athleteId))throw new Error("Screening access denied.");
 const {data,error}=await access.supabase.from("movement_screenings").select("source_sheet_id,screened_on,source_hash,readings").eq("athlete_id",athleteId).order("screened_on",{ascending:false}).order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(error)throw new Error("Movement screening could not be loaded.");
 if(!data)return null;
 return parseMovementPayload({version:1,source:MOVEMENT_SOURCE,reports:[{athleteCode,sheetId:data.source_sheet_id,screenedOn:data.screened_on,sourceHash:data.source_hash,readings:data.readings}]}).reports[0];
}
