import "server-only";
import { requireImportAccess } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/types";
import type { AnalyticsDataset, AnalyticsPlayer, AnalyticsReading } from "@/lib/analytics";

const fail=():never=>{throw new Error("Analytics data could not be verified. Refresh to load the current measurements.");};
const text=(v:unknown,n=120):v is string=>typeof v==="string"&&v.length>0&&v.length<=n&&!/[\u0000-\u001f\u007f]/.test(v);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
export async function analyticsPages<T>(request:(from:number,to:number)=>PromiseLike<{data:unknown;error:unknown;count:number|null}>,parse:(row:unknown)=>T,maximum:number):Promise<T[]>{
  const rows:T[]=[];let count:number|undefined;
  for(let offset=0;;offset+=500){const result=await request(offset,offset+499);if(result.error||!Array.isArray(result.data)||result.count===null||!Number.isSafeInteger(result.count)||result.count<0||result.count>maximum||(count!==undefined&&count!==result.count))return fail();count=result.count;if(result.data.length!==Math.min(500,count-offset))return fail();rows.push(...result.data.map(parse));if(rows.length===count)return rows;}
}
export async function loadAnalytics():Promise<AnalyticsDataset>{
  // Fresh trusted account check also denies Admin-as-Player before any team query.
  const {supabase}=await requireImportAccess();
  const players=await analyticsPages((from,to)=>supabase.from("athletes").select("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons!inner(season,academic_class,primary_position,player_type,bats,throws,roster_status)",{count:"exact"}).eq("athlete_seasons.season","2026-27").order("id").range(from,to),row=>{
    if(!object(row)||!text(row.id)||!UUID_PATTERN.test(row.id)||!text(row.athlete_code,40)||!text(row.first_name,100)||!text(row.last_name,100)||(row.preferred_name!==null&&!text(row.preferred_name,100))||!Array.isArray(row.athlete_seasons)||row.athlete_seasons.length!==1)return fail();
    const s=row.athlete_seasons[0];if(!object(s)||s.season!=="2026-27"||["academic_class","primary_position","player_type","bats","throws","roster_status"].some(k=>s[k]!==null&&!text(s[k])))return fail();
    return {id:row.id,code:row.athlete_code,name:`${row.preferred_name||row.first_name} ${row.last_name}`,academicClass:s.academic_class??"",position:s.primary_position??"",playerType:s.player_type??"",bats:s.bats??"",throws:s.throws??"",status:s.roster_status} as AnalyticsPlayer&{status:string|null};
  },1000);
  const eligible=players.filter(p=>p.status===null||p.status==="active"||p.status==="redshirt");
  if(new Set(players.map(p=>p.id)).size!==players.length)return fail();
  const readings:AnalyticsReading[]=[];
  for(let start=0;start<eligible.length;start+=100){const ids=eligible.slice(start,start+100).map(p=>p.id);const page=await analyticsPages((from,to)=>supabase.from("performance_measurements").select("observation_id,athlete_id,metric_key,metric,unit,value,measured_at,source,imported_at",{count:"exact"}).in("athlete_id",ids).gte("measured_at","2026-06-01").lte("measured_at","2026-12-31").order("observation_id").range(from,to),row=>{
    if(!object(row)||!text(row.observation_id,2000)||!text(row.athlete_id)||!ids.includes(row.athlete_id)||!text(row.metric_key)||!text(row.metric,300)||!text(row.unit,80)||!text(row.source,100)||typeof row.value!=="number"||!Number.isFinite(row.value)||row.value<0||!text(row.measured_at)||!/^2026-\d{2}-\d{2}$/.test(row.measured_at)||!Number.isFinite(Date.parse(row.measured_at))||new Date(row.measured_at).toISOString().slice(0,10)!==row.measured_at||!text(row.imported_at)||!Number.isFinite(Date.parse(row.imported_at)))return fail();
    return {id:row.observation_id,athleteId:row.athlete_id,metric:row.metric_key,label:row.metric,unit:row.unit,value:row.value,date:row.measured_at,source:row.source,importedAt:row.imported_at};
  },20000);readings.push(...page);if(readings.length>20000)return fail();}
  if(new Set(readings.map(r=>r.id)).size!==readings.length)return fail();
  return {players:eligible.map(p=>({id:p.id,code:p.code,name:p.name,academicClass:p.academicClass,position:p.position,playerType:p.playerType,bats:p.bats,throws:p.throws})).sort((a,b)=>a.name.localeCompare(b.name)),readings};
}
