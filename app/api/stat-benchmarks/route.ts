import { getAccess } from "@/lib/auth";
import { loadLeaderboard } from "@/lib/leaderboard-server";
import { LEADERBOARD_METRICS, type LeaderboardSelection } from "@/lib/leaderboards";
import { loadGameLeaderboards } from "@/lib/game-comparison-server";
import { GAME_LEADERBOARD_METRICS, PITCHING_LEADERBOARD_METRICS } from "@/lib/game-metrics";
import { pacificBenchmark } from "@/lib/stat-benchmarks";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  const {access}=await getAccess();
  if(!access||(!access.roles.some(r=>r==="admin"||r==="coach")&&!access.athleteId))return Response.json({error:"Access denied"},{status:403});
  const p=new URL(request.url).searchParams,metricKey=p.get("metric")??"",source=p.get("source")??"",unit=p.get("unit")??"",period=p.get("period")??"fall_2026";
  const game=source==="qpa_fall_2026"||source==="pitching_fall_2026",eventId=p.get("eventId")??"";
  if(game&&period!=="fall_2026")return Response.json({error:"Invalid comparison"},{status:400});
  if(!(game?(source==="qpa_fall_2026"?GAME_LEADERBOARD_METRICS:PITCHING_LEADERBOARD_METRICS).includes(metricKey as never):LEADERBOARD_METRICS.some(m=>m.key===metricKey&&m.units.includes(unit)))||source.length>100||!source||!['fall_2026','summer_2026'].includes(period))return Response.json({error:"Invalid comparison"},{status:400});
  try{
    const rows=game?(await loadGameLeaderboards(access)).filter(r=>r.source===source&&r.metric===metricKey&&r.unit===unit&&r.eventId===eventId):await loadLeaderboard(access,{metricKey,source:source.trim().toLowerCase().replace(/\s+/g," "),unit,period} as LeaderboardSelection);
    // No names, IDs, links, dates or individual values cross this endpoint.
    return Response.json({benchmark:pacificBenchmark(metricKey,rows.map(r=>r.value),{unit,period:period as LeaderboardSelection['period']})},{headers:{"Cache-Control":"private, no-store"}});
  }catch{return Response.json({error:"Comparison unavailable"},{status:503});}
}
