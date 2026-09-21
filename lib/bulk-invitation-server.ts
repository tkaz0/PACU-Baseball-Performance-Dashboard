import "server-only";
import {requireAdminWorkspaceAccess} from "@/lib/auth";
import {createAuthAdministrator,invitationsEnabled} from "@/lib/supabase/auth-admin";
import {classifyBulkPlayers} from "@/lib/bulk-invitations";
import {athleteName} from "@/lib/types";
export async function prepareBulkInvitations(){
 const access=await requireAdminWorkspaceAccess();
 if(!invitationsEnabled())throw new Error("Email invitations are not enabled.");
 const [roster,links,attempts]=await Promise.all([
  access.supabase.from("athletes").select("id,athlete_code,first_name,preferred_name,last_name,pacific_email,athlete_seasons!inner(season,roster_status)",{count:"exact"}).eq("athlete_seasons.season","2026-27").order("last_name").order("id").limit(1000),
  access.supabase.from("account_athletes").select("athlete_id",{count:"exact"}).limit(1000),
  access.supabase.rpc("admin_player_invite_attempts"),
 ]);
 if(roster.error||links.error||attempts.error||roster.count===null||roster.count>1000||links.count===null||links.count>1000||!Array.isArray(attempts.data))throw new Error("The current roster and invitation history could not be verified.");
 const administrator=createAuthAdministrator(),existing=new Set<string>();let complete=false;
 for(let page=1;page<=20;page++){
  const {data,error}=await administrator.listUsers({page,perPage:100});
  if(error||!data)throw new Error("The sign-in directory could not be verified. No emails were sent.");
  for(const u of data.users)if(u.email)existing.add(u.email.toLowerCase());
  if(!data.nextPage){complete=true;break;}
  if(data.nextPage!==page+1)throw new Error("The sign-in directory could not be verified.");
 }
 if(!complete)throw new Error("The sign-in directory could not be fully checked.");
 return classifyBulkPlayers((roster.data??[]).map(r=>({id:r.id,code:r.athlete_code,name:athleteName(r),email:r.pacific_email,eligible:r.athlete_seasons.some(s=>s.season==="2026-27"&&(s.roster_status===null||["active","redshirt"].includes(s.roster_status)))})),new Set((links.data??[]).map(r=>r.athlete_id)),existing,new Set(attempts.data.map((r:{athlete_id:string})=>r.athlete_id)),access.user.email);
}
