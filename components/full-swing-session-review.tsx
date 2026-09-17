"use client";
import { useState } from "react";
import { groupPitchRanges, SESSION_METRICS, type FullSwingSession } from "@/lib/imports/full-swing-session";

const number = (value: number | null) => value === null ? "—" : value.toFixed(1);
export function FullSwingSessionReview({ session }: { session: FullSwingSession }) {
  const [search, setSearch] = useState("");
  const [velocityWidth, setVelocityWidth] = useState(5), [spinWidth, setSpinWidth] = useState(250);
  const [rpmConfirmed, setRpmConfirmed] = useState(false);
  const matches = (name: string) => name.toLowerCase().includes(search.trim().toLowerCase());
  const ranges = groupPitchRanges(session.pitches, velocityWidth, spinWidth).filter(r => matches(r.identity));
  const players = session.players.filter(p => matches(p.identity));
  const spinUnit = rpmConfirmed ? "RPM" : "export units";
  return <section className="my-6 space-y-5 rounded-xl border border-[var(--line-subtle)] p-4 sm:p-5" aria-label="Full Swing session review">
    <div><h3 className="m-0 text-lg font-bold">All Player Summaries</h3><p className="muted mb-0 text-sm">{session.date} · {session.eventCount} pitches. Every exported player is included; — means no recorded value.</p></div>
    <label className="block max-w-md">Find a player<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search export names" /></label>
    {!players.length && <p className="muted">No players match your search.</p>}
    {(["Batter", "Pitcher"] as const).map(role => {
      const rows = players.filter(p => p.role === role), metrics = SESSION_METRICS.map((m, i) => ({ ...m, index: i })).filter(m => m.role === role);
      if (!rows.length) return null;
      return <div key={role}><h4 className="mb-2 font-semibold">{role === "Batter" ? "Hitting" : "Pitching"} · {rows.length} {rows.length === 1 ? "player" : "players"}</h4><div className="table-wrap max-h-[32rem] overflow-auto"><table><caption className="sr-only">All {role.toLowerCase()} summaries</caption><thead><tr><th>Export Player</th><th>Pitches {role === "Batter" ? "Faced" : "Thrown"}</th>{metrics.map(m => <th key={m.key}>{m.label}<span className="block text-xs font-normal">{m.unit}</span></th>)}</tr></thead><tbody>{rows.map(p => <tr key={p.identity}><th scope="row" className="whitespace-nowrap">{p.identity}</th><td>{p.eventCount}</td>{metrics.map(m => {
        const raw = p.values[m.index], count = session.samples.find(s => s.identity === p.identity && s.role === role && s.metric === m.label)?.count;
        return <td className="tabular-nums" key={m.key}>{raw ? number(Number(raw)) : "—"}{count !== undefined && <span className="muted block text-[11px]">n={count}</span>}</td>;
      })}</tr>)}</tbody></table></div></div>;
    })}
    <details className="border-t border-[var(--line-subtle)] pt-4" open><summary className="cursor-pointer font-semibold">Pitch Velocity &amp; Spin Ranges</summary>
      <p className="muted text-sm">Grouped separately for each pitcher. Ranges do not identify fastballs, breaking balls or other pitch types. This review stays with the open file; only reviewed summary measurements are saved.</p>
      <div className="flex flex-wrap gap-4"><label>Velocity range<select value={velocityWidth} onChange={e => setVelocityWidth(Number(e.target.value))}>{[2,5,10].map(n => <option key={n} value={n}>{n} mph</option>)}</select></label><label>Spin range<select value={spinWidth} onChange={e => setSpinWidth(Number(e.target.value))}>{[100,250,500].map(n => <option key={n} value={n}>{n} {spinUnit}</option>)}</select></label></div>
      <label className="my-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={rpmConfirmed} onChange={e => setRpmConfirmed(e.target.checked)} />I confirm the export’s SpinRate values are RPM.</label>
      <div className="table-wrap max-h-[32rem] overflow-auto"><table><caption className="sr-only">Pitch groups by velocity and spin</caption><thead><tr><th>Pitcher</th><th>Velocity (mph)</th><th>Spin ({spinUnit})</th><th>Pitches</th><th>Average Velocity</th><th>Average Spin</th></tr></thead><tbody>{ranges.map((range, i) => {
        const total = session.pitches.filter(p => p.identity === range.identity).length;
        return <tr key={i}><th scope="row" className="whitespace-nowrap">{range.identity}</th><td className="whitespace-nowrap">{range.velocityStart === null ? "Not recorded" : `${range.velocityStart}–<${range.velocityStart + velocityWidth}`}</td><td className="whitespace-nowrap">{range.spinStart === null ? "Not recorded / unreadable" : `${range.spinStart}–<${range.spinStart + spinWidth}`}</td><td className="min-w-28"><span className="tabular-nums">{range.count} <span className="muted text-xs">({Math.round(range.count / total * 100)}%)</span></span><div className="mt-1 h-1.5 rounded bg-[var(--line-subtle)]" aria-hidden="true"><div className="h-full rounded bg-pacu-red" style={{ width: `${range.count / total * 100}%` }} /></div></td><td>{number(range.averageVelocity)} mph</td><td>{number(range.averageSpin)}</td></tr>;
      })}</tbody></table></div>
      <p className="muted mb-0 text-xs">Ranges include the lower number and exclude the upper number. Percentages use all pitches thrown by that pitcher; missing spin stays in its own group.</p>
    </details>
  </section>;
}
