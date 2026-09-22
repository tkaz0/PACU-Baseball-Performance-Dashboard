"use client";
import { useState } from "react";
import type { SavedContact } from "@/lib/full-swing-contacts-server";
import { contactQuality } from "@/lib/contact-quality";
import { HitterSprayMap } from "@/components/hitter-spray-map";
import { StatInfo } from "@/components/stat-info";

const fmt = (n: number) => n.toFixed(1);
const shortDate = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
function bounds(values: number[], step: number, floor: number, includeZero = false): [number, number] {
  const low = Math.min(...values, ...(includeZero ? [0] : [])), high = Math.max(...values, ...(includeZero ? [0] : []));
  const from = Math.max(floor, Math.floor((low - step) / step) * step);
  const to = Math.ceil((high + step) / step) * step;
  return [from, to > from ? to : from + step];
}
function color(speed: number) {
  const fraction = Math.max(0, Math.min(1, (speed - 50) / 70));
  return `hsl(${Math.round(211 - fraction * 207)} 67% ${Math.round(44 + fraction * 2)}%)`;
}

/** The only points are reviewed, row-paired Full Swing batted-ball observations. */
export function HitterContactMap({ contacts, context, bats }: { contacts: readonly SavedContact[]; context: "in_game" | "practice"; bats?: string | null }) {
  const eligible = contacts.filter(row => (row.category === "practice" ? "practice" : "in_game") === context);
  const sessions = [...new Map(eligible.map(row => [row.fileHash, { hash: row.fileHash, date: row.playedOn, name: row.sourceFile, category: row.category }])).values()]
    .sort((a,b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  const [selected, setSelected] = useState("all");
  const [chart,setChart] = useState<"contact"|"spray">("contact");
  if (!sessions.length) return null;
  const plotted = selected === "all" ? eligible : eligible.filter(row => row.fileHash === selected);
  const quality=contactQuality(plotted);
  const [minX,maxX] = bounds(plotted.map(row => row.exitVelocity),10,0);
  const [minY,maxY] = bounds(plotted.map(row => row.launchAngle),10,-90,true);
  const x = (n:number) => 66 + (n-minX)/(maxX-minX)*564;
  const y = (n:number) => 266 - (n-minY)/(maxY-minY)*216;
  const ticks = [0,.25,.5,.75,1];
  return <section className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-4 sm:p-5" aria-label={`${context === "practice" ? "Practice" : "In-game"} hitter contact map`}>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="m-0 text-xl font-bold">Hitter Contact Map<StatInfo metric="hitter_contact_map" label="Hitter Contact Map"/></h2><p className="muted mb-0 mt-1 text-sm">Exit speed and launch angle · {plotted.length} recorded {plotted.length === 1 ? "ball" : "balls"}</p></div>
      <label className="text-sm font-semibold">Session<select aria-label="Contact map session" value={selected} onChange={event => setSelected(event.target.value)}><option value="all">All Fall {context === "practice" ? "practice" : "games & intrasquads"}</option>{sessions.map(session => <option key={session.hash} value={session.hash}>{shortDate(session.date)} · {session.name.replace(/\.csv$/i, "")}</option>)}</select></label></div>
    <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Contact quality summary">
      <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3"><p className="m-0 text-xs font-semibold text-[var(--text-secondary)]">Recorded Contact</p><strong className="mt-1 block text-2xl tabular-nums">{quality.count}</strong><p className="muted m-0 text-xs">With exit speed and angle</p></div>
      <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3"><p className="m-0 text-xs font-semibold text-[var(--text-secondary)]">Hard Hit</p><strong className="mt-1 block text-2xl tabular-nums">{quality.hardHitPct.toFixed(1)}%</strong><p className="muted m-0 text-xs">90+ mph · {quality.hardHit} of {quality.count}</p></div>
      <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3"><p className="m-0 text-xs font-semibold text-[var(--text-secondary)]">Balls in Launch Window</p><strong className="mt-1 block text-2xl tabular-nums">{quality.sweetSpotPct.toFixed(1)}%</strong><p className="muted m-0 text-xs">8–32° · {quality.sweetSpot} of {quality.count}</p></div>
      <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3"><p className="m-0 text-xs font-semibold text-[var(--text-secondary)]">Hard Hit + Launch Window</p><strong className="mt-1 block text-2xl tabular-nums">{quality.bothPct.toFixed(1)}%</strong><p className="muted m-0 text-xs">90+ mph and 8–32° · {quality.both} of {quality.count}</p></div>
    </div>
    {quality.count<10&&<p className="muted mb-0 mt-2 text-xs">Early look: these percentages use just {quality.count} recorded {quality.count===1?"ball":"balls"}.</p>}
    <div className="mt-4 flex flex-wrap items-center gap-2"><div className="flex flex-wrap gap-2" role="group" aria-label="Batted-ball chart"><button type="button" onClick={()=>setChart("contact")} aria-pressed={chart==="contact"} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${chart==="contact"?"border-[var(--accent-readable)] bg-[var(--accent-readable)] text-white":"border-[var(--line-subtle)]"}`}>Exit Speed / Angle</button><button type="button" onClick={()=>setChart("spray")} aria-pressed={chart==="spray"} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${chart==="spray"?"border-[var(--accent-readable)] bg-[var(--accent-readable)] text-white":"border-[var(--line-subtle)]"}`}>Spray Chart</button></div><StatInfo metric={chart==="contact"?"ev_launch_chart":"spray_chart"} label={chart==="contact"?"Exit Speed / Angle chart":"Spray Chart"}/></div>
    {chart==="spray"?<HitterSprayMap contacts={plotted} bats={bats}/>:<><div className="mt-4 overflow-x-auto"><svg viewBox="0 0 700 328" role="img" aria-label={`Scatter plot of ${plotted.length} batted ${plotted.length === 1 ? "ball" : "balls"} with exit velocity in miles per hour on the horizontal axis and launch angle in degrees on the vertical axis`} className="min-w-[540px] w-full">
      {ticks.map(fraction => { const ev=minX+(maxX-minX)*fraction, angle=minY+(maxY-minY)*fraction;
        return <g key={fraction}><line x1={x(ev)} x2={x(ev)} y1="50" y2="266" stroke="var(--line-subtle)"/><text x={x(ev)} y="284" textAnchor="middle" fill="var(--text-secondary)" fontSize="11">{Math.round(ev)}</text><line x1="66" x2="630" y1={y(angle)} y2={y(angle)} stroke="var(--line-subtle)"/><text x="57" y={y(angle)+4} textAnchor="end" fill="var(--text-secondary)" fontSize="11">{Math.round(angle)}°</text></g>; })}
      <line x1="66" x2="630" y1="266" y2="266" stroke="var(--text-secondary)"/>
      <line x1="66" x2="66" y1="50" y2="266" stroke="var(--text-secondary)"/>
      <text x="348" y="316" textAnchor="middle" fill="var(--text-secondary)" fontSize="13">Exit velocity (mph)</text>
      <text transform="translate(16 158) rotate(-90)" textAnchor="middle" fill="var(--text-secondary)" fontSize="13">Launch angle (°)</text>
      {plotted.map(row => <circle key={`${row.fileHash}:${row.sourceRow}`} cx={x(row.exitVelocity)} cy={y(row.launchAngle)} r="5.5" fill={color(row.exitVelocity)} fillOpacity=".83" stroke="var(--surface-panel)" strokeWidth="1"><title>{`${shortDate(row.playedOn)} · Pitch ${row.pitchNumber}: ${fmt(row.exitVelocity)} mph, ${fmt(row.launchAngle)}°`}</title></circle>)}
    </svg></div>
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]"><span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#3979b7]"/>Lower exit speed</span><span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#bb2634]"/>Higher exit speed</span><span>Color compares exit speed within a fixed 50–120 mph display scale.</span></div></>}
    <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-[var(--accent-readable)]">See Every Batted Ball</summary><div className="table-wrap mt-3 max-h-72"><table><thead><tr><th>Date</th><th>Session</th><th>Pitch #</th><th>Exit Velocity</th><th>Launch Angle</th><th>Direction</th><th>Distance</th></tr></thead><tbody>{plotted.map(row => <tr key={`${row.fileHash}:${row.sourceRow}`}><td>{shortDate(row.playedOn)}</td><td>{row.sourceFile.replace(/\.csv$/i, "")}</td><td>{row.pitchNumber}</td><td>{fmt(row.exitVelocity)} mph</td><td>{fmt(row.launchAngle)}°</td><td>{row.direction===null?"—":`${fmt(row.direction)}°`}</td><td>{row.distance===null?"—":`${fmt(row.distance)} ft`}</td></tr>)}</tbody></table></div></details>
    <p className="muted mb-0 mt-3 text-xs">Each dot is one recorded batted ball. Percentages use balls with both needed readings from the selected session or Fall. Pacific uses 90+ mph for hard hit and 8–32° for the launch window. Balls without both readings are left out. Full Swing does not tell us whether a ball became a hit.</p>
  </section>;
}
