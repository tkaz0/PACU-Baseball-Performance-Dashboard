import type { CoachingData } from "@/lib/coaching-tools";
import { coachingReadingVisible } from "@/lib/coaching-tools";
import { parseBlastSource } from "@/lib/blast-metrics";

const day=(iso:string)=>{
  const pieces=new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(iso));
  const get=(type:string)=>pieces.find(part=>part.type===type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};
const back=(today:string,days:number)=>new Date(Date.parse(`${today}T12:00:00Z`)-days*86400000).toISOString().slice(0,10);
const partition=(row:CoachingData["readings"][number])=>{
  const blast=parseBlastSource(row.source);
  return JSON.stringify([row.athleteId,row.metric,row.unit,blast ? `Blast Motion · ${blast.kind}` : row.source]);
};
export type CoachChange={playerId:string;playerName:string;metric:string;label:string;unit:string;source:string;date:string;value:number;previous:number;percent:number};
export function coachUpdateDigest(data:CoachingData,today:string){
  const since=back(today,7),staleBefore=back(today,21);
  const players=new Map(data.players.map(player=>[player.id,player]));
  const recent=data.readings.filter(row=>coachingReadingVisible(row)&&row.date>="2026-09-01"&&row.date<=today&&day(row.importedAt)>=since&&day(row.importedAt)<=today);
  const byPlayer=new Map<string,{id:string;name:string;readings:number;lastDate:string;areas:Set<string>}>();
  for(const row of recent){const player=players.get(row.athleteId);if(!player)continue;const item=byPlayer.get(player.id)??{id:player.id,name:player.name,readings:0,lastDate:row.date,areas:new Set<string>()};item.readings++;if(row.date>item.lastDate)item.lastDate=row.date;item.areas.add(row.source.startsWith("RENPHO")?"Physicality":row.source.startsWith("Blast")?"Blast Practice":row.source.startsWith("Full Swing")?"Full Swing":"Testing");byPlayer.set(player.id,item);}
  const fall=data.readings.filter(row=>coachingReadingVisible(row)&&row.date>="2026-09-01"&&row.date<=today);
  const groups=new Map<string,typeof fall>();for(const row of fall){const key=partition(row);groups.set(key,[...(groups.get(key)??[]),row]);}
  const changes:CoachChange[]=[];
  for(const rows of groups.values()){
    const dates=[...new Set(rows.map(row=>row.date))].sort().reverse();if(dates.length<2)continue;
    const latest=rows.filter(row=>row.date===dates[0]),previous=rows.filter(row=>row.date===dates[1]);
    if(new Set(latest.map(row=>row.value)).size!==1||new Set(previous.map(row=>row.value)).size!==1||!latest.some(row=>day(row.importedAt)>=since&&day(row.importedAt)<=today))continue;
    const current=latest[0],prior=previous[0],player=players.get(current.athleteId);
    const currentBlast=parseBlastSource(current.source),priorBlast=parseBlastSource(prior.source);
    if(!player||prior.value===0||currentBlast&&priorBlast&&currentBlast.start<=priorBlast.end)continue;
    const percent=100*(current.value-prior.value)/Math.abs(prior.value);
    // Informational display threshold, never a health/performance classification.
    if(Math.abs(percent)<5)continue;
    changes.push({playerId:player.id,playerName:player.name,metric:current.metric,label:current.label,unit:current.unit,source:current.source,date:current.date,value:current.value,previous:prior.value,percent});
  }
  const latest=new Map<string,string>();for(const row of fall)if(row.date>(latest.get(row.athleteId)??""))latest.set(row.athleteId,row.date);
  const stale=data.players.filter(player=>(latest.get(player.id)??"")<staleBefore).map(player=>({id:player.id,name:player.name,lastDate:latest.get(player.id)??null})).sort((a,b)=>(a.lastDate??"").localeCompare(b.lastDate??"")||a.name.localeCompare(b.name));
  const games=["qpa_fall_2026","pitching_fall_2026"].map(source=>{
    const rows=data.games.filter(row=>row.source===source);
    return {source,players:new Set(rows.map(row=>row.athleteId)).size,lastSynced:rows.map(row=>row.updatedAt).sort().at(-1)??null};
  });
  return {since,today,staleBefore,recentReadings:recent.length,updatedPlayers:[...byPlayer.values()].map(item=>({...item,areas:[...item.areas].sort()})).sort((a,b)=>b.lastDate.localeCompare(a.lastDate)||a.name.localeCompare(b.name)),changes:changes.sort((a,b)=>Math.abs(b.percent)-Math.abs(a.percent)||a.playerName.localeCompare(b.playerName)),stale,games};
}
