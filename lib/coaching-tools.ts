import { variableKey, type AnalyticsPlayer, type AnalyticsReading } from "@/lib/analytics";
import { PLAYER_METRICS, validatePlayerMetricValue } from "@/lib/player-performance";
import { formatHeight } from "@/lib/measurement-display";
import { gameOverviewMetrics, type GameOverviewMetric } from "@/lib/game-overview";
import type { SharedGameStat } from "@/lib/game-server";

export type CoachingPlayer = AnalyticsPlayer & { secondaryPosition?: string };
export type CoachingGame = Omit<GameOverviewMetric,"comparison"> & { athleteId:string; snapshotId:string };
export type CoachingData = { players:CoachingPlayer[]; readings:AnalyticsReading[]; games:CoachingGame[] };
export type CoachingCategory = "Physicality" | "Hitting" | "Throwing";
export const COACHING_CATEGORIES:CoachingCategory[] = ["Physicality","Hitting","Throwing"];
export const COACHING_METRICS = PLAYER_METRICS.filter(m=>!["skeletal_muscle_mass","muscle_mass_pct"].includes(m.key));
export function coachingCategory(metric:string):CoachingCategory {
 const m=COACHING_METRICS.find(m=>m.key===metric);
 return m?.group==="body"?"Physicality":m?.group==="hitting"?"Hitting":"Throwing";
}
export function coachingReadingVisible(row:AnalyticsReading):boolean {
 const m=COACHING_METRICS.find(m=>m.key===row.metric);
 return !!m && /^2026-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(Date.parse(row.date)) && new Date(row.date).toISOString().slice(0,10)===row.date && validatePlayerMetricValue(m.key,row.value,row.unit);
}
export function coachingEligible(player:CoachingPlayer,metric:string):boolean {
 const positions=[player.position,player.secondaryPosition??""].map(p=>p.trim().toUpperCase());
 const type=player.playerType.trim().toLowerCase();
 const pitches=["pitcher","two_way"].includes(type)||positions.includes("P");
 const m=COACHING_METRICS.find(m=>m.key===metric);
 if(!m)return false;
 if(m.group==="body")return true;
 if(m.group==="hitting")return type==="two_way"||!pitches;
 if(m.group==="pitching")return pitches;
 return metric==="infield_velocity"?positions.some(p=>["IF","INF","1B","2B","3B","SS"].includes(p)):positions.some(p=>["OF","LF","CF","RF"].includes(p));
}
export function coachingValue(value:number,metric:string,unit:string):string {
 if(metric==="height")return formatHeight(value,unit)??"—";
 if(unit==="count")return value.toLocaleString("en-US");
 if(unit==="avg")return value.toFixed(3).replace(/^0\./,".");
 if(unit==="ratio")return value.toFixed(3);
 return `${value.toLocaleString("en-US",{maximumFractionDigits:1})}${unit==="%"?"%":` ${unit}`}`.trim();
}
export function coachingGames(stats:readonly SharedGameStat[]):CoachingGame[]{
 const output:CoachingGame[]=[];
 for(const athleteId of new Set(stats.map(r=>r.athlete_id))){
  const own=stats.filter(r=>r.athlete_id===athleteId);
  // Build each actual event separately so comparisons can select a shared event.
  for(const event of new Set([null,...own.filter(r=>r.source==="pitching_fall_2026").map(r=>r.event_id)])){
   const rows=own.filter(r=>event===null?r.source==="qpa_fall_2026":r.source==="pitching_fall_2026"&&r.event_id===event);
   for(const item of gameOverviewMetrics(rows,[]))output.push({athleteId,snapshotId:rows[0].snapshot_id,metric:item.metric,label:item.label,source:item.source,eventId:item.eventId,value:item.value,unit:item.unit,updatedAt:item.updatedAt,playedOn:item.playedOn,opportunities:item.opportunities,direction:item.direction,insightEligible:item.insightEligible});
  }
 }
 return output;
}
export function coachingVariables(data:CoachingData,category:CoachingCategory,today:string){
 const rows=data.readings.filter(r=>coachingReadingVisible(r)&&coachingCategory(r.metric)===category&&r.date<="2026-12-31"&&r.date<=today&&r.date>=(category==="Physicality"?"2026-06-01":"2026-09-01"));
 return [...new Map(rows.map(r=>[variableKey(r),{key:variableKey(r),metric:r.metric,label:COACHING_METRICS.find(m=>m.key===r.metric)!.label,unit:r.unit,source:r.source}])).values()].sort((a,b)=>a.metric==="muscle_mass"&&b.metric!==a.metric?-1:b.metric==="muscle_mass"&&a.metric!==b.metric?1:a.label.localeCompare(b.label)||a.source.localeCompare(b.source)||a.unit.localeCompare(b.unit));
}
export type TestResult={latest:AnalyticsReading|null;previous:AnalyticsReading|null;conflict:boolean};
export function comparableTests(data:CoachingData,athleteId:string,key:string,today:string):TestResult {
 const candidates=data.readings.filter(r=>r.athleteId===athleteId&&variableKey(r)===key&&coachingReadingVisible(r)&&r.date<=today&&r.date<="2026-12-31"&&r.date>=(coachingCategory(r.metric)==="Physicality"?"2026-06-01":"2026-09-01"));
 const dates=[...new Set(candidates.map(r=>r.date))].sort().reverse();
 if(!dates.length||dates[0]<"2026-09-01")return {latest:null,previous:null,conflict:false};
 const latest=candidates.filter(r=>r.date===dates[0]);
 if(new Set(latest.map(r=>r.value)).size!==1)return {latest:null,previous:null,conflict:true};
 const previous=candidates.filter(r=>r.date===dates[1]);
 const conflict=new Set(previous.map(r=>r.value)).size>1;
 return {latest:latest[0],previous:conflict?null:previous[0]??null,conflict};
}
export const daysBetween=(a:string,b:string)=>Math.abs(Date.parse(a)-Date.parse(b))/86400000;
export function progressTone(metric:string,change:number):"positive"|"negative"|"neutral" {
 if(change===0)return "neutral";
 const direction=metric==="body_fat_pct"?"lower":["muscle_mass","body_score"].includes(metric)?"higher":COACHING_METRICS.find(m=>m.key===metric)?.direction??"neutral";
 return direction==="neutral"?"neutral":(direction==="higher"?change>0:change<0)?"positive":"negative";
}
export function progressRows(data:CoachingData,key:string,today:string,retestDays:number){
 const metric=data.readings.find(r=>variableKey(r)===key)?.metric;
 if(!metric)return [];
 return data.players.filter(p=>coachingEligible(p,metric)).map(player=>{
  const tests=comparableTests(data,player.id,key,today);
  const delta=tests.latest&&tests.previous?tests.latest.value-tests.previous.value:null;
  const percent=delta!==null&&tests.previous!.value>0?100*delta/tests.previous!.value:null;
  const due=tests.latest?daysBetween(tests.latest.date,today)>retestDays:!tests.conflict;
  return {player,...tests,delta,percent,due,tone:progressTone(metric,delta??0)};
 }).sort((a,b)=>Math.abs(b.percent??0)-Math.abs(a.percent??0)||a.player.name.localeCompare(b.player.name));
}
export function compareTests(data:CoachingData,a:string,b:string,category:CoachingCategory,today:string,maxGap:number){
 return coachingVariables(data,category,today).map(variable=>{
  const playerA=data.players.find(p=>p.id===a),playerB=data.players.find(p=>p.id===b);
  const eligibleA=!!playerA&&coachingEligible(playerA,variable.metric),eligibleB=!!playerB&&coachingEligible(playerB,variable.metric);
  const first=eligibleA?comparableTests(data,a,variable.key,today):{latest:null,previous:null,conflict:false};
  const second=eligibleB?comparableTests(data,b,variable.key,today):{latest:null,previous:null,conflict:false};
  const gap=first.latest&&second.latest?daysBetween(first.latest.date,second.latest.date):null;
  return {...variable,first:first.latest,second:second.latest,reviewA:first.conflict&&!first.latest,reviewB:second.conflict&&!second.latest,eligibleA,eligibleB,gap,comparable:a!==b&&gap!==null&&gap<=maxGap};
 }).filter(row=>(row.eligibleA||row.eligibleB)&&(row.first||row.second||row.reviewA||row.reviewB));
}
export function compareGames(data:CoachingData,a:string,b:string,event:string){
 const rows=data.games.filter(r=>r.eventId===event);
 const keys=[...new Set(rows.filter(r=>r.athleteId===a||r.athleteId===b).map(r=>r.metric))];
 return keys.map(metric=>{
  const aa=rows.filter(r=>r.athleteId===a&&r.metric===metric),bb=rows.filter(r=>r.athleteId===b&&r.metric===metric);
  const first=aa.length===1?aa[0]:null,second=bb.length===1?bb[0]:null;
  return {metric,label:(first??second)?.label??metric,first,second,comparable:a!==b&&!!first&&!!second&&first.source===second.source&&first.snapshotId===second.snapshotId&&first.unit===second.unit};
 });
}
