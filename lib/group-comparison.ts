import { coachingEligible, coachingVariables, comparableTests, daysBetween, playerGameSources, type CoachingData, type CoachingPlayer, type CoachingCategory } from "@/lib/coaching-tools";
import { PLAYER_METRICS } from "@/lib/player-performance";
import { arsenalComparisonFields, arsenalComparisonValue } from "@/lib/player-comparison-arsenal";
import { classifiedPitchSource } from "@/lib/imports/classified-pitch-results";
import { pitchTypeLabel } from "@/lib/imports/pitch-assignments";
import { pitchSourceLabel } from "@/lib/pitch-display";
import { gameOpportunityLabel } from "@/lib/game-opportunities";
import { formatInnings } from "@/lib/pitching-stats";
import { PITCHING_CUMULATIVE } from "@/lib/pitching-cumulative";
import { leaderboardTestDate } from "@/lib/leaderboards";

export type GroupPreset={id:string;label:string;playerIds:string[]};
export type GroupComparisonCell={value:number|null;eligible:boolean;review:boolean;context:string;sample:string};
export type GroupComparisonColumn={key:string;label:string;metric:string;unit:string;direction:"higher"|"lower"|"neutral";comparable:boolean};
export type GroupComparisonGroup={id:string;label:string;source:string;unit:string;kind:"testing"|"arsenal"|"game";columns:GroupComparisonColumn[];rows:{playerId:string;cells:Record<string,GroupComparisonCell>}[]};
const positions=(p:CoachingPlayer)=>[p.position,p.secondaryPosition??""].map(value=>value.trim().toUpperCase());
export function groupPresets(players:CoachingPlayer[]):GroupPreset[]{
 const preset=(id:string,label:string,matches:(p:CoachingPlayer)=>boolean):GroupPreset=>({id,label,playerIds:[...new Set(players.filter(matches).map(p=>p.id))]});
 const groups=[preset("all","All Players",()=>true),preset("hitters","All Hitters",p=>playerGameSources(p).includes("qpa_fall_2026")),preset("pitchers","All Pitchers",p=>playerGameSources(p).includes("pitching_fall_2026")),preset("two-way","Two-Way Players",p=>p.playerType.trim().toLowerCase()==="two_way"),preset("catchers","Catchers",p=>positions(p).includes("C")),preset("infield","Infielders",p=>positions(p).some(position=>["IF","INF","1B","2B","3B","SS"].includes(position))),preset("outfield","Outfielders",p=>positions(p).some(position=>["OF","LF","CF","RF"].includes(position)))];
 const labels:Record<string,string>={"1B":"First Base","2B":"Second Base","3B":"Third Base",SS:"Shortstop",LF:"Left Field",CF:"Center Field",RF:"Right Field"};
 for(const [position,label] of Object.entries(labels))groups.push(preset(`position-${position.toLowerCase()}`,label,p=>positions(p).includes(position)));
 return groups.filter(group=>group.playerIds.length>0);
}
const empty=(eligible:boolean,review=false):GroupComparisonCell=>({value:null,eligible,review,context:"",sample:""});
function comparableDates(dates:string[],maxGap:number){return dates.length>=2&&daysBetween([...dates].sort()[0],[...dates].sort().at(-1)!)<=maxGap;}
function makeGroup(id:string,label:string,source:string,kind:GroupComparisonGroup["kind"],players:CoachingPlayer[]):GroupComparisonGroup{return {id,label,source,unit:"",kind,columns:[],rows:players.map(player=>({playerId:player.id,cells:{}}))};}
function sample(source:string,metric:string,count:number|null|undefined):string{
 const label=gameOpportunityLabel(source,metric);
 if(!label||count==null||!Number.isSafeInteger(count)||count<=0)return "";
 const early=(source==="qpa_fall_2026"&&label==="PA"&&count<20)||(label==="pitches"&&count<50);
 return `${label==="outs"?`${formatInnings(count)} IP`:`${count.toLocaleString("en-US")} ${label}`}${early?" · Early sample":""}`;
}
const gameOrder=["batting_production_plus","batting_avg","batting_obp","batting_est_slg","batting_est_iso","batting_hh_pct","batting_est_wobacon","batting_bb_pct","batting_k_pct","qpa_pct","pumps","sb","batting_sb_per_pa","gdp","pitching_r9","pitching_k9","pitching_bb9","pitching_whip","strike_pct","pitching_k_bb","weak_contact_pct","hard_contact_pct"];
/** Read-only comparison of the already authorized staff projection; no raw source or identity writes. */
export function buildGroupComparison(data:CoachingData,selectedIds:string[],category:CoachingCategory|"Game Stats",today:string,maxGap=30,gameSource:"qpa"|"pitching"="qpa"){
 const ids=new Set(selectedIds),players=[...new Map(data.players.filter(p=>ids.has(p.id)).map(p=>[p.id,p])).values()];
 const gameSources=(["qpa","pitching"] as const).filter(source=>players.some(p=>playerGameSources(p).includes(source==="qpa"?"qpa_fall_2026":"pitching_fall_2026")));
 const groups:GroupComparisonGroup[]=[];
 if(category==="Game Stats"){
  const source=gameSource==="qpa"?"qpa_fall_2026":"pitching_fall_2026",event=gameSource==="qpa"?"":PITCHING_CUMULATIVE;
  const group=makeGroup(source,gameSource==="qpa"?"Hitting · Fall to Date":"Pitching · Fall to Date",source,"game",players);
  const readings=data.games.filter(r=>ids.has(r.athleteId)&&r.source===source&&r.eventId===event&&Number.isFinite(r.value));
  const keys=[...new Set(readings.map(r=>JSON.stringify([r.metric,r.unit])))].sort((a,b)=>{const ma=JSON.parse(a)[0],mb=JSON.parse(b)[0];return (gameOrder.includes(ma)?gameOrder.indexOf(ma):999)-(gameOrder.includes(mb)?gameOrder.indexOf(mb):999)||a.localeCompare(b);});
  for(const key of keys){
   const [metric,unit]=JSON.parse(key) as [string,string],definition=readings.find(r=>r.metric===metric&&r.unit===unit)!;
   const snapshots:string[]=[];let review=false;
   for(const row of group.rows){const player=players.find(p=>p.id===row.playerId)!,eligible=playerGameSources(player).includes(source),matches=eligible?readings.filter(r=>r.athleteId===player.id&&r.metric===metric&&r.unit===unit):[];
    const value=matches.length===1?matches[0]:null;review ||= matches.length>1;
    row.cells[key]=value?{value:value.value,eligible,review:false,context:`Updated ${leaderboardTestDate(value.updatedAt.slice(0,10))}`,sample:sample(source,metric,value.opportunities)}:empty(eligible,matches.length>1);
    if(value)snapshots.push(value.snapshotId);
   }
   group.columns.push({key,label:definition.label,metric,unit,direction:unit==="count"?"neutral":definition.direction,comparable:!review&&snapshots.length>=2&&new Set(snapshots).size===1});
  }
  if(group.columns.length)groups.push(group);
 }else{
  // Variables retain their exact source and unit keys; dates never broaden the source partition.
  const selectedData={...data,readings:data.readings.filter(r=>ids.has(r.athleteId))};
  for(const variable of coachingVariables(selectedData,category,today)){
   let group=groups.find(g=>g.kind==="testing"&&g.source===variable.source);
   if(!group){group=makeGroup(`test:${variable.source}`,pitchSourceLabel(variable.source),variable.source,"testing",players);groups.push(group);}
   const dates:string[]=[];let hasValue=false,review=false;
   for(const row of group.rows){const player=players.find(p=>p.id===row.playerId)!,eligible=coachingEligible(player,variable.metric),result=eligible?comparableTests(selectedData,player.id,variable.key,today):null;
    const latest=result?.latest;const conflict=!!result?.conflict&&!latest;review ||= conflict;
    row.cells[variable.key]=latest?{value:latest.value,eligible,review:false,context:`Tested ${leaderboardTestDate(latest.date)}`,sample:""}:empty(eligible,conflict);
    if(latest){dates.push(latest.date);hasValue=true;}
   }
   if(hasValue||review)group.columns.push({...variable,direction:PLAYER_METRICS.find(m=>m.key===variable.metric)?.direction??"neutral",comparable:!review&&comparableDates(dates,maxGap)});
  }
  if(category==="Throwing"){
   const own=(p:CoachingPlayer)=>{const entries=data.arsenals?.filter(a=>a.athleteId===p.id)??[];return coachingEligible(p,"max_pitch_velocity")&&entries.length===1?entries[0].pitches.filter(pitch=>{const parsed=classifiedPitchSource(pitch.source);return parsed&&parsed.pitchType===pitch.pitchType&&parsed.category===pitch.category;}):[];};
   for(const source of new Set(players.flatMap(p=>own(p).map(pitch=>pitch.source)))){
    const parsed=classifiedPitchSource(source)!;
    const group=makeGroup(`arsenal:${source}`,`${pitchTypeLabel(parsed.pitchType)} · ${parsed.category==="Practice"?"Practice":`In-Game (${parsed.category})`}`,source,"arsenal",players);
    for(const field of arsenalComparisonFields){
     const results=[];let review=false;
     for(const row of group.rows){const player=players.find(p=>p.id===row.playerId)!,eligible=coachingEligible(player,"max_pitch_velocity"),matches=own(player).filter(p=>p.source===source),result=arsenalComparisonValue(matches.length===1?matches[0]:null,field,today);
      review ||= matches.length>1;
      row.cells[field.key]=result?{value:result.value,eligible,review:false,context:`${result.basis} · ${leaderboardTestDate(result.firstDate)}${result.lastDate!==result.firstDate?` – ${leaderboardTestDate(result.lastDate)}`:""}`,sample:result.count!==null?`${result.count} ${field.family} readings`:"Reading count unavailable"}:empty(eligible,matches.length>1);
      if(result)results.push(result);
     }
     if(results.length||review)group.columns.push({key:field.key,label:field.label,metric:field.key,unit:field.unit,direction:field.unit==="rpm"?"neutral":"higher",comparable:!review&&results.length>=2&&new Set(results.map(r=>r.basis)).size===1&&(results[0].basis!=="Latest session"||comparableDates(results.map(r=>r.lastDate),maxGap))});
    }
    if(group.columns.length)groups.push(group);
   }
   // Hide redundant overall velocity only where every displayed result has a classified counterpart.
   for(const group of groups.filter(g=>g.kind==="testing"))group.columns=group.columns.filter(column=>{
    const broad=/^Full Swing · (Game|Intrasquad|Practice)$/.exec(group.source);const metric=column.metric==="avg_pitch_velocity"?"classified_avg_velocity":column.metric==="max_pitch_velocity"?"classified_max_velocity":null;
    if(!broad||!metric)return true;
    const cells=group.rows.filter(row=>row.cells[column.key]?.value!==null||row.cells[column.key]?.review);
    return !cells.length||!cells.every(row=>!row.cells[column.key].review&&groups.some(g=>g.kind==="arsenal"&&classifiedPitchSource(g.source)?.category===broad[1]&&g.rows.find(r=>r.playerId===row.playerId)?.cells[metric]?.value!=null));
   });
  }
 }
 return {players,gameSources,groups:groups.filter(group=>group.columns.length>0).sort((a,b)=>a.kind==="arsenal"&&b.kind!=="arsenal"?-1:b.kind==="arsenal"&&a.kind!=="arsenal"?1:0)};
}
