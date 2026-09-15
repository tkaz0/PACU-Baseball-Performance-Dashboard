import type { SharedGameStat } from "@/lib/game-server";
export const PITCH_FAMILIES = [
  { key: "fb", strikes: "fb_k", label: "Fastball", color: "#ef4444" },
  { key: "bb_pitch_family", strikes: "bb_pitch_family_k", label: "Breaking Ball", color: "#3b82f6" },
  { key: "ch", strikes: "ch_k", label: "Changeup", color: "#f59e0b" },
] as const;
export type PitchSplit = { key:string; label:string; color:string; pitches:number|null; strikes:number|null; usage:number|null; strikePct:number|null };
/** One source snapshot, one player and one period. Missing families never become zero. */
export function pitchSplits(rows:readonly SharedGameStat[]):PitchSplit[] {
 const selected=rows.filter(r=>r.source==="pitching_fall_2026");
 const valid=selected.length>0&&["athlete_id","event_id","snapshot_id"] .every(k=>new Set(selected.map(r=>r[k as keyof SharedGameStat])).size===1);
 const values=new Map<string,number>();let countsValid=valid;
 for(const row of selected){if(values.has(row.metric)||!Number.isFinite(row.value)||row.value<0)countsValid=false;values.set(row.metric,row.value);}
 const count=(key:string)=>countsValid&&Number.isSafeInteger(values.get(key))?values.get(key)!:null;
 const total=count("pitches"),familySum=PITCH_FAMILIES.reduce((n,f)=>n+(count(f.key)??0),0);
 return PITCH_FAMILIES.map(f=>{const pitches=count(f.key),strikes=count(f.strikes);return {...f,pitches,strikes,
  usage:total!==null&&total>0&&pitches!==null&&familySum<=total?100*pitches/total:null,
  strikePct:pitches!==null&&pitches>0&&strikes!==null&&strikes<=pitches?100*strikes/pitches:null};});
}

/** Outs are stored as integers; baseball .1/.2 notation is only a display convention. */
export function formatInnings(outs:number):string{return `${Math.floor(outs/3)}.${outs%3}`;}
export type PitchingRate={metric:string;label:string;value:number|null;unit:"per9";outs:number|null};
export function pitchingRates(rows:readonly SharedGameStat[]):PitchingRate[]{
 const selected=rows.filter(r=>r.source==="pitching_fall_2026");
 const valid=selected.length>0&&["athlete_id","event_id","snapshot_id"].every(k=>new Set(selected.map(r=>r[k as keyof SharedGameStat])).size===1)&&new Set(selected.map(r=>r.metric)).size===selected.length;
 const get=(metric:string)=>{const r=selected.find(r=>r.metric===metric);return valid&&r&&Number.isSafeInteger(r.value)&&r.value>=0?r.value:null;};
 const outs=get("innings_outs");
 return [["pitching_k9","K/9","k"],["pitching_bb9","BB/9","bb_outcome"],["pitching_r9","Runs/9","r"]].map(([metric,label,key])=>{const n=get(key);return {metric,label,value:n!==null&&outs!==null&&outs>0?27*n/outs:null,unit:"per9" as const,outs};});
}

export type PitchingContactRate={metric:string;label:string;value:number|null;unit:"%";contacts:number|null;count:number|null};
/** Owner-defined denominator: only contacts classified Wk or Hrd in the same player/period/snapshot. */
export function pitchingContactRates(rows:readonly SharedGameStat[]):PitchingContactRate[]{
 const selected=rows.filter(r=>r.source==="pitching_fall_2026");
 const valid=selected.length>0&&["athlete_id","event_id","snapshot_id"].every(k=>new Set(selected.map(r=>r[k as keyof SharedGameStat])).size===1)&&new Set(selected.map(r=>r.metric)).size===selected.length;
 const get=(metric:string)=>{const r=selected.find(r=>r.metric===metric);return valid&&r&&Number.isSafeInteger(r.value)&&r.value>=0?r.value:null;};
 const weak=get("weak_contact"),hard=get("hard_contact"),contacts=weak!==null&&hard!==null?weak+hard:null;
 return [["weak_contact_pct","Weak Contact %",weak],["hard_contact_pct","Hard Contact %",hard]].map(([metric,label,count])=>({metric:metric as string,label:label as string,count:count as number|null,contacts,value:contacts!==null&&contacts>0?100*(count as number)/contacts:null,unit:"%"}));
}
