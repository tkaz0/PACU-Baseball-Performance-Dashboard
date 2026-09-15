import type { SharedGameStat } from "@/lib/game-server";
import type { GameComparison } from "@/lib/game-metrics";
import { pitchingRates,formatInnings } from "@/lib/pitching-stats";
import { StatInfo } from "@/components/stat-info";
import { GamePercentile } from "@/components/game-percentile";
export function PitchingRates({rows,comparisons=[]}:{rows:SharedGameStat[];comparisons?:GameComparison[]}){
 return <dl className="grid grid-cols-3 gap-3">{pitchingRates(rows).map(r=><div key={r.metric} className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3 sm:p-4"><dt className="text-xs font-semibold">{r.label}<StatInfo metric={r.metric} label={r.label}/></dt><dd className="mt-2 text-2xl font-bold tabular-nums">{r.value===null?"—":r.value.toFixed(2)}</dd><p className="muted mb-0 mt-2 text-xs">{r.value!==null&&r.outs!==null?`${formatInnings(r.outs)} IP`:"Recorded innings needed"}</p>{r.value!==null&&<GamePercentile label={r.label} comparison={comparisons.find(c=>c.source==="pitching_fall_2026"&&c.metric===r.metric&&c.eventId===rows[0]?.event_id&&c.snapshotId===rows[0]?.snapshot_id&&Math.abs(c.value-r.value!)<1e-10)}/>}</div>)}</dl>;
}
