"use client";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { validateWorkspace } from "@/lib/local-workspace";
import { reviewPerformanceImport, type PerformanceImportReview } from "@/lib/performance-import";
import { SubmitButton } from "@/components/submit-button";

type AthleteChoice = { code: string; name: string };
function ImportFields({ athletes }: { athletes: AthleteChoice[] }) {
  const { pending } = useFormStatus();
  const [review, setReview] = useState<PerformanceImportReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const names = new Map(athletes.map(a => [a.code, a.name]));
  async function readFile(file?: File) {
    const version = ++generation.current;
    setReview(null); setError(null); setApproved(false);
    if (!file) { setBusy(false); return; }
    setBusy(true);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("Choose a workspace backup no larger than 2 MiB. Export a smaller measurement batch if needed.");
      const workspace = validateWorkspace(JSON.parse(await file.text()));
      const next = reviewPerformanceImport(workspace.measurements);
      if (version !== generation.current) return;
      for (const [index, row] of next.rows.entries()) if (!names.has(row.athlete_code)) next.errors.push({ index, message: "This athlete is not in the shared roster. Import and review the roster first." });
      if (new TextEncoder().encode(JSON.stringify(next.candidateMeasurements)).byteLength > 1048576) {
        next.errors.push({ index: null, message: "The reviewed measurement payload exceeds 1 MiB. Choose a smaller measurement batch before sharing." });
      }
      next.canApply = next.canApply && next.errors.length === 0;
      setReview(next);
    } catch (cause) {
      if (version === generation.current) setError(cause instanceof Error ? cause.message : "This backup could not be read.");
    } finally { if (version === generation.current) setBusy(false); }
  }
  return <section className="panel p-5 sm:p-7"><fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0">
    <h2 className="text-xl font-bold">Share reviewed measurements</h2>
    <p className="muted text-sm">Export a backup from the browser Import Center, choose it here, then review the readings below. Only approved numeric measurements are shared. Original reports and images stay on your device.</p>
    <label className="mb-2 block">Workspace backup<input type="file" aria-describedby="shared-backup-help" onChange={event => void readFile(event.target.files?.[0])} /></label>
    <p id="shared-backup-help" className="muted mb-5 text-xs">Choose a workspace JSON backup.</p>
    {busy && <p role="status" className="muted">Reading backup…</p>}
    {error && <p role="alert" className="notice notice-error">{error}</p>}
    {review && <>
      <p className="font-semibold" role="status">{review.rows.length} readings ready for review · {new Set(review.rows.map(row => row.athlete_code)).size} players</p>
      {review.excluded.length > 0 && <details className="mb-5"><summary className="cursor-pointer text-sm font-semibold">{review.excluded.length} unsupported measurements will stay in your browser</summary><ul className="mt-3 list-disc pl-5 text-sm">{review.excluded.map(row => <li key={row.index}>{row.metric} ({row.unit}): {row.reason}</li>)}</ul></details>}
      {review.errors.length > 0 && <div role="alert" className="notice notice-error mb-5"><p className="font-semibold">Resolve these items before sharing:</p><ul className="list-disc pl-5">{review.errors.slice(0,20).map((item,index) => <li key={index}>{item.index === null ? "Batch" : `Reading ${item.index + 1}`}: {item.message}</li>)}</ul></div>}
      {review.rows.length > 0 && <div className="table-wrap mb-5"><table aria-label="Shared measurement review"><thead><tr><th>Player</th><th>Measurement</th><th>Value</th><th>Test date</th><th>Source</th></tr></thead><tbody>{review.rows.map((row,index) => <tr key={row.observation_id}><td>{names.get(row.athlete_code) ?? "Profile not found"}</td><td>{review.candidateMeasurements[index]?.metric}</td><td>{row.value} {row.unit}</td><td>{row.measured_at}</td><td>{row.source}</td></tr>)}</tbody></table></div>}
      {review.canApply && <div className="space-y-4">
        <input type="hidden" name="measurements" value={JSON.stringify(review.candidateMeasurements)} />
        <label className="flex items-start gap-3 text-sm"><input className="mt-1 !w-auto" type="checkbox" name="confirm" value="yes" required checked={approved} onChange={event => setApproved(event.target.checked)} /><span>I reviewed each player, date, value and unit and approve sharing these measurements with coaches and the linked player.</span></label>
        <SubmitButton disabled={!approved || busy} pendingText="Sharing measurements…">Share with team</SubmitButton>
        <p className="muted mb-0 text-xs">A repeated observation is skipped. An existing observation with different details stops the whole import so it can be reviewed.</p>
      </div>}
    </>}
  </fieldset></section>;
}

export function SharedPerformanceImport({ athletes, action }: { athletes: AthleteChoice[]; action: (form: FormData) => Promise<void> }) {
  return <form action={action}><ImportFields athletes={athletes} /></form>;
}
