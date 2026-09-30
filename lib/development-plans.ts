import { UUID_PATTERN } from "@/lib/types";

export type DevelopmentDrill = { id:string; title:string; cue:string|null; completedAt:string|null };
export type DevelopmentPlan = { id:string; athleteId:string; weekStart:string; focus:string; drills:DevelopmentDrill[]; staffNote:string|null; shared:boolean; archived:boolean; revision:number; createdAt:string; updatedAt:string };
export type DevelopmentPlanInput = { weekStart:string; focus:string; drills:Pick<DevelopmentDrill,"id"|"title"|"cue">[]; staffNote:string|null; shared:boolean; archived:boolean };
export type DevelopmentActionState = { status:"idle"|"saved"|"invalid"|"stale"|"error"|"unverified"; message:string };
export const DEVELOPMENT_INITIAL_STATE:DevelopmentActionState={status:"idle",message:""};
export const DEVELOPMENT_MAX_DRILLS=4;
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
export const developmentText=(value:unknown,max:number):value is string=>typeof value==="string"&&Array.from(value).length>0&&Array.from(value).length<=max&&value.trim()===value&&!/[\u0000-\u001f\u007f]/.test(value);
export function developmentDate(value:unknown):value is string{return typeof value==="string"&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;}
export function developmentWeekStart(value:string){if(!developmentDate(value))throw new Error("Invalid development week.");const day=new Date(`${value}T12:00:00Z`);day.setUTCDate(day.getUTCDate()-((day.getUTCDay()+6)%7));return day.toISOString().slice(0,10);}
export function validDevelopmentWeek(value:unknown):value is string{return developmentDate(value)&&value>="2026-08-31"&&value<="2027-12-27"&&developmentWeekStart(value)===value;}
export function developmentWeekLabel(value:string){const start=new Date(`${value}T12:00:00Z`),end=new Date(start.getTime()+6*86400000),format=(date:Date)=>date.toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"});return `${format(start)} – ${format(end)}`;}
export function featuredDevelopmentPlan(plans:readonly DevelopmentPlan[],today:string):DevelopmentPlan|undefined{
  const week=developmentWeekStart(today),active=plans.filter(plan=>!plan.archived).sort((a,b)=>b.weekStart.localeCompare(a.weekStart));
  return active.find(plan=>plan.weekStart===week)??active.find(plan=>plan.weekStart<week)??active.at(-1);
}
export function validateDevelopmentPlanInput(value:unknown):value is DevelopmentPlanInput{
  if(!record(value)||!validDevelopmentWeek(value.weekStart)||!developmentText(value.focus,120)||typeof value.shared!=="boolean"||typeof value.archived!=="boolean"||(value.staffNote!==null&&!developmentText(value.staffNote,600))||!Array.isArray(value.drills)||value.drills.length<1||value.drills.length>DEVELOPMENT_MAX_DRILLS)return false;
  return value.drills.every(drill=>record(drill)&&typeof drill.id==="string"&&UUID_PATTERN.test(drill.id)&&developmentText(drill.title,120)&&(drill.cue===null||developmentText(drill.cue,300)))&&new Set(value.drills.map(drill=>drill.id)).size===value.drills.length;
}
const timestamp=(value:unknown):value is string=>typeof value==="string"&&Number.isFinite(Date.parse(value));
/** Project known fields again for Player View, where the underlying JWT is Admin. */
export function parseDevelopmentPlans(data:unknown,athleteId:string,staff:boolean):DevelopmentPlan[]{
  if(!Array.isArray(data)||data.length>104)throw new Error("Weekly plan format is invalid.");
  const plans=data.map((item:unknown):DevelopmentPlan=>{
    if(!record(item)||!validateDevelopmentPlanInput(item))throw new Error("Weekly plan format is invalid.");
    const row=item as DevelopmentPlanInput&Record<string,unknown>;
    if(typeof row.id!=="string"||!UUID_PATTERN.test(row.id)||row.athleteId!==athleteId||!Number.isSafeInteger(row.revision)||(row.revision as number)<1||!timestamp(row.createdAt)||!timestamp(row.updatedAt))throw new Error("Weekly plan format is invalid.");
    const drills=(row.drills as unknown[]).map((drill):DevelopmentDrill=>{if(!record(drill)||(drill.completedAt!==null&&!timestamp(drill.completedAt)))throw new Error("Weekly drill format is invalid.");return {id:drill.id as string,title:drill.title as string,cue:drill.cue as string|null,completedAt:drill.completedAt as string|null};});
    return {id:row.id,athleteId,weekStart:row.weekStart,focus:row.focus,drills,staffNote:staff?row.staffNote:null,shared:row.shared,archived:row.archived,revision:row.revision as number,createdAt:row.createdAt,updatedAt:row.updatedAt};
  }).filter(plan=>staff||(plan.shared&&!plan.archived));
  if(new Set(plans.map(plan=>plan.id)).size!==plans.length||new Set(plans.map(plan=>plan.weekStart)).size!==plans.length)throw new Error("Duplicate weekly plans.");
  return plans.sort((a,b)=>b.weekStart.localeCompare(a.weekStart));
}
