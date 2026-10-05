import { analyticsBlastFallReadings } from "@/lib/analytics-blast-fall";
import { parseBlastSource } from "@/lib/blast-metrics";
import type { Measurement } from "@/lib/imports/engine";
import { createReadLimiter } from "@/lib/limited-reads";
import { validBlastObservation } from "@/lib/blast-metrics";
import { buildHomeSummary } from "@/lib/home-summary";
import { buildDataCoverage } from "@/lib/data-coverage";
import { pacificTestingDate } from "@/lib/testing-checklist";
import { coachUpdateDigest } from "@/lib/coach-update-digest";
import { loadGameStats } from "@/lib/game-server";
import { qpaAnalytics, pitchingAnalytics } from "@/lib/game-analytics";
import "server-only";
import { loadTeamFallSummaries } from "@/lib/player-fall-summaries-server";
import { loadAnalyticsFallReadings } from "@/lib/analytics-fall-server";
import { coachingReadingVisible, coachingGames } from "@/lib/coaching-tools";
import { requireRenderImportAccess as requireImportAccess } from "@/lib/render-access";
import { UUID_PATTERN, formatClassYear } from "@/lib/types";
import { analyticsReadingVisible } from "@/lib/analytics";
import { buildVisitDigest } from "@/lib/dashboard-visit-digest";
import type { DashboardVisitWindow } from "@/lib/personal-dashboard-server";
import type { AnalyticsDataset, AnalyticsPlayer, AnalyticsReading } from "@/lib/analytics";
import { classifiedPitchSource, CLASSIFIED_METRICS } from "@/lib/imports/classified-pitch-results";
import { fallArsenalPitches, type ArsenalReading } from "@/lib/pitch-arsenal";

