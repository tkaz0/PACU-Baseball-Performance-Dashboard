import type { Measurement } from "@/lib/imports/engine";
import { parseBlastSource } from "@/lib/blast-metrics";

export type TimelineSession = { key:string; date:string; start:string|null; label:string; category:"Physicality"|"Athletic Testing"|"Practice"|"In-Game"; measurements:number };
const validDate=(value:string)=>/^2026-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
/** Dates come from saved observations, never cumulative QPA or weekly pitching snapshots. */
export function sessionTimeline(readings:readonly Measurement[]):TimelineSession[] {
  const sessions=new Map<string,TimelineSession>();
  for(const row of readings){
    if(!validDate(row.measured_at))continue;
    const blast=parseBlastSource(row.source);
    const category:TimelineSession["category"]=row.source==="RENPHO"?"Physicality":/^Full Swing\s*·\s*(Game|Intrasquad)(?:\s*·|$)/i.test(row.source)?"In-Game":blast||/^Full Swing\s*·/.test(row.source)?"Practice":"Athletic Testing";
    const label=blast?`Blast ${blast.kind==="average"?"Weekly Average":"Weekly 95th Percentile"}`:row.source==="RENPHO"?"RENPHO Report":category==="Athletic Testing"?"Testing Results":row.source;
    const start=blast?.start??null;
    const key=JSON.stringify([row.measured_at,row.source,row.file_hash]);
    const prior=sessions.get(key);
    sessions.set(key,{key,date:row.measured_at,start,label,category,measurements:(prior?.measurements??0)+1});
  }
  return [...sessions.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.category.localeCompare(b.category)||a.label.localeCompare(b.label));
}
