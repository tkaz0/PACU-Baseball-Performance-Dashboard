import type { Measurement } from "@/lib/imports/engine";
import { sessionTimeline } from "@/lib/session-timeline";

const displayDate=(value:string)=>new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"});
export function SessionTimeline({readings}:{readings:readonly Measurement[]}){
  const sessions=sessionTimeline(readings);
  return <section aria-label="Saved session timeline" className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-4 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--accent-readable)]">Season Record</p><h2 className="m-0 text-xl font-bold">Session Timeline</h2></div><span className="text-xs text-[var(--text-secondary)]">{sessions.length} saved {sessions.length===1?"session":"sessions"}</span></div>
    <p className="mt-2 text-xs text-[var(--text-secondary)]">Testing and session dates from saved reports. Cumulative game-sheet totals are shown in In-Game.</p>
    {sessions.length?<ol className="mt-5 space-y-0 border-l border-[var(--line-subtle)] pl-5">{sessions.map(session=><li key={session.key} className="relative border-b border-[var(--line-subtle)] py-3 last:border-b-0 before:absolute before:-left-[25px] before:top-5 before:size-2 before:rounded-full before:bg-[var(--accent-readable)]"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="m-0 text-sm font-bold">{session.label}</h3><time className="text-xs font-semibold tabular-nums text-[var(--text-secondary)]" dateTime={session.date}>{session.start?`${displayDate(session.start)}–${displayDate(session.date)}`:displayDate(session.date)}</time></div><p className="mb-0 mt-1 text-xs text-[var(--text-secondary)]">{session.category} · {session.measurements} recorded {session.measurements===1?"measurement":"measurements"}</p></li>)}</ol>:<p className="mb-0 mt-5 text-sm text-[var(--text-secondary)]">Sessions will appear after the first report is saved.</p>}
  </section>;
}