class AnalyticsReadError extends Error {
  constructor(readonly reason:string){super(`Analytics data could not be verified. Refresh to load the current measurements. [${reason}]`);this.name="AnalyticsReadError";}
}
const fail=(reason="invalid-reading"):never=>{throw new AnalyticsReadError(reason);};
const queryTimedOut=(error:unknown)=>error instanceof AnalyticsReadError&&error.reason==="source-query:57014";
const text=(v:unknown,n=120):v is string=>typeof v==="string"&&v.length>0&&v.length<=n&&!/[\u0000-\u001f\u007f]/.test(v);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
export async function analyticsPages<T>(request:(from:number,to:number)=>PromiseLike<{data:unknown;error:unknown;count:number|null}>,parse:(row:unknown)=>T,maximum:number):Promise<T[]>{
  const rows:T[]=[];let count:number|undefined;
  async function page(offset:number){
    const result=await request(offset,offset+499);
    // Report only an allowlisted error code or fixed reason, never provider details or row data.
    if(result.error){
      const code=object(result.error)&&typeof result.error.code==="string"&&result.error.code===result.error.code.trim()&&/^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/.test(result.error.code)?result.error.code:"unknown";
      return fail(`source-query:${code}`);
    }
    if(!Array.isArray(result.data)||result.count===null||!Number.isSafeInteger(result.count)||result.count<0)return fail("invalid-page");
    if(result.count>maximum)return fail("source-limit");
    if(count!==undefined&&count!==result.count)return fail("source-changed");
    count=result.count;
    if(result.data.length!==Math.min(500,count-offset))return fail("incomplete-page");
    return result.data.map(parse);
  }
  rows.push(...await page(0));
  // Establish the complete bounded shape first, then read at most three pages at once.
  // Drain every request before propagating an error so a timeout retry cannot overlap it.
  // Every page still verifies the exact same count; invalid data never becomes retryable.
  for(let offset=500;offset<count!;offset+=1500){
    const offsets=[offset,offset+500,offset+1000].filter(start=>start<count!);
    const pages=await Promise.allSettled(offsets.map(page));
    const failure=pages.find(result=>result.status==="rejected"&&!queryTimedOut(result.reason))??pages.find(result=>result.status==="rejected");
    if(failure?.status==="rejected")throw failure.reason;
    for(const result of pages)if(result.status==="fulfilled")rows.push(...result.value);
  }
  return rows;
}
async function loadTeamSource(includeFullRoster=false, includeGames=true, includeArsenal=false, includeReadings=true, homeRead=false, includeBlast=false){
  // Fresh trusted account check also denies Admin-as-Player before any team query.
  const access=await requireImportAccess();
  const {supabase}=access;
  const [players, gameRows]=await Promise.all([analyticsPages((from,to)=>supabase.from("athletes").select("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons!inner(season,academic_class,primary_position,secondary_position,player_type,bats,throws,roster_status)",{count:"exact"}).eq("athlete_seasons.season","2026-27").order("id").range(from,to),row=>{
    if(!object(row)||!text(row.id)||!UUID_PATTERN.test(row.id)||!text(row.athlete_code,40)||!text(row.first_name,100)||!text(row.last_name,100)||(row.preferred_name!==null&&!text(row.preferred_name,100))||!Array.isArray(row.athlete_seasons)||row.athlete_seasons.length!==1)return fail();
    const s=row.athlete_seasons[0];if(!object(s)||s.season!=="2026-27"||(s.secondary_position!=null&&!text(s.secondary_position))||["academic_class","primary_position","player_type","bats","throws","roster_status"].some(k=>s[k]!==null&&!text(s[k])))return fail();
    return {id:row.id,code:row.athlete_code,name:`${row.preferred_name||row.first_name} ${row.last_name}`,academicClass:formatClassYear(typeof s.academic_class==="string"?s.academic_class:null),position:s.primary_position??"",secondaryPosition:s.secondary_position??"",playerType:s.player_type??"",bats:s.bats??"",throws:s.throws??"",status:s.roster_status} as AnalyticsPlayer&{status:string|null;secondaryPosition:string};
  },1000), includeGames ? loadGameStats(access) : Promise.resolve([])]);
  const eligible=players.filter(p=>includeFullRoster||p.status===null||p.status==="active"||p.status==="redshirt");
  if(new Set(players.map(p=>p.id)).size!==players.length)return fail();
  const readings:AnalyticsReading[]=[];
  // File identity stays server-side, used for staff arsenal and Blast completeness checks.
  const blastReadings: Measurement[]=[];
  const arsenalReadings: (ArsenalReading & { athleteId:string })[]=[];
  const fields="observation_id,athlete_id,metric_key,metric,unit,value,measured_at,source,imported_at"+(includeArsenal||includeBlast?",file_hash":"");
  type TeamReading={reading:AnalyticsReading;arsenal?:ArsenalReading&{athleteId:string};blast?:Measurement};
  const limited = createReadLimiter(3);
  async function readAttempt(ids:string[],maximum:number):Promise<TeamReading[]>{
    return analyticsPages((from,to)=>limited(()=>supabase.from("performance_display_measurements").select(fields,{count:"exact"}).in("athlete_id",ids).gte("measured_at",homeRead?"2026-09-01":"2026-06-01").lte("measured_at","2026-12-31").order("observation_id").range(from,to)),row=>{
    if(!object(row)||!text(row.observation_id,2000)||!text(row.athlete_id)||!ids.includes(row.athlete_id)||!text(row.metric_key)||!text(row.metric,300)||!text(row.unit,80)||!text(row.source,100)||typeof row.value!=="number"||!Number.isFinite(row.value)||(row.value<0&&!validBlastObservation(row.metric_key,row.value,row.unit,row.source,row.measured_at as string))||!text(row.measured_at)||!/^2026-\d{2}-\d{2}$/.test(row.measured_at)||!Number.isFinite(Date.parse(row.measured_at))||new Date(row.measured_at).toISOString().slice(0,10)!==row.measured_at||!text(row.imported_at)||!Number.isFinite(Date.parse(row.imported_at)))return fail();
    let arsenal:TeamReading["arsenal"];
    if(includeArsenal && classifiedPitchSource(row.source)) {
      if(typeof row.file_hash!=="string"||!/^[a-f0-9]{64}$/.test(row.file_hash)||!CLASSIFIED_METRICS.some(m=>m.key===row.metric_key&&m.label===row.metric&&m.unit===row.unit))return fail();
      arsenal={athleteId:row.athlete_id,source:row.source,metric:row.metric,unit:row.unit,value:row.value,measured_at:row.measured_at,file_hash:row.file_hash};
    }
    let blast:Measurement|undefined;
    if(includeBlast && parseBlastSource(row.source)) {
      if(typeof row.file_hash!=="string"||!/^[a-f0-9]{64}$/.test(row.file_hash)||!validBlastObservation(row.metric_key,row.value,row.unit,row.source,row.measured_at))return fail();
      blast={id:row.observation_id,athlete_code:row.athlete_id,metric:row.metric,unit:row.unit,value:row.value,measured_at:row.measured_at,source:row.source,file_hash:row.file_hash,source_file:"",source_sheet:"",source_row:0};
    }
    return {reading:{id:row.observation_id,athleteId:row.athlete_id,metric:row.metric_key,label:row.metric,unit:row.unit,value:row.value,date:row.measured_at,source:row.source,importedAt:row.imported_at},...(arsenal?{arsenal}:{}),...(blast?{blast}:{})};
    },maximum);
  }
  // A small ID partition reduces work per exact count under the existing staff RLS.
  // Only one failed partition may split per load; neither half retries recursively.
  let splitUsed=false;
  async function readBatch(ids:string[],maximum:number):Promise<TeamReading[]>{
    try{return await readAttempt(ids,maximum);}catch(error){
      if(!queryTimedOut(error)||splitUsed||ids.length<2)throw error;
      splitUsed=true;
      const middle=Math.ceil(ids.length/2),left=await readAttempt(ids.slice(0,middle),maximum);
      const right=await readAttempt(ids.slice(middle),maximum-left.length);
      return [...left,...right];
    }
  }
  const append = (page: TeamReading[]) => {
    for(const row of page){readings.push(row.reading);if(row.arsenal)arsenalReadings.push(row.arsenal);if(row.blast)blastReadings.push(row.blast);}
    if(readings.length>20000)return fail("source-limit");
  };
  if(homeRead && includeReadings){
    // Start disjoint partitions together, but share one three-query budget across
    // every partition and every paginated follow-up. Drain failures before returning.
    const partitions=Array.from({length:Math.ceil(eligible.length/10)},(_,i)=>eligible.slice(i*10,i*10+10).map(p=>p.id));
    const results=await Promise.allSettled(partitions.map(ids=>readBatch(ids,20000)));
    const failed=results.find(r=>r.status==="rejected");
    if(failed?.status==="rejected")throw failed.reason;
    for(const result of results)if(result.status==="fulfilled")append(result.value);
  }else for(let start=0;includeReadings && start<eligible.length;start+=10){
    append(await readBatch(eligible.slice(start,start+10).map(p=>p.id),20000-readings.length));
  }
  if(new Set(readings.map(r=>r.id)).size!==readings.length)return fail();
  const games=gameRows.filter(row=>eligible.some(player=>player.id===row.athlete_id));
  // The whole roster is selectable, but team production uses the ranking-eligible cohort.
  const rankingIds=new Set(players.filter(p=>p.status===null||p.status==="active"||p.status==="redshirt").map(p=>p.id));
  const rankingGames=gameRows.filter(row=>rankingIds.has(row.athlete_id));
  return {players:eligible.map(p=>({id:p.id,code:p.code,name:p.name,academicClass:p.academicClass,position:p.position,secondaryPosition:p.secondaryPosition,playerType:p.playerType,bats:p.bats,throws:p.throws})).sort((a,b)=>a.name.localeCompare(b.name)),readings,games,rankingGames,arsenalReadings,blastReadings};
}
export async function loadAnalytics():Promise<AnalyticsDataset>{
  const data=await loadTeamSource(false,true,false,true,false,true);
  const blast=analyticsBlastFallReadings(data.readings,data.blastReadings,pacificTestingDate());
  const readings=await loadAnalyticsFallReadings(await requireImportAccess(),data.players,blast.filter(analyticsReadingVisible));
  return {players:data.players.map(p=>({id:p.id,code:p.code,name:p.name,academicClass:p.academicClass,position:p.position,playerType:p.playerType,bats:p.bats,throws:p.throws})),readings:[...readings,...qpaAnalytics(data.games),...pitchingAnalytics(data.games)]};
}
export async function loadCoachingData(){
  const data=await loadTeamSource(false,true,false,true,false,true);
  return {players:data.players,readings:analyticsBlastFallReadings(data.readings,data.blastReadings,pacificTestingDate()).filter(coachingReadingVisible),games:coachingGames(data.games)};
}

