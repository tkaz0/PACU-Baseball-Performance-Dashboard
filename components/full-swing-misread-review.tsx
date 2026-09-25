"use client";
import { useState } from "react";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import type { FullSwingReadingReview } from "@/lib/imports/full-swing-misreads";

const PAGE_SIZE = 60;
function ReadingTable({ rows, excluded, toggle, locked }: { rows: FullSwingReadingReview[]; excluded: ReadonlySet<string>; toggle: (key: string) => void; locked: boolean }) {
  return <div className="table-wrap max-h-96 overflow-auto"><table><thead><tr><th>CSV Row</th><th>Player</th><th>Reading</th><th>Recorded</th><th>Review</th><th>Action</th></tr></thead><tbody>{rows.map(row => <tr key={row.key} className={excluded.has(row.key) ? "opacity-60" : undefined}>
    <td>{row.sourceRow}<span className="muted block text-[11px]">Pitch {row.pitchNumber}</span></td>
    <th scope="row" className="whitespace-nowrap">{row.identity}</th><td>{row.label}</td>
    <td className="whitespace-nowrap font-semibold tabular-nums">{row.raw} {row.unit}</td>
    <td className="min-w-44 text-xs">{row.reason ?? "No automatic flag"}{row.blocking && <span className="block font-bold text-[var(--accent-readable)]">Must remove to continue</span>}</td>
    <td><button type="button" className="btn btn-secondary whitespace-nowrap text-xs" disabled={locked} aria-label={`${excluded.has(row.key) ? "Restore" : "Remove"} ${row.label} on CSV row ${row.sourceRow}`} onClick={() => toggle(row.key)}>{excluded.has(row.key) ? <><RotateCcw size={13} aria-hidden="true"/>Restore</> : <><Trash2 size={13} aria-hidden="true"/>Remove value</>}</button></td>
  </tr>)}</tbody></table></div>;
}

export function FullSwingMisreadReview({ readings, excluded, toggle, reviewed, setReviewed, locked = false }: { readings: FullSwingReadingReview[]; excluded: ReadonlySet<string>; toggle: (key: string) => void; reviewed: boolean; setReviewed: (value: boolean) => void; locked?: boolean }) {
  const [query, setQuery] = useState(""), [page, setPage] = useState(0);
  const flagged = readings.filter(row => row.reason);
  const remaining = flagged.filter(row => !excluded.has(row.key));
  const matches = readings.filter(row => `${row.sourceRow} ${row.pitchNumber} ${row.identity} ${row.label}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const selectedPage = Math.min(page, pageCount - 1);
  return <section className="mb-6 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-4 sm:p-5" aria-label="Check tracking misreads">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="m-0 text-[10px] font-bold uppercase tracking-widest text-[var(--accent-readable)]">Source Check</p><h3 className="mb-1 mt-1 text-lg font-bold">Check Tracking Misreads</h3><p className="muted m-0 text-xs">Review flagged values and remove any bad reading before saving. The original CSV stays unchanged.</p></div><div className="flex gap-2 text-xs font-bold"><span className="rounded-full bg-[var(--surface-raised)] px-3 py-1.5">{flagged.length} flagged</span><span className="rounded-full bg-[var(--surface-raised)] px-3 py-1.5">{excluded.size} removed</span></div></div>
    {locked && <p className="notice mt-4 mb-0 text-sm">A save was attempted. Removed-value choices are locked so an uncertain retry cannot use a different set of readings. Check the save receipt or player profile before retrying; reload the original CSV for a new review.</p>}
    {flagged.length ? <div className="mt-4"><p className="mb-2 flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={17} className="text-[var(--accent-readable)]" aria-hidden="true"/>{remaining.length} flagged {remaining.length === 1 ? "value" : "values"} still included</p><ReadingTable rows={flagged} excluded={excluded} toggle={toggle} locked={locked}/></div> : <p className="notice mt-4 mb-0 text-sm">No automatic flags. You can still remove any reading in the complete list below.</p>}
    <details className="mt-4 border-t border-[var(--line-subtle)] pt-4"><summary className="cursor-pointer text-sm font-semibold">All Recorded Readings · {readings.length}</summary><label className="mt-4 block max-w-sm text-xs">Find a player, measurement, pitch or CSV row<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="Name or CSV row"/></label>
      <p className="muted text-xs">Showing {matches.length ? selectedPage * PAGE_SIZE + 1 : 0}–{Math.min(matches.length, (selectedPage + 1) * PAGE_SIZE)} of {matches.length}</p>
      <ReadingTable rows={matches.slice(selectedPage * PAGE_SIZE, (selectedPage + 1) * PAGE_SIZE)} excluded={excluded} toggle={toggle} locked={locked}/>
      {pageCount > 1 && <div className="mt-3 flex items-center gap-3 text-xs"><button type="button" className="btn btn-secondary" disabled={selectedPage === 0} onClick={() => setPage(n => n - 1)}>Previous</button><span>Page {selectedPage + 1} of {pageCount}</span><button type="button" className="btn btn-secondary" disabled={selectedPage + 1 >= pageCount} onClick={() => setPage(n => n + 1)}>Next</button></div>}
    </details>
    <label className="mt-5 flex items-start gap-3 text-sm"><input type="checkbox" checked={reviewed} disabled={locked} onChange={event => setReviewed(event.target.checked)}/><span>I checked the readings against the CSV. Removed values will be left out of player summaries, pitch results and contact charts when this file is saved.</span></label>
    <p className="muted mb-0 mt-2 text-[11px]">Flags are review hints, not automatic deletions. Unflagged values can also be removed. Already-saved files need a separate correction review.</p>
  </section>;
}
