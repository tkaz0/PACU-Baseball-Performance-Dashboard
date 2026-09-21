import type { SharedGameStat } from "@/lib/game-server";
import { teamGameSummary } from "@/lib/team-game-stats";

export type HomeReading = { athleteId: string; source: string; date: string; importedAt: string };
export const HOME_AREAS = [
  {key:"physicality",label:"Physicality",detail:"RENPHO body composition"},
  {key:"testing",label:"Athletic Testing",detail:"Running, grip & field tests"},
  {key:"practice",label:"Practice",detail:"Blast & Full Swing practice"},
  {key:"in_game",label:"In-Game",detail:"Full Swing game sessions"},
] as const;
export type HomeArea = typeof HOME_AREAS[number]["key"];
function area(source:string):HomeArea {
  if(source==="RENPHO")return "physicality";
  if(/^Full Swing\s*·\s*(Game|Intrasquad)(?:\s*·|$)/i.test(source))return "in_game";
  if(/^(Blast Motion|Full Swing)(?:\s*·|$)/i.test(source))return "practice";
  return "testing";
}
const latest=(dates:string[])=>dates.sort().at(-1)??null;
/** Count distinct players, never measurement rows or repeated snapshots. Server supplies authorized scope. */
export function buildHomeSummary(playerIds:readonly string[],readings:readonly HomeReading[],games:readonly SharedGameStat[],today:string){
  const ids=new Set(playerIds),lastDay=today<"2026-12-31"?today:"2026-12-31";
  const fall=readings.filter(r=>ids.has(r.athleteId)&&r.date>="2026-09-01"&&r.date<=lastDay);
  const scopedGames=games.filter(r=>ids.has(r.athlete_id));
  const coverage=HOME_AREAS.map(a=>{const rows=fall.filter(r=>area(r.source)===a.key);return {...a,players:new Set(rows.map(r=>r.athleteId)).size,lastTested:latest(rows.map(r=>r.date)),updatedAt:latest(rows.map(r=>r.importedAt))};});
  const batting=teamGameSummary(scopedGames,"qpa_fall_2026"),pitching=teamGameSummary(scopedGames,"pitching_fall_2026");
  const updates=[...coverage.filter(a=>a.updatedAt).map(a=>({key:a.key,label:a.label,date:a.updatedAt!,kind:"Saved" as const})),
    ...(batting.updatedAt?[{key:"qpa",label:"Hitting Game Stats",date:batting.updatedAt,kind:"Synced" as const}]:[]),
    ...(pitching.updatedAt?[{key:"pitching",label:"Pitching Game Stats",date:pitching.updatedAt,kind:"Synced" as const}]:[])]
    .sort((a,b)=>b.date.localeCompare(a.date));
  return {players:ids.size,playersWithResults:new Set([...fall.map(r=>r.athleteId),...scopedGames.map(r=>r.athlete_id)]).size,coverage,updates,batting,pitching};
}
export type HomeSummary=ReturnType<typeof buildHomeSummary>;
