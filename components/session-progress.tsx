"use client";
import { useState } from "react";
import type { ProgressSeries } from "@/lib/session-progress";

const date = (value: string) => new Intl.DateTimeFormat("en-US", {month:"short",day:"numeric",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));
const number = (value:number,unit:string) => value.toLocaleString("en-US",{maximumFractionDigits:1,minimumFractionDigits:unit==="mph"?1:0});

function Sparkline({ series }: { series: ProgressSeries }) {
  const points=series.points, values=points.map(point=>point.value), min=Math.min(...values), max=Math.max(...values);
  const pad=Math.max((max-min)*.2,Math.abs(max)*.04,1), lo=min-pad, hi=max+pad;
  const x=(i:number)=>26+(points.length===1?.5:i/(points.length-1))*308;
  const y=(value:number)=>102-(value-lo)/(hi-lo)*76;
  return <svg viewBox="0 0 360 128" className="mt-3 w-full" role="img" aria-label={`${series.label}: ${points.length} recorded ${points.length===1?"session":"sessions"}`}>
    {[0,.5,1].map(fraction=><line key={fraction} x1="26" x2="334" y1={26+fraction*76} y2={26+fraction*76} stroke="var(--line-subtle)" strokeDasharray={fraction===1?undefined:"3 5"}/>) }
    {points.length>1&&<polyline points={points.map((point,i)=>`${x(i)},${y(point.value)}`).join(" ")} fill="none" stroke="var(--accent-readable)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>}
    {points.map((point,i)=><circle key={point.key} cx={x(i)} cy={y(point.value)} r="5.5" fill="var(--accent-readable)" stroke="var(--surface-panel)" strokeWidth="2"><title>{`${point.label} · ${date(point.date)} · ${number(point.value,series.unit)} ${series.unit} · n=${point.count ?? "—"}`}</title></circle>)}
  </svg>;
}
function ProgressGroup({ title, description, series }: {title:string;description:string;series:ProgressSeries[]}) {
  const [metric,setMetric]=useState(series[0]?.key??"");
  if(!series.length)return null;
  const current=series.find(item=>item.key===metric)??series[0];
  const latest=current.points.at(-1)!;
  return <section className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-4 sm:p-6" aria-label={title}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="m-0 text-lg font-bold">{title}</h3><p className="muted mb-0 mt-1 text-xs">{description}</p></div><span className="rounded-full border border-[var(--line-subtle)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-bold">{current.points.length} {current.points.length===1?"session":"sessions"}</span></div>
    <label className="mt-4 block max-w-sm text-xs font-bold">Measurement<select className="mt-1" value={current.key} onChange={event=>setMetric(event.target.value)}>{series.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
    <div className="mt-4 grid gap-4 rounded-xl bg-[var(--surface-raised)] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><div><p className="m-0 text-xs text-[var(--text-secondary)]">Latest recorded session</p><p className="m-0 mt-1 text-3xl font-black tabular-nums tracking-tight">{number(latest.value,current.unit)} <span className="text-base font-semibold text-[var(--text-secondary)]">{current.unit === "deg" ? "°" : current.unit.toUpperCase()}</span></p><p className="muted mb-0 mt-1 text-xs">{date(latest.date)} · {latest.count??"—"} {title.startsWith("Blast")?"swings":"recorded pitches"}</p></div><p className="m-0 text-xs font-semibold text-[var(--text-secondary)]">{current.points.length<2?"More sessions will show a trend.":"Measured sessions only · no projected trend"}</p></div>
    <Sparkline series={current}/>
    <div className="max-h-48 overflow-auto"><table className="w-full text-sm"><caption className="sr-only">Recorded sessions for {current.label}</caption><thead><tr><th>Date / Session</th><th>Value</th><th>Sample</th></tr></thead><tbody>{[...current.points].reverse().map(point=><tr key={point.key}><td><span className="font-semibold">{date(point.date)}</span><span className="ml-2 text-xs text-[var(--text-secondary)]">{point.label}</span></td><td className="tabular-nums">{number(point.value,current.unit)} {current.unit==="deg"?"°":current.unit}</td><td className="tabular-nums">{point.count??"—"}</td></tr>)}</tbody></table></div>
  </section>;
}
export function SessionProgress({ blast, pitchingGame, pitchingPractice }: {blast:ProgressSeries[];pitchingGame:ProgressSeries[];pitchingPractice:ProgressSeries[]}) {
  if(!blast.length&&!pitchingGame.length&&!pitchingPractice.length)return <p className="rounded-xl border border-dashed border-[var(--line-subtle)] p-6 text-sm text-[var(--text-secondary)]">Session progress will appear after reviewed practice or classified pitch results are saved.</p>;
  return <section className="space-y-5" aria-label="Session progress"><div><h2 className="m-0 text-xl font-bold">Session Progress</h2><p className="muted mb-0 mt-1 text-sm">Follow the same measurement across reviewed sessions. Practice and in-game results stay separate.</p></div>
    {blast.length>0&&<ProgressGroup title="Blast · Practice" description="Weekly average of recorded swings. A 95th-percentile report is not treated as a maximum or another set of swings." series={blast}/>}
    {pitchingGame.length>0&&<ProgressGroup title="Pitching · In-Game" description="Game and intrasquad sessions; each pitch type has its own series." series={pitchingGame}/>}
    {pitchingPractice.length>0&&<ProgressGroup title="Pitching · Practice" description="Only staff-classified practice pitches are included." series={pitchingPractice}/>}
    <p className="muted text-xs">Dots are source sessions with a recorded sample. A line only connects recorded sessions; it is not a projection or a performance grade.</p>
  </section>;
}
