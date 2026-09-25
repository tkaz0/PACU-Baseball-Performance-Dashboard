import type { PlayerPerformance, PlayerMetricCard } from "@/lib/player-performance";
import { getSessionPerformance } from "@/lib/player-profile-layout";
import { formatMetricNumber } from "@/lib/measurement-display";
import { StatInfo } from "@/components/stat-info";

const metrics=[{key:"avg_bat_speed",label:"Average Bat Speed"},{key:"avg_exit_velocity",label:"Average Exit Velocity"}] as const;
const labelDate=(value:string)=>new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"});
function fullSwingCard(cards:PlayerMetricCard[],key:string){
  return cards.filter(card=>card.metric.key===key&&card.latest?.source.startsWith("Full Swing ·")&&card.latest?.unit==="mph")
    .sort((a,b)=>b.latest!.measuredAt.localeCompare(a.latest!.measuredAt)||a.latest!.source.localeCompare(b.latest!.source))[0];
}
function Result({card,context}:{card:PlayerMetricCard|undefined;context:string}){
  const reading=card?.latest;
  return <div className="min-w-0 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3"><p className="m-0 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{context}</p>{reading?<><p className="mb-0 mt-2 text-xl font-extrabold tabular-nums">{formatMetricNumber(reading.value,card!.metric.key,reading.source,reading.value.toFixed(1))} <span className="text-xs font-medium">mph</span></p><p className="mb-0 mt-1 text-[11px] text-[var(--text-secondary)]">{reading.source} · {labelDate(reading.measuredAt)}</p></>:<p className="mb-0 mt-3 text-xs text-[var(--text-secondary)]">Waiting for a saved session</p>}</div>;
}
export function PracticeGameBridge({performance}:{performance:PlayerPerformance}){
  const practice=getSessionPerformance(performance,"practice").hitting;
  const game=getSessionPerformance(performance,"in_game").hitting;
  const rows=metrics.map(metric=>({ ...metric,practice:fullSwingCard(practice,metric.key),game:fullSwingCard(game,metric.key) }));
  if(!rows.some(row=>row.practice||row.game))return null;
  return <section aria-label="Practice and in-game hitting" className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-4 sm:p-5">
    <div><p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--accent-readable)]">Hitting Context</p><h2 className="m-0 text-lg font-bold">Practice vs. In-Game</h2><p className="mb-0 mt-1 text-xs text-[var(--text-secondary)]">Latest Full Swing session averages, kept separate by setting. Blast practice reports stay in the Practice tab.</p></div>
    <div className="mt-4 grid gap-3">{rows.map(row=><div key={row.key} className="rounded-xl border border-[var(--line-subtle)] p-3"><h3 className="mb-3 mt-0 text-sm font-bold">{row.label}<StatInfo metric={row.key} label={row.label}/></h3><div className="grid gap-2 sm:grid-cols-2"><Result card={row.practice} context="Practice"/><Result card={row.game} context="In-Game"/></div></div>)}</div>
    <p className="mb-0 mt-3 text-[11px] text-[var(--text-secondary)]">These are session summaries. Swing counts were not saved with these measurements, so no Fall-wide average or difference is inferred.</p>
  </section>;
}
