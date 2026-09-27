"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { restoreFullSwingSession } from "@/app/(workspace)/imports/session-actions";
import type { SessionPublication } from "@/lib/session-library";
import type { FullSwingSessionReceipt } from "@/lib/imports/full-swing-session-bundle";
import { prepareSessionRestoreAttempt, previousRestorableRevision, type SessionRestoreRequest } from "@/lib/session-library-restore";
import styles from "./session-library.module.css";

export function SessionRestore({ publication }: { publication: SessionPublication }) {
  const router = useRouter();
  const request = useRef<SessionRestoreRequest | null>(null);
  const busyRef = useRef(false);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState<SessionRestoreRequest | null>(null);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<FullSwingSessionReceipt | null>(null);
  const target = previousRestorableRevision(publication);
  if (target === null) return null;
  const reviewedTarget = attempt?.targetRevision ?? target;
  async function restore() {
    if (busyRef.current || receipt) return;
    let input: SessionRestoreRequest;
    try { input = prepareSessionRestoreAttempt(publication, reviewed, request.current, () => crypto.randomUUID()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Review the previous revision before restoring."); return; }
    request.current = input;
    busyRef.current = true; setAttempt(input); setBusy(true); setError("");
    try {
      const result = await restoreFullSwingSession(input, true);
      if ("error" in result) setError(result.error);
      else { setReceipt(result); router.refresh(); }
    } catch { setError("The restore was not confirmed. Check the current session before retrying this same request."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <details className={styles.history}>
    <summary>Session History</summary>
    <div className={styles.restorePanel}>
      <p>Current revision: <strong>{publication.revision}</strong>. Restoring revision {reviewedTarget} replaces this session’s saved results, sample counts, and contact charts together. The change is recorded as a new revision.</p>
      {receipt ? <p role="status" className={styles.restoreSuccess}>Restored as revision {receipt.revision}: {receipt.measurementCount} measurements, {receipt.sampleCount} sample counts, and {receipt.contactCount} contact-chart points.</p> : <>
        <label className={styles.restoreCheck}><input type="checkbox" checked={reviewed} disabled={!!attempt || busy} onChange={event => setReviewed(event.target.checked)} /><span>Restore all saved results from revision {reviewedTarget}</span></label>
        <button type="button" className="btn btn-secondary" disabled={!reviewed || busy} onClick={() => void restore()}><RotateCcw size={14} aria-hidden="true" />{busy ? "Restoring…" : attempt ? "Retry This Restore" : "Restore Previous Revision"}</button>
        {error && <p role="alert" className={styles.restoreError}>{error}</p>}
        {!!attempt && !busy && <p className={styles.retryNote}>This request is locked to the revision you reviewed. A retry uses the same request and cannot create the restore twice.</p>}
      </>}
    </div>
  </details>;
}
