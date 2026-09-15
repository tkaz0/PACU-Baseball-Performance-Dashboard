import { pitchingContactRates } from "@/lib/pitching-stats";
import type { SharedGameStat } from "@/lib/game-server";
import type { GameComparison } from "@/lib/game-metrics";
import { StatInfo } from "@/components/stat-info";
import { GamePercentile } from "@/components/game-percentile";
export function PitchingContact({rows,comparisons=[]}:{rows:SharedGameStat[];comparisons?:GameComparison[]}){
 const rates=pitchingContactRates(rows),weak=rates[0],hard=rates[1];
 return <section aria-label="Contact quality" className="rounded-xl border border-[var(--line-subtle)] p-4"><h4 className="m-0 text-sm font-semibold">Contact Quality</h4><dl className="mb-3 grid grid-cols-2 gap-4">{rates.map(r=><div key={r.metric}><dt className="text-xs text-[var(--text-secondary)]">{r.label}<StatInfo metric={r.metric} label={r.label}/></dt><dd className="m-0 mt-1 text-2xl font-bold tabular-nums">{r.value===null?"—":`${r.value.toFixed(1)}%`}</dd>{r.value!==null&&<GamePercentile label={r.label} comparison={comparisons.find(c=>c.source==="pitching_fall_2026"&&c.metric===r.metric&&c.eventId===rows[0]?.event_id&&c.snapshotId===rows[0]?.snapshot_id&&Math.abs(c.value-r.value!)<1e-10)}/>}</div>)}</dl>{weak.value!==null&&hard.value!==null&&<div className="flex h-2 overflow-hidden rounded-full" aria-hidden="true"><span className="bg-blue-500" style={{width:`${weak.value}%`}}/><span className="bg-red-500" style={{width:`${hard.value}%`}}/></div>}<p className="muted mb-0 mt-2 text-xs">{weak.value!==null?`${weak.count} weak · ${hard.count} hard · ${weak.contacts} classified contacts (Wk + Hrd)`:(weak.contacts===0?"No classified contacts recorded.":"Both Wk and Hrd counts are needed.")}</p></section>;
}
