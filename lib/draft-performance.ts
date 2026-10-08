import { topPerformers, TOP_PERFORMER_METRICS, type TopDiscipline } from "@/lib/top-performers";
import { gameValue } from "@/lib/game-metrics";
import { gameSampleText, isEarlyGameSample } from "@/lib/game-opportunities";
import type { CoachingPlayer, CoachingGame } from "@/lib/coaching-tools";
import type { DraftDocument } from "@/lib/draft-board";
export type DraftPerformance = { id:string; name:string; position:string; hitting:DraftPerformanceLine|null; pitching:DraftPerformanceLine|null };
export type DraftPerformanceLine = { score:number|null; rank:number|null; cohort:number; stats:{label:string;value:string;sample:string}[]; early:boolean; updatedAt:string };
export function draftPerformance(data:{players:CoachingPlayer[];games:CoachingGame[]}):DraftPerformance[]{
  const rows={hitting:topPerformers(data,"hitting"),pitching:topPerformers(data,"pitching")};
  return data.players.map(p=>{
    const line=(discipline:TopDiscipline):DraftPerformanceLine|null=>{
      const row=rows[discipline].find(r=>r.player.id===p.id); if(!row)return null;
      const games=TOP_PERFORMER_METRICS[discipline].flatMap(m=>row.stats[m.key]?[row.stats[m.key]!]:[]);
      return {score:row.score,rank:row.rank,cohort:row.cohortSize,stats:games.map(g=>({label:g.label,value:gameValue(g.value,g.unit),sample:gameSampleText(g.source,g.metric,g.opportunities)??""})),early:games.some(g=>isEarlyGameSample(g.source,g.metric,g.opportunities)),updatedAt:games.map(g=>g.updatedAt).sort().at(-1)!};
    };
    return {id:p.id,name:p.name,position:[p.position,p.secondaryPosition].filter(Boolean).join(" / "),hitting:line("hitting"),pitching:line("pitching")};
  });
}
/** Explicit saved profile links only. No name-based identity inference. */
export function performanceDraftOrder(doc:DraftDocument,profiles:DraftPerformance[],discipline:TopDiscipline):string[]{
  const current=doc.planning?.bigBoard??doc.players.filter(p=>p.group!=="Injured / Student Assistants").map(p=>p.id);
  return [...current].sort((a,b)=>{
    const score=(id:string)=>{const player=doc.players.find(p=>p.id===id);return profiles.find(p=>p.id===player?.athleteId)?.[discipline]?.score??null;};
    const sa=score(a),sb=score(b);return sa===null||sb===null?sa===sb?current.indexOf(a)-current.indexOf(b):sa===null?1:-1:sb-sa||current.indexOf(a)-current.indexOf(b);
  });
}

/** A draft starting order, not a new talent grade: use the best complete role score. */
export function draftSuggestedScore(player:DraftDocument["players"][number],profile:DraftPerformance|undefined):{score:number;role:"Hitting"|"Pitching"}|null{
  const choices:{score:number;role:"Hitting"|"Pitching"}[]=[];
  for(const [key,role] of [["hitting","Hitting"],["pitching","Pitching"]] as const){
    if(key==="hitting"&&player.group==="Pitchers"||key==="pitching"&&player.group!=="Pitchers"&&player.group!=="Two-Ways")continue;
    const score=profile?.[key]?.score;
    if(typeof score==="number"&&Number.isFinite(score)&&score>=0&&score<=100)choices.push({score,role});
  }
  return choices.sort((a,b)=>b.score-a.score)[0]??null;
}
export function suggestedDraftOrder(doc:DraftDocument,profiles:DraftPerformance[]):string[]{
  const current=doc.planning?.bigBoard??doc.players.filter(p=>p.group!=="Injured / Student Assistants").map(p=>p.id);
  const scores=new Map(current.map(id=>{const player=doc.players.find(p=>p.id===id)!;return [id,draftSuggestedScore(player,profiles.find(p=>p.id===player.athleteId))?.score??null];}));
  return [...current].sort((a,b)=>{const sa=scores.get(a)??null,sb=scores.get(b)??null;return sa===null||sb===null?sa===sb?current.indexOf(a)-current.indexOf(b):sa===null?1:-1:sb-sa||current.indexOf(a)-current.indexOf(b);});
}
