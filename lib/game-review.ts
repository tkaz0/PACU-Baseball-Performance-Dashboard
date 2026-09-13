import type {SharedGameStat} from "@/lib/game-server";
import {countIssues,type GameLog} from "@/lib/game-log";
import {battingRates} from "@/lib/batting-stats";
import {GAME_SOURCES} from "@/lib/game-source-config";
export type GameReviewIssue={id:string;athleteId:string;source:string;message:string;href:string;action:string};
export function reviewGameData(stats:readonly SharedGameStat[],logs:readonly GameLog[]):GameReviewIssue[]{
 const issues:GameReviewIssue[]=[],groups=new Map<string,SharedGameStat[]>();
 for(const row of stats){const key=JSON.stringify([row.source,row.athlete_id,row.snapshot_id,row.event_id]);groups.set(key,[...(groups.get(key)??[]),row]);}
 for(const [group,rows]of groups){const first=rows[0],qpa=first.source==="qpa_fall_2026",v=Object.fromEntries(rows.map(r=>[r.metric,r.value])),source=GAME_SOURCES[first.source];
 const href=`https://docs.google.com/spreadsheets/d/${source.spreadsheetId}/edit#gid=${source.sheetId}&range=A${first.source_row}:${qpa?"AC":"AE"}${first.source_row}`;
 const add=(id:string,message:string)=>issues.push({id:`${group}:${id}`,athleteId:first.athlete_id,source:qpa?"QPA · Fall totals":`Pitching · ${first.played_on}`,message,href,action:"Open Source Row"});
 if(qpa){
  const mapped=Object.fromEntries(Object.entries(v).map(([k,n])=>[{base_hit:"h",pumps:"hr",sac_fly:"sf",sac_bunt:"sh",punchies:"k"}[k]??k,n]));
  for(const [i,message]of countIssues(mapped,{}).entries())add(`counts-${i}`,message);
  const missing=["pa","ab","base_hit","bb","hbp","sac_fly"].filter(k=>v[k]===undefined);if(missing.length)add("missing",`Missing counts for batting rates: ${missing.map(k=>({base_hit:"Hits",sac_fly:"Sac Fly"}[k]??k.toUpperCase())).join(", ")}.`);
  if(v.qpa!==undefined&&v.pa!==undefined&&v.qpa>v.pa)add("qpa","QPA count exceeds PA.");
  if(["hh_base_hit","three_eight_hh","hh_extra_base_hit","pumps","ab","punchies","sac_bunt"].every(k=>v[k]!==undefined)){
   const numerator=v.hh_base_hit+v.three_eight_hh+v.hh_extra_base_hit+v.pumps,denominator=v.ab-v.punchies-v.sac_bunt;
   if(denominator<0||numerator>Math.max(0,denominator))add("hh","Hard-hit counts exceed the sheet’s HH opportunities. Review the overlapping categories and denominator.");
  }
 }else{for(const [i,message]of countIssues({},{...v,bb:v.bb_outcome}).entries())add(`pitch-${i}`,message);}
 }
 for(const log of logs){const b=Object.keys(log.batting).length>0,p=Object.keys(log.pitching).length>0;
 const missing=[...(b?["pa","ab","h","bb","hbp","sf","doubles","triples","hr"].filter(k=>log.batting[k]===undefined).map(k=>({sf:"Sac Fly",h:"Hits"}[k]??k.toUpperCase())):[]),...(p?["pitches","strikes"].filter(k=>log.pitching[k]===undefined):[])];
 if(missing.length)issues.push({id:`${log.id}:missing`,athleteId:log.athleteId,source:`Game Log · ${log.playedOn} · ${log.opponent}`,message:`Some rates cannot be calculated yet. Missing: ${missing.join(", ")}.`,href:`/game-stats/log?edit=${log.id}`,action:"Complete Game Entry"});
 }
 return issues;
}
export function obpReadyCount(stats:readonly SharedGameStat[]):number{return new Set(stats.map(r=>r.athlete_id)).size?[...new Set(stats.map(r=>r.athlete_id))].filter(id=>battingRates(stats.filter(r=>r.athlete_id===id)).some(r=>r.metric==="batting_obp")).length:0;}