/** Current eligible roster and cumulative game stats only; no testing or CSV queries. */
export async function loadTopPerformersData(){
  const data=await loadTeamSource(false,true,false,false);
  return {players:data.players,games:coachingGames(data.games,data.rankingGames)};
}

/** Staff comparison can select any current-season roster identity, even without results. */
export async function loadComparisonData(){
  const data=await loadTeamSource(true,true,true,true,false,true);
  const today=pacificTestingDate();
  const arsenals=data.players.map(player=>({athleteId:player.id,pitches:fallArsenalPitches(data.arsenalReadings.filter(row=>row.athleteId===player.id),today)})).filter(row=>row.pitches.length>0);
  const readings=analyticsBlastFallReadings(data.readings,data.blastReadings,today).filter(coachingReadingVisible);
  // Same Fall best / weighted Fall average as the leaderboards; on failure the comparison keeps latest-session values.
  const fallSummaries=await loadTeamFallSummaries(await requireImportAccess(),readings,data.players).catch(()=>[]);
  return {players:data.players,readings,games:coachingGames(data.games,data.rankingGames),arsenals,fallSummaries};
}

/** Coverage projects only identities, metric availability and dates to the client. */
export async function loadDataCoverage(){
  const data=await loadTeamSource(false, false);
  return buildDataCoverage(data.players, data.readings, pacificTestingDate());
}

/** Same fresh staff guard; only aggregated coverage and source freshness leave the server. */
export async function loadStaffHomeSummary(visit?:DashboardVisitWindow){
  const data=await loadTeamSource(false,true,false,true,true);
  const today=pacificTestingDate();
  return {...buildHomeSummary(data.players.map(p=>p.id),data.readings,data.games,today),...(visit?{visitDigest:buildVisitDigest(data.players,data.readings,data.games,visit,today)}:{}),coachDigest:coachUpdateDigest({players:data.players,readings:data.readings.filter(coachingReadingVisible),games:coachingGames(data.games)},today)};
}
