import "server-only";
import type { requireAccess } from "@/lib/auth";
import { parseHittingTeamAverages } from "@/lib/hitting-team-averages";
export async function loadHittingTeamAverages(access:Awaited<ReturnType<typeof requireAccess>>) {
  if(!access.roles.some(r=>r==="admin"||r==="coach"||r==="player"))throw new Error("Team averages require player or staff access.");
  const {data,error}=await access.supabase.rpc("hitting_team_averages");
  if(error)throw new Error("Team hitting averages could not be loaded.");
  return parseHittingTeamAverages(data);
}
