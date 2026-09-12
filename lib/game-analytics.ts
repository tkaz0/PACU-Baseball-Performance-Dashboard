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
  for(const rate of battingRates(rows).filter(rate=>rate.metric!=="batting_obp"))result.push({...base,id:JSON.stringify([first.snapshot_id,athleteId,rate.metric]),metric:rate.metric,label:`Game ${rate.label}`,unit:rate.unit,value:rate.value});
 }
 return result;
}
