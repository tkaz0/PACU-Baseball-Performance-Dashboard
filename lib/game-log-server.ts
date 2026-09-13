import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { validateGameLog, type GameLog } from "@/lib/game-log";
import { UUID_PATTERN } from "@/lib/types";
export async function loadGameLogs(access:Awaited<ReturnType<typeof requireAccess>>,athleteId?:string):Promise<GameLog[]> {
 const staff=access.roles.some(r=>r==="admin"||r==="coach"),requested=athleteId??(!staff?access.athleteId:null);
 if((!staff&&!requested)||(requested&&(!UUID_PATTERN.test(requested)||!canReadPresentedAthlete(access,requested))))throw Error("Game log access denied.");
 const {data,error}=await access.supabase.rpc("read_game_logs",{p_athlete_id:requested??null});
 if(error||!Array.isArray(data)||data.length>20000)throw Error("Game logs could not be loaded.");
 const ids=new Set<string>();return data.map(row=>{
  if(!row||typeof row!=="object"||Array.isArray(row)||Object.keys(row).sort().join()!=="athleteId,batting,gameNumber,id,kind,opponent,pitching,playedOn,updatedAt,version"||!Number.isSafeInteger(row.version)||row.version<1||typeof row.updatedAt!=="string"||!Number.isFinite(Date.parse(row.updatedAt))||!canReadPresentedAthlete(access,row.athleteId)||(requested&&row.athleteId!==requested)||ids.has(row.id))throw Error("Game log access or format could not be verified.");
  const {version,updatedAt,...input}=row;validateGameLog({...input,requestId:row.id,expectedVersion:version});ids.add(row.id);return {...input,version,updatedAt} as GameLog;
 });
}
