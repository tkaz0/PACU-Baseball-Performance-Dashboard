import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess,canReadPresentedAthlete } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";
import { parseDevelopmentPlans,type DevelopmentPlan } from "@/lib/development-plans";
type Access=Awaited<ReturnType<typeof requireAccess>>;
export function canCompleteDevelopmentPlan(access:Pick<Access,"roles"|"preview"|"athleteId">,athleteId:string){return access.preview===null&&access.roles.includes("player")&&access.athleteId?.toLowerCase()===athleteId.toLowerCase();}
export async function loadDevelopmentPlans(access:Access,athleteId:string):Promise<DevelopmentPlan[]>{
  if(!UUID_PATTERN.test(athleteId)||!canReadPresentedAthlete(access,athleteId))throw new Error("Weekly plan access denied.");
  const {data,error}=await access.supabase.rpc("athlete_development_plans",{p_athlete_id:athleteId});
  if(error)throw new Error("Weekly plans could not be loaded.");
  return parseDevelopmentPlans(data,athleteId,canImportPresentedAccess(access));
}
