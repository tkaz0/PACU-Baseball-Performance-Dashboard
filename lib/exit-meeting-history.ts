import { parseExitMeetingOptions, type ExitMeetingReport } from "@/lib/exit-meeting";
import { UUID_PATTERN } from "@/lib/types";

export const EXIT_MEETING_HISTORY_LIMIT = 50;
export const EXIT_MEETING_SNAPSHOT_BYTES = 262144;
export type ExitMeetingSnapshotMeta = { id:string; athleteId:string; meetingDate:string; createdAt:string; generatedAt:string; metricCount:number; hasNotes:boolean; schemaVersion:1 };
export type ExitMeetingHistory = { items:ExitMeetingSnapshotMeta[]; hasMore:boolean };
export type SavedExitMeeting = ExitMeetingSnapshotMeta & { report:ExitMeetingReport; talkingPoints:string };
export type SaveExitMeetingCommand = { athleteId:string; requestId:string; meetingDate:string; talkingPoints:string; reviewed:true };
const fail=():never=>{throw new Error("The saved meeting could not be verified.");};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const keys=(value:Record<string,unknown>,required:string[],optional:string[]=[])=>required.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>[...required,...optional].includes(key));
const text=(value:unknown,max:number,empty=false):value is string=>typeof value==="string"&&(empty||value.length>0)&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(value);
const date=(value:unknown):value is string=>typeof value==="string"&&/^20\d\d-\d\d-\d\d$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const stamp=(value:unknown):value is string=>typeof value==="string"&&value.length<=40&&/^20\d\d-\d\d-\d\dT([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)&&date(value.slice(0,10))&&Number.isFinite(Date.parse(value));
const numeric=(value:unknown,min:number,max:number)=>typeof value==="number"&&Number.isFinite(value)&&value>=min&&value<=max;
const array=(value:unknown,max:number):value is unknown[]=>Array.isArray(value)&&value.length<=max;
const optional=(value:unknown,check:(value:unknown)=>boolean)=>value===undefined||check(value);
const nullable=(value:unknown,check:(value:unknown)=>boolean)=>value===null||check(value);
const reportKeys=["format","name","code","jersey","position","academicClass","batsThrows","season","generatedAt","lastTested","lastGameUpdate","strengths","development","jumps","sections","missing","notes"];
/** Versioned, bounded display-only schema; reject raw provenance or unknown nested fields. */
export function parseExitMeetingSnapshotReport(value:unknown):ExitMeetingReport {
 if(!object(value)||!keys(value,reportKeys)||new TextEncoder().encode(JSON.stringify(value)).length>EXIT_MEETING_SNAPSHOT_BYTES||value.format!=="meeting"||value.season!=="Fall 2026"||!text(value.name,220)||!text(value.code,40)||!/^PAC-\d{4,}$/.test(value.code)||!["jersey","position","academicClass","batsThrows"].every(key=>text(value[key],160,true))||!stamp(value.generatedAt)||!nullable(value.lastTested,date)||!nullable(value.lastGameUpdate,stamp))return fail();
 for(const group of ["strengths","development","jumps"]){const items=value[group];if(!array(items,2)||items.some(item=>!object(item)||!keys(item,["label","detail","percentile"])||!text(item.label,180)||!text(item.detail,1200)||!nullable(item.percentile,n=>numeric(n,0,100))))return fail();}
 if(!array(value.missing,20)||!array(value.notes,20)||value.missing.some(item=>!text(item,500))||value.notes.some(item=>!text(item,2000))||!array(value.sections,24))return fail();
 let rowCount=0;const ids=new Set<string>();
 for(const section of value.sections){
  if(!object(section)||!keys(section,["id","title","subtitle","rows"],["note"])||!text(section.id,100)||ids.has(section.id)||!text(section.title,180)||!text(section.subtitle,1000)||!optional(section.note,n=>text(n,2000))||!array(section.rows,150))return fail();ids.add(section.id);rowCount+=section.rows.length;
  for(const row of section.rows){
   if(!object(row)||!keys(row,["label","value","source","date","basis","percentile","peers","sample"],["metricKey","tone","trend"])||!text(row.label,200)||!text(row.value,250)||!text(row.source,160)||!text(row.date,80)||!text(row.basis,350)||!nullable(row.sample,n=>text(n,250))||!nullable(row.percentile,n=>numeric(n,0,100))||!nullable(row.peers,n=>numeric(n,1,1000)&&Number.isSafeInteger(n))||row.percentile!==null&&(row.peers===null||(row.peers as number)<5)||!optional(row.metricKey,n=>text(n,100)&&/^[a-z0-9_]+$/.test(n))||!optional(row.tone,n=>["none","green","yellow","red"].includes(n as string)))return fail();
   if(row.trend!==undefined&&(!array(row.trend,8)||row.trend.some(point=>!object(point)||!keys(point,["date","value"])||!date(point.date)||!numeric(point.value,-1e9,1e9))))return fail();
  }
 }
 if(rowCount>300)return fail();
 return value as unknown as ExitMeetingReport;
}
export function parseSaveExitMeetingCommand(value:unknown):SaveExitMeetingCommand {
 if(!object(value)||!keys(value,["athleteId","requestId","meetingDate","reviewed"],["talkingPoints"])||!UUID_PATTERN.test(String(value.athleteId))||!UUID_PATTERN.test(String(value.requestId))||value.reviewed!==true)return fail();
 const options=parseExitMeetingOptions(value);
 const talkingPoints=options.talkingPoints.replace(/\r\n?/g,"\n").normalize("NFC");
 if(!text(talkingPoints,1600,true))return fail();
 return {athleteId:value.athleteId as string,requestId:value.requestId as string,meetingDate:options.meetingDate,talkingPoints,reviewed:true};
}
export function parseExitMeetingSnapshotMeta(value:unknown,athleteId:string):ExitMeetingSnapshotMeta {
 if(!object(value)||!keys(value,["id","athleteId","meetingDate","createdAt","generatedAt","metricCount","hasNotes","schemaVersion"])||!UUID_PATTERN.test(String(value.id))||value.athleteId!==athleteId||!date(value.meetingDate)||!stamp(value.createdAt)||!stamp(value.generatedAt)||!numeric(value.metricCount,0,300)||!Number.isSafeInteger(value.metricCount)||typeof value.hasNotes!=="boolean"||value.schemaVersion!==1)return fail();
 return value as ExitMeetingSnapshotMeta;
}
export function parseSavedExitMeeting(value:unknown,athleteId:string):SavedExitMeeting {
 if(!object(value)||!keys(value,["id","athleteId","meetingDate","createdAt","generatedAt","metricCount","hasNotes","schemaVersion","report","talkingPoints"])||!text(value.talkingPoints,1600,true))return fail();
 const {report:rawReport,talkingPoints,...rawMeta}=value,meta=parseExitMeetingSnapshotMeta(rawMeta,athleteId),report=parseExitMeetingSnapshotReport(rawReport);
 if(meta.generatedAt!==report.generatedAt||meta.metricCount!==report.sections.reduce((sum,section)=>sum+section.rows.length,0)||meta.hasNotes!==!!talkingPoints)return fail();
 return {...meta,report,talkingPoints};
}
