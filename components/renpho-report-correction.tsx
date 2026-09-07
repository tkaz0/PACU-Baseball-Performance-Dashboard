"use client";

import { useState } from "react";
import { reviewReportCorrection, saveReportCorrection } from "@/app/(workspace)/admin/import/renpho/corrections/actions";
import type { RenphoReportCatalogItem } from "@/lib/renpho-report-catalog-server";
import type { RenphoReportSwapInput, RenphoReportSwapPreview, RenphoReportSwapReceipt } from "@/lib/renpho-correction-server";

export function RenphoReportCorrection({ reports }: { reports: RenphoReportCatalogItem[] }) {
  const [selected, setSelected] = useState<[string, string]>(["", ""]);
  const [ids, setIds] = useState<[string, string]>(["", ""]);
  const [review, setReview] = useState<{ input: RenphoReportSwapInput; preview: RenphoReportSwapPreview } | null>(null);
  const [receipt, setReceipt] = useState<RenphoReportSwapReceipt | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chosen = selected.map(hash => reports.find(report => report.fileHash === hash));
  const valid = chosen.every(Boolean) && chosen[0]!.athleteCode !== chosen[1]!.athleteCode;
  function change(index: number, value: string, isId = false) {
    if (busy || attempted) return;
    const next = [...(isId ? ids : selected)] as [string, string]; next[index] = value;
    if (isId) setIds(next);
    else {
      setSelected(next);
      setIds(current => current.map((id, slot) => slot === index ? "" : id) as [string, string]);
    }
    setReview(null); setConfirmed(false); setError("");
  }
  async function prepare() {
    if (!valid || busy || attempted) return;
    setBusy(true); setError(""); setReview(null); setConfirmed(false);
    const input: RenphoReportSwapInput = { requestId: crypto.randomUUID(), reports: [0, 1].map(index => ({ fileHash: chosen[index]!.fileHash, fromAthleteCode: chosen[index]!.athleteCode, toAthleteCode: chosen[1 - index]!.athleteCode, renphoId: ids[index].trim() || null })) as RenphoReportSwapInput["reports"] };
    try {
      const result = await reviewReportCorrection(input);
      if (result.error || !result.preview) throw new Error(result.error);
      setReview({ input, preview: result.preview });
    } catch { setError("The reports could not be reviewed. Refresh the report list and check any entered IDs."); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!review || !confirmed || busy || receipt) return;
    setAttempted(true); setBusy(true); setError("");
    try {
      const result = await saveReportCorrection(review.input, review.preview.fingerprint, true);
      if (result.error || !result.receipt) throw new Error(result.error);
      setReceipt(result.receipt);
    } catch { setError("The save could not be confirmed. Keep this page open and retry the same correction."); }
    finally { setBusy(false); }
  }
  return <section className="panel space-y-5 p-5 sm:p-7">
    <p className="muted text-sm">Select the two reports assigned to the wrong players. Their readings will move together. Check the original reports before including a report ID correction.</p>
    <div className="grid gap-5 md:grid-cols-2">{[0, 1].map(index => <fieldset key={index} disabled={busy || attempted} className="space-y-3">
      <legend className="mb-2 font-bold">Report {index + 1}</legend>
      <label className="block space-y-2"><span>Saved Report {index + 1}</span><select className="input w-full" value={selected[index]} onChange={event => change(index, event.target.value)}><option value="">Choose a report</option>{reports.map(report => <option key={report.fileHash} value={report.fileHash}>{report.athleteName} · {report.measuredAt} · {report.sourceFile}</option>)}</select></label>
      <label className="block space-y-2"><span>Report {index + 1} RENPHO ID (optional)</span><input className="input w-full" value={ids[index]} maxLength={128} autoComplete="off" onChange={event => change(index, event.target.value, true)} /></label>
      <p className="muted text-xs">Enter the exact ID printed on this file only if it should follow the report to the other player.</p>
    </fieldset>)}</div>
    {error && <p role="alert" className="notice notice-error">{error}</p>}
    {!review && <button type="button" className="btn btn-secondary" disabled={!valid || busy} onClick={() => { void prepare(); }}>{busy ? "Checking Reports…" : "Review Report Swap"}</button>}
    {review && <>
      <div className="table-wrap"><table aria-label="Report correction review"><thead><tr><th>Report</th><th>Current Player</th><th>Correct Player</th><th>Readings</th><th>Report ID</th></tr></thead><tbody>{review.preview.reports.map(row => <tr key={row.fileHash}><th scope="row">{row.sourceFile}<span className="muted block text-xs">{row.measuredAt}</span></th><td>{reports.find(report => report.athleteCode === row.fromAthleteCode)?.athleteName} ({row.fromAthleteCode})</td><td>{reports.find(report => report.athleteCode === row.toAthleteCode)?.athleteName} ({row.toAthleteCode})</td><td>{row.measurementCount}</td><td>{row.renphoId ?? "Unchanged"}</td></tr>)}</tbody></table></div>
      <label className="flex items-start gap-3"><input type="checkbox" checked={confirmed} disabled={busy || attempted} onChange={event => setConfirmed(event.target.checked)} /><span>I checked both original reports and their correct players.</span></label>
      {!receipt && <button type="button" className="btn btn-primary" disabled={!confirmed || busy} onClick={() => { void save(); }}>{busy ? "Saving Correction…" : attempted ? "Retry Same Correction" : "Save Report Swap"}</button>}
    </>}
    {receipt && <p role="status" className="notice notice-success">Reports switched: {receipt.measurementsMoved} readings moved · {receipt.aliasesMoved} report IDs corrected. Profiles and leaderboards are updated.</p>}
  </section>;
}
