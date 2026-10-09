import { pitchingExtraRates } from "@/lib/advanced-game-stats";
import type { SharedGameStat } from "@/lib/game-server";
import type { GameComparison } from "@/lib/game-metrics";
import { pitchingRates,formatInnings } from "@/lib/pitching-stats";
import { StatInfo } from "@/components/stat-info";
export function PitchingRates({rows}:{rows:SharedGameStat[];comparisons?:GameComparison[]}){
 return <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[...pitchingExtraRates(rows).map(r=>({...r,outs:rows.find(x=>x.metric==="innings_outs")?.value??null})),...pitchingRates(rows)].map(r=><div key={r.metric} className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3 sm:p-4"><dt className="text-xs font-semibold">{r.label}<StatInfo metric={r.metric} label={r.label} value={r.value} unit={r.unit} source="pitching_fall_2026" period="fall_2026" eventId={rows[0]?.event_id??undefined}/></dt><dd className="mt-2 text-2xl font-bold tabular-nums">{r.value===null?"—":r.value.toFixed(2)}</dd><p className="muted mb-0 mt-2 text-xs">{r.value!==null&&r.metric==="pitching_k_bb"?`${rows.find(x=>x.metric==="k")?.value??0} K · ${rows.find(x=>x.metric==="bb_outcome")?.value??0} BB`:r.value!==null&&r.outs!==null?`${formatInnings(r.outs)} IP`:"Recorded innings needed"}</p></div>)}</dl>;
}
