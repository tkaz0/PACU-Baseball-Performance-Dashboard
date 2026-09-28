import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess, canReadPresentedAthlete } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";
import { GOAL_METRIC_KEYS, type PlayerGoalChoice, type PlayerGoalData, type PlayerNumericGoal } from "@/lib/player-goals";
import { PLAYER_METRICS, validatePlayerMetricValue } from "@/lib/player-performance";

type Access=Awaited<ReturnType<typeof requireAccess>>;
const date=(value:unknown):value is string=>typeof value==="string"&&/^2026-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value&&value>="2026-09-01"&&value<="2026-12-31";
const timestamp=(value:unknown)=>typeof value==="string"&&Number.isFinite(Date.parse(value));
const finite=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=1e9;
// PostgreSQL length(text) counts code points; btrim(text) removes ASCII spaces.
// Read every valid SQL-saved goal, including supplementary Unicode characters.
const text=(value:unknown,max:number):value is string=>typeof value==="string"&&value.length>=1&&Array.from(value).length<=max&&value.replace(/^ +| +$/g,"")===value&&!/[\u0000-\u001f\u007f]/.test(value);
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const metric=(value:Record<string,unknown>)=>(GOAL_METRIC_KEYS as readonly unknown[]).includes(value.metricKey)&&text(value.metricLabel,100)&&text(value.source,100)&&text(value.unit,20)
  &&(PLAYER_METRICS.find(definition=>definition.key===value.metricKey)?.units.includes(value.unit)||(/^classified_(?:avg|max)_velocity$/.test(String(value.metricKey))&&value.unit==="mph")||(/^classified_(?:avg|max)_spin$/.test(String(value.metricKey))&&value.unit==="rpm"));
function validValue(key:unknown,value:unknown,unit:unknown){
  if(!finite(value)||typeof unit!=="string")return false;
  const definition=PLAYER_METRICS.find(item=>item.key===key);
  return definition?validatePlayerMetricValue(definition.key,value,unit):true;
}
export async function loadPlayerGoals(access:Access,athleteId:string):Promise<PlayerGoalData>{
  if(!UUID_PATTERN.test(athleteId)||!canReadPresentedAthlete(access,athleteId))throw new Error("Athlete goal access denied.");
  const {data,error}=await access.supabase.rpc("athlete_numeric_goals",{p_athlete_id:athleteId});
  if(error)throw new Error("Player goals could not be loaded.");
  if(!record(data)||!Array.isArray(data.goals)||data.goals.length>100||!Array.isArray(data.choices)||data.choices.length>500)throw new Error("Player goal format is invalid.");
  const staff=canImportPresentedAccess(access),goals:PlayerNumericGoal[]=data.goals.map((item:unknown):PlayerNumericGoal=>{
    if(!record(item)||!UUID_PATTERN.test(String(item.id))||item.athleteId!==athleteId||!text(item.title,100)||!metric(item)||item.period!=="fall_2026"||
      !finite(item.baselineValue)||!validValue(item.metricKey,item.baselineValue,item.unit)||!date(item.baselineDate)||typeof item.baselineValid!=="boolean"||!finite(item.targetValue)||!validValue(item.metricKey,item.targetValue,item.unit)||item.targetValue===item.baselineValue||
      (item.targetDate!==null&&(!date(item.targetDate)||item.targetDate<item.baselineDate))||(item.staffNote!==null&&(!text(item.staffNote,600)))||typeof item.shared!=="boolean"||
      (item.completedAt!==null&&!timestamp(item.completedAt))||!Number.isSafeInteger(item.revision)||(item.revision as number)<1||!timestamp(item.createdAt)||
      (item.currentValue!==null&&!validValue(item.metricKey,item.currentValue,item.unit))||(item.currentDate!==null&&(!date(item.currentDate)||item.currentDate<item.baselineDate))||
      ((item.currentValue===null)!==(item.currentDate===null))||(!item.baselineValid&&item.currentValue!==null))throw new Error("Player goal format is invalid.");
    // Exact projection: neither a server-only note nor extra fields survive Player View as.
    return {id:item.id as string,athleteId,title:item.title,metricKey:item.metricKey as PlayerNumericGoal["metricKey"],metricLabel:item.metricLabel as string,source:item.source as string,unit:item.unit as string,period:"fall_2026",
      baselineValue:item.baselineValue,baselineDate:item.baselineDate,baselineValid:item.baselineValid,targetValue:item.targetValue,targetDate:item.targetDate as string|null,
      staffNote:staff?item.staffNote as string|null:null,shared:item.shared,completedAt:item.completedAt as string|null,revision:item.revision as number,createdAt:item.createdAt as string,currentValue:item.currentValue as number|null,currentDate:item.currentDate as string|null};
  }).filter(goal=>staff||goal.shared);
  // Validate source choices but never send staff baseline IDs to a player's client.
  const choices:PlayerGoalChoice[]=staff?data.choices.map((item:unknown)=>{
    if(!record(item)||!text(item.observationId,2000)||!metric(item)||!finite(item.value)||!validValue(item.metricKey,item.value,item.unit)||!date(item.measuredAt))throw new Error("Goal measurement choice format is invalid.");
    return {observationId:item.observationId,metricKey:item.metricKey as PlayerGoalChoice["metricKey"],metricLabel:item.metricLabel as string,source:item.source as string,unit:item.unit as string,value:item.value,measuredAt:item.measuredAt};
  }):[];
  if(new Set(goals.map(goal=>goal.id)).size!==goals.length||new Set(choices.map(choice=>choice.observationId)).size!==choices.length)throw new Error("Duplicate player goals or measurements.");
  return {goals,choices};
}
