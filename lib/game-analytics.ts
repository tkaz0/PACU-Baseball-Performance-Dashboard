import { pitchingRates, pitchingContactRates, pitchSplits } from "@/lib/pitching-stats";
import { validPitchingPeriod, pitchingPeriodLabel } from "@/lib/game-source";
import type { SharedGameStat } from "@/lib/game-server";
import type { AnalyticsReading } from "@/lib/analytics";
import { battingRates } from "@/lib/batting-stats";
const metrics:Record<string,string>={pumps:"Game HR",sb:"Game SB",gdp:"Game GDP",qpa_pct:"Game QPA %"};
const pacificDate=(stamp:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(stamp));
/** QPA is cumulative Fall data dated by capture, never an invented dated game. */
export function qpaAnalytics(stats:readonly SharedGameStat[]):AnalyticsReading[]{
 const groups=new Map<string,SharedGameStat[]>();
 for(const row of stats.filter(r=>r.source==="qpa_fall_2026")){const group=groups.get(row.athlete_id)??[];group.push(row);groups.set(row.athlete_id,group);}
 const result:AnalyticsReading[]=[];
 for(const [athleteId,rows] of groups){if(new Set(rows.map(r=>r.snapshot_id)).size!==1)continue;
  const first=rows[0],base={athleteId,date:pacificDate(first.fetched_at),importedAt:first.fetched_at,source:"QPA · Fall cumulative (snapshot date)"};
  for(const row of rows)if(metrics[row.metric])result.push({...base,id:JSON.stringify([row.snapshot_id,athleteId,row.metric]),metric:`qpa_game_${row.metric}`,label:metrics[row.metric],unit:row.unit,value:row.value});
  for(const rate of battingRates(rows).filter(rate=>["batting_avg","batting_bb_pct","batting_k_pct","batting_hh_pct"].includes(rate.metric)))result.push({...base,id:JSON.stringify([first.snapshot_id,athleteId,rate.metric]),metric:rate.metric,label:`Game ${rate.label}`,unit:rate.unit,value:rate.value});
 }
 return result;
}

/** Each pitching period stays a separate variable source. Weekly totals use the disclosed snapshot date. */
export function pitchingAnalytics(stats:readonly SharedGameStat[]):AnalyticsReading[]{
 const groups=new Map<string,SharedGameStat[]>();
 for(const row of stats.filter(r=>r.source==="pitching_fall_2026")){
  const key=JSON.stringify([row.athlete_id,row.event_id]),group=groups.get(key)??[];group.push(row);groups.set(key,group);
 }
 const result:AnalyticsReading[]=[];
 for(const rows of groups.values()){
  if(new Set(rows.map(r=>r.snapshot_id)).size!==1||new Set(rows.map(r=>r.metric)).size!==rows.length||new Set(rows.map(r=>r.played_on)).size!==1||rows.some(r=>!Number.isFinite(r.value)||r.value<0))continue;
  const first=rows[0];if(!validPitchingPeriod(first.event_id,first.played_on))continue;
  const base={athleteId:first.athlete_id,date:first.played_on??pacificDate(first.fetched_at),importedAt:first.fetched_at,source:`Pitching · ${pitchingPeriodLabel(first.event_id,first.played_on)}${first.played_on?` · ${first.event_id}`:" (snapshot date)"}`};
  const add=(metric:string,label:string,unit:string,value:number)=>result.push({...base,id:JSON.stringify([first.snapshot_id,first.athlete_id,first.event_id,metric]),metric,label:`Pitching ${label}`,unit,value});
  for(const row of rows)if(["strike_pct","k","bb_outcome","r","h","pitches"].includes(row.metric))add(row.metric,({strike_pct:"Strike %",k:"Strikeouts",bb_outcome:"Walks",r:"Runs Allowed",h:"Hits Allowed",pitches:"Pitches"}[row.metric]!),row.unit,row.value);
  for(const r of [...pitchingRates(rows),...pitchingContactRates(rows)])if(r.value!==null)add(r.metric,r.label,r.unit,r.value);
  for(const split of pitchSplits(rows)){
   if(split.usage!==null)add(`${split.key}_usage_pct`,`${split.label} Usage %`,"%",split.usage);
   if(split.strikePct!==null)add(`${split.key}_strike_pct`,`${split.label} Strike %`,"%",split.strikePct);
  }
 }
 return result;
}
