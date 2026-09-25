import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess, canReadPresentedAthlete } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";

export type CoachFocusItem={id:string;athleteId:string;title:string;staffNote:string|null;targetDate:string|null;shared:boolean;completedAt:string|null;createdAt:string};
export type DueCoachFocus={id:string;athleteId:string;playerName:string;title:string;targetDate:string};
type Access=Awaited<ReturnType<typeof requireAccess>>;
export async function loadCoachFocusItems(access:Access,athleteId:string):Promise<CoachFocusItem[]>{
  if(!UUID_PATTERN.test(athleteId)||!canReadPresentedAthlete(access,athleteId))throw new Error("Athlete focus access denied.");
  const {data,error}=await access.supabase.rpc("athlete_focus_items",{p_athlete_id:athleteId});
  if(error)throw new Error("Coach focus items could not be loaded.");
  if(!Array.isArray(data)||data.length>100)throw new Error("Coach focus item format is invalid.");
  const staff=canImportPresentedAccess(access);
  return data.map((item:unknown)=>{
    if(!item||typeof item!=="object"||Array.isArray(item))throw new Error("Coach focus item format is invalid.");
    const row=item as Record<string,unknown>;
    if(!UUID_PATTERN.test(String(row.id))||row.athleteId!==athleteId||typeof row.title!=="string"||row.title.length<1||row.title.length>120||
      typeof row.shared!=="boolean"||typeof row.createdAt!=="string"||!Number.isFinite(Date.parse(row.createdAt))||
      (row.targetDate!==null&&(typeof row.targetDate!=="string"||!/^20\d{2}-\d{2}-\d{2}$/.test(row.targetDate)))||
      (row.completedAt!==null&&(typeof row.completedAt!=="string"||!Number.isFinite(Date.parse(row.completedAt))))||
      (row.staffNote!==null&&(typeof row.staffNote!=="string"||row.staffNote.length>600)))throw new Error("Coach focus item format is invalid.");
    return {id:row.id as string,athleteId,title:row.title,staffNote:staff?row.staffNote as string|null:null,targetDate:row.targetDate as string|null,shared:row.shared,completedAt:row.completedAt as string|null,createdAt:row.createdAt as string};
  }).filter(item=>staff||(item.shared&&!item.completedAt));
}

export async function loadDueCoachFocus(access:Access,today:string):Promise<DueCoachFocus[]>{
  if(!canImportPresentedAccess(access))return [];
  const through=new Date(Date.parse(`${today}T12:00:00Z`)+7*86400000).toISOString().slice(0,10);
  const {data,error}=await access.supabase.rpc("staff_due_focus_items",{p_through:through});
  if(error||!Array.isArray(data)||data.length>100)throw new Error("Coach retest dates could not be loaded.");
  return data.map((row:unknown)=>{
    if(!row||typeof row!=="object"||Array.isArray(row))throw new Error("Coach retest date format is invalid.");
    const item=row as Record<string,unknown>;
    if(!UUID_PATTERN.test(String(item.id))||!UUID_PATTERN.test(String(item.athleteId))||typeof item.playerName!=="string"||item.playerName.length>180||
      typeof item.title!=="string"||item.title.length<1||item.title.length>120||typeof item.targetDate!=="string"||!/^20\d{2}-\d{2}-\d{2}$/.test(item.targetDate)||item.targetDate>through)
      throw new Error("Coach retest date format is invalid.");
    return item as DueCoachFocus;
  });
}
