"use client";
import Link from "next/link";
import { useState } from "react";
import { correctWeight } from "@/app/(workspace)/admin/correct-weight/actions";
export type WeightChoice = { id: string; value: number; unit: string; date: string; source: string; file: string };
export function WeightCorrection({ athleteId, readings }: { athleteId: string; readings: WeightChoice[] }) {
  const [selected, setSelected] = useState(readings[0]?.id ?? ""), [value, setValue] = useState("");
  const [review, setReview] = useState<Parameters<typeof correctWeight>[0] | null>(null);
  const [attempted, setAttempted] = useState(false), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState("");
  const reading = readings.find(row => row.id === selected);
  async function save() {
    if (!review || busy || saved) return;
    setAttempted(true); setBusy(true); setError("");
    try { const result = await correctWeight(review, true); if (result.receipt) setSaved(true); else setError(result.error ?? "Could not confirm the correction."); }
    catch { setError("The save could not be confirmed. Keep this page open and retry this same correction."); }
    finally { setBusy(false); }
  }
  if (saved) return <div role="status"><p className="font-semibold">Weight corrected. The original test date and report history were preserved.</p><Link className="btn btn-primary" href={`/athletes/${athleteId}`}>Return to profile</Link></div>;
  if (!readings.length) return <p>No recorded weight is available to correct.</p>;
  return <div className="max-w-xl space-y-5">
    {!review ? <form className="space-y-5" onSubmit={event => { event.preventDefault(); if (!reading || !value.trim() || !Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) === reading.value) { setError("Enter a different positive weight."); return; } setError(""); setReview({ requestId: crypto.randomUUID(), athleteId, observationId: reading.id, expectedValue: reading.value, value: Number(value) }); }}>
      <label className="block">Recorded Weight<select value={selected} onChange={event => { setSelected(event.target.value); setValue(""); }}>{readings.map(row => <option key={row.id} value={row.id}>{row.date} · {row.value} {row.unit} · {row.source} · {row.file}</option>)}</select></label>
      <label className="block">Correct Weight ({reading?.unit})<input type="number" step="any" min="0" required value={value} onChange={event => setValue(event.target.value)} /></label><button type="submit" className="btn btn-primary">Review correction</button>
    </form> : <section aria-label="Weight correction review" className="rounded-lg border border-[var(--line-subtle)] p-5"><h2 className="mt-0 text-lg font-bold">Review Weight Correction</h2><p>{reading?.date} · {reading?.source}</p><p className="break-words text-xs text-[var(--text-secondary)]">{reading?.file}</p><p className="text-2xl font-bold tabular-nums">{review.expectedValue} → {review.value} {reading?.unit}</p><p className="text-sm text-[var(--text-secondary)]">Confirm the corrected value for this player and test date.</p><div className="flex flex-wrap gap-3"><button type="button" className="btn btn-primary" disabled={busy} onClick={() => { void save(); }}>{busy ? "Saving…" : attempted ? "Retry same correction" : "Save correction"}</button>{!attempted && <button type="button" className="btn btn-secondary" onClick={() => setReview(null)}>Edit review</button>}</div></section>}
    {error && <p role="alert" className="text-sm text-[var(--accent-readable)]">{error}</p>}
  </div>;
}
