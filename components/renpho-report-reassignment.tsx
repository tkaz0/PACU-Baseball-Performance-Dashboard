"use client";

import Link from "next/link";
import { useState } from "react";
import { reviewSingleReportCorrection, saveSingleReportCorrection } from "@/app/(workspace)/admin/import/renpho/corrections/single-actions";
import type { RenphoCorrectionPlayer, RenphoReportCatalogItem } from "@/lib/renpho-report-catalog-server";
import type { RenphoReportReassignmentInput, RenphoReportReassignmentPreview, RenphoReportReassignmentReceipt } from "@/lib/renpho-reassignment-server";

export function RenphoReportReassignment({ reports, players }: { reports: RenphoReportCatalogItem[]; players: RenphoCorrectionPlayer[] }) {
  const [fileHash, setFileHash] = useState("");
  const [toAthleteCode, setToAthleteCode] = useState("");
  const [ids, setIds] = useState<[string, string]>(["", ""]);
  const [review, setReview] = useState<{ input: RenphoReportReassignmentInput; preview: RenphoReportReassignmentPreview } | null>(null);
  const [receipt, setReceipt] = useState<RenphoReportReassignmentReceipt | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chosen = reports.find(report => report.fileHash === fileHash);
  const target = players.find(player => player.athleteCode === toAthleteCode);
  const valid = !!chosen && !!target && chosen.athleteCode !== target.athleteCode;
  const locked = busy || attempted;
  function change(update: () => void) {
    if (locked) return;
    update(); setReview(null); setConfirmed(false); setError("");
  }
  async function prepare() {
    if (!valid || locked) return;
    if (ids[1].trim() && !/^\d+$/.test(ids[1].trim())) { setError("The additional numeric ID must contain digits only."); return; }
    setBusy(true); setError(""); setReview(null); setConfirmed(false);
    const input: RenphoReportReassignmentInput = { requestId: crypto.randomUUID(), report: {
      fileHash: chosen.fileHash, fromAthleteCode: chosen.athleteCode, toAthleteCode: target.athleteCode,
      renphoIds: ids.map(id => id.trim()).filter(Boolean),
    } };
    try {
      const result = await reviewSingleReportCorrection(input);
      if (result.error || !result.preview) throw new Error(result.error);
      setReview({ input, preview: result.preview });
    } catch { setError("The report could not be reviewed. Refresh the report list and check the player and any entered IDs."); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!review || !confirmed || busy || receipt) return;
    setAttempted(true); setBusy(true); setError("");
    try {
      const result = await saveSingleReportCorrection(review.input, review.preview.fingerprint, true);
      if (result.error || !result.receipt) throw new Error(result.error);
      setReceipt(result.receipt);
    } catch { setError("The save could not be confirmed. Keep this page open and retry the same correction."); }
    finally { setBusy(false); }
  }
  const playerName = (code: string) => players.find(player => player.athleteCode === code)?.athleteName ?? reports.find(report => report.athleteCode === code)?.athleteName ?? code;
  return <details className="panel mt-6 p-5 sm:p-7">
    <summary className="cursor-pointer font-semibold">Move one report to the correct player</summary>
    <div className="mt-5 space-y-5">
      <p className="muted text-sm">Use this when one report belongs to another player. The correct player can be someone without a saved report.</p>
      <fieldset disabled={locked} className="grid gap-5 md:grid-cols-2">
        <label className="block space-y-2"><span>Report to Move</span><select className="input w-full" value={fileHash} onChange={event => change(() => { setFileHash(event.target.value); setIds(["", ""]); })}><option value="">Choose a report</option>{reports.map(report => <option key={report.fileHash} value={report.fileHash}>{report.athleteName} · {report.measuredAt} · {report.sourceFile}</option>)}</select></label>
        <label className="block space-y-2"><span>Correct Player</span><select className="input w-full" value={toAthleteCode} onChange={event => change(() => setToAthleteCode(event.target.value))}><option value="">Choose the correct player</option>{players.map(player => <option key={player.athleteCode} value={player.athleteCode} disabled={player.athleteCode === chosen?.athleteCode}>{player.athleteName} · {player.athleteCode}</option>)}</select></label>
        <label className="block space-y-2"><span>Printed RENPHO ID (optional)</span><input className="input w-full" value={ids[0]} maxLength={80} autoComplete="off" onChange={event => change(() => setIds([event.target.value, ids[1]]))} /></label>
        <label className="block space-y-2"><span>Additional Numeric ID (optional)</span><input className="input w-full" value={ids[1]} maxLength={80} autoComplete="off" inputMode="numeric" onChange={event => change(() => setIds([ids[0], event.target.value]))} /></label>
      </fieldset>
      <p className="muted text-xs">Only include IDs confirmed for this report. Blank fields leave ID assignments unchanged.</p>
      {error && <p role="alert" className="notice notice-error">{error}</p>}
      {!review && <button type="button" className="btn btn-secondary" disabled={!valid || locked} onClick={() => { void prepare(); }}>{busy ? "Checking Report…" : "Review Report Move"}</button>}
      {review && <>
        <div className="table-wrap"><table aria-label="Single report correction review"><thead><tr><th>Report</th><th>Current Player</th><th>Correct Player</th><th>Readings</th><th>IDs to Move</th></tr></thead><tbody><tr><th scope="row">{review.preview.report.sourceFile}<span className="muted block text-xs">{review.preview.report.measuredAt}</span></th><td><Link prefetch={false} className="underline underline-offset-2" href={`/players/${review.preview.report.fromAthleteCode}`}>{playerName(review.preview.report.fromAthleteCode)}</Link> ({review.preview.report.fromAthleteCode})</td><td><Link prefetch={false} className="underline underline-offset-2" href={`/players/${review.preview.report.toAthleteCode}`}>{playerName(review.preview.report.toAthleteCode)}</Link> ({review.preview.report.toAthleteCode})</td><td>{review.preview.report.measurementCount}</td><td>{review.preview.report.renphoIds.length ? review.preview.report.renphoIds.join(", ") : "Unchanged"}</td></tr></tbody></table></div>
        <label className="flex items-start gap-3"><input type="checkbox" checked={confirmed} disabled={locked} onChange={event => setConfirmed(event.target.checked)} /><span>I checked the original report, correct player, and any selected IDs.</span></label>
        {!receipt && <button type="button" className="btn btn-primary" disabled={!confirmed || busy} onClick={() => { void save(); }}>{busy ? "Moving Report…" : attempted ? "Retry Same Report Move" : "Save Report Move"}</button>}
      </>}
      {receipt && <div role="status" className="notice notice-success"><p>Report moved: {receipt.measurementsMoved} readings moved · {receipt.aliasesMoved} report IDs corrected. Profiles and leaderboards are updated.</p><p className="mb-0 break-all text-xs">Correction Reference: {receipt.requestId}</p></div>}
    </div>
  </details>;
}
