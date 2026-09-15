import type { SharedGameStat } from "@/lib/game-server";
import { pitchingWeek, validPitchingPeriod } from "@/lib/game-source";
export const PITCHING_CUMULATIVE = "fall-2026-cumulative";
/** Read-only display projection. Never import these rows or sum successive source snapshots. */
export function cumulativePitching(stats:readonly SharedGameStat[]):SharedGameStat[]{
 const rows=stats.filter(r=>r.source==="pitching_fall_2026");
 if(!rows.length||new Set(rows.map(r=>r.snapshot_id)).size!==1||new Set(rows.map(r=>r.athlete_id)).size!==1)return [];
 const periods=new Map<string,SharedGameStat[]>();
 for(const row of rows){
  if(!validPitchingPeriod(row.event_id,row.played_on)||!Number.isFinite(row.value)||row.value<0)return [];
  const group=periods.get(row.event_id!)??[];if(group.some(r=>r.metric===row.metric)||group.some(r=>r.played_on!==row.played_on))return [];
  group.push(row);periods.set(row.event_id!,group);
 }
 // Weekly totals can overlap dated games. Without a reviewed partition, never add the two series together.
 const weekly=rows.some(r=>pitchingWeek(r.event_id)!==null);
 if(weekly&&rows.some(r=>pitchingWeek(r.event_id)===null))return [];
 const result:SharedGameStat[]=[],fetched=rows.map(r=>r.fetched_at).sort().at(-1)!;
 for(const metric of new Set(rows.filter(r=>r.unit==="count").map(r=>r.metric))){
  const parts=[...periods.values()].map(group=>group.find(r=>r.metric===metric));
  if(parts.some(r=>!r||r.unit!=="count"||!Number.isSafeInteger(r.value)))continue;
  const value=parts.reduce((n,r)=>n+r!.value,0);if(!Number.isSafeInteger(value))continue;
  result.push({...parts[0]!,value,event_id:PITCHING_CUMULATIVE,played_on:null,fetched_at:fetched});
 }
 const strikes=result.find(r=>r.metric==="strikes"),pitches=result.find(r=>r.metric==="pitches");
 if(strikes&&pitches&&pitches.value>0&&strikes.value<=pitches.value)result.push({...strikes,metric:"strike_pct",unit:"%",value:100*strikes.value/pitches.value});
 return result;
}
