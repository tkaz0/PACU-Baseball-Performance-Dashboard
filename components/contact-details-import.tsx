"use client";

import { useState } from "react";
import { readImportFile } from "@/lib/imports/files";
import { selectTable } from "@/lib/imports/engine";
import { summarizeFullSwingSession } from "@/lib/imports/full-swing-session";
import { contactPitcherRows, type ContactPitcherRow } from "@/lib/imports/contact-pitchers";
import { contactSquaredUpRows, type ContactSquaredUpRow } from "@/lib/imports/contact-squared-up";
import { saveContactPitchers, saveContactSquaredUp } from "@/app/(workspace)/imports/actions";

type Batch = { hash: string; name: string; date: string; contacts: number; quality: ContactSquaredUpRow[]; pitchers: ContactPitcherRow[] };
type Receipt = { created: number; unchanged: number; skipped: number };
const receiptText = (receipt: Receipt) => `${receipt.created} added · ${receipt.unchanged} already saved · ${receipt.skipped} not matched`;

/** Original files stay in memory. Existing RPCs verify exact saved contact EV and pitcher summary. */
export function ContactDetailsImport() {
  const [batches,setBatches] = useState<Batch[]>([]), [busy,setBusy] = useState(false);
  const [confirmed,setConfirmed] = useState(false), [locked,setLocked] = useState(false);
  const [error,setError] = useState(""), [results,setResults] = useState<string[]>([]);
  async function read(files: FileList | null) {
    if (!files || locked) return;
    setBusy(true); setError(""); setBatches([]); setResults([]); setConfirmed(false);
    try {
      if (files.length>20) throw new Error("Choose up to 20 original CSV files at once.");
      const next: Batch[] = [];
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Choose original Full Swing CSV files.");
        const parsed = await readImportFile(file);
        if (next.some(row=>row.hash===parsed.fileHash)) continue;
        const source = selectTable(parsed.sheets[0].matrix,0), session = summarizeFullSwingSession(source);
        next.push({hash:parsed.fileHash,name:file.name,date:session.date,contacts:session.contacts.length,
          quality:contactSquaredUpRows(source,session),pitchers:contactPitcherRows(source,session)});
      }
      setBatches(next);
    } catch { setError("A file could not be read as the original reviewed Full Swing format. Choose the original, unedited CSV exports."); }
    finally { setBusy(false); }
  }
  async function save() {
    if (busy || !confirmed || !batches.length) return;
    setBusy(true);setLocked(true);setError("");setResults([]);
    const completed: string[]=[];
    let needsReview = false;
    try {
      for (const batch of batches) {
        let qualityText = "not confirmed; retry the same original file", pitcherText = qualityText;
        try {
          const quality = batch.quality.length ? await saveContactSquaredUp(batch.hash,batch.quality) : {created:0,unchanged:0,skipped:0};
          if ("error" in quality) needsReview = true;
          else qualityText = receiptText(quality);
        } catch { needsReview = true; }
        try {
          const pitchers = batch.pitchers.length ? await saveContactPitchers(batch.hash,batch.pitchers) : {created:0,unchanged:0,skipped:0};
          if ("error" in pitchers) needsReview = true;
          else pitcherText = receiptText(pitchers);
        } catch { needsReview = true; }
        completed.push(`${batch.name}: Quality — ${qualityText}. Pitcher links — ${pitcherText}.`);
        setResults([...completed]);
      }
      if (needsReview) setError("Some details could not be confirmed. Verified saves remain intact; retry these same original files. Existing details are never replaced.");
    }
    finally {setBusy(false);}
  }
  return <section className="card p-5" aria-label="Restore original contact details">
    <h2 className="m-0 text-xl">Complete Older Sessions</h2>
    <p className="muted text-sm">Add missing Squared Up, Potential EV and pitcher links from original Full Swing CSVs. This does not import a new session, change player matches or overwrite saved results. Staff pitch labels connect automatically.</p>
    <label className="block text-sm font-semibold">Original Full Swing CSVs<input type="file" accept=".csv" multiple disabled={busy||locked} onChange={event=>void read(event.target.files)}/></label>
    {!!batches.length&&<><div className="table-wrap mt-4"><table><thead><tr><th>File</th><th>Date</th><th>Contact Pairs</th><th>Quality Pairs</th><th>Pitcher Links to Check</th></tr></thead><tbody>{batches.map(batch=><tr key={batch.hash}><td>{batch.name}</td><td>{batch.date}</td><td>{batch.contacts}</td><td>{batch.quality.length}</td><td>{batch.pitchers.length}</td></tr>)}</tbody></table></div>
      <p className="muted text-xs">Only existing batted balls with the exact file fingerprint, row and exit speed can receive quality details. Pitcher links also need an exact saved pitcher-summary match. Missing or edited files stay unmatched.</p>
      <label className="my-4 flex items-start gap-3 text-sm"><input type="checkbox" checked={confirmed} disabled={busy||locked} onChange={event=>setConfirmed(event.target.checked)}/>I checked these original files and dates. Add only verified missing details to their existing saved sessions.</label>
      <button className="btn btn-primary" disabled={busy||!confirmed} onClick={()=>void save()}>{busy?"Checking & Saving…":locked?"Retry Same Files":"Save Missing Contact Details"}</button>
      {locked&&<p className="muted text-xs">These files are locked for an identical retry. Reload this page to review another batch.</p>}</>}
    {error&&<p role="alert" className="notice error mt-4">{error}</p>}
    {!!results.length&&<div role="status" className="notice mt-4" data-testid="contact-details-receipts"><h3 className="mt-0 text-base">Verified Contact Details</h3><ul>{results.map((result,index)=><li key={index} className="text-sm">{result}</li>)}</ul><p className="mb-0 text-xs">Not matched means no qualifying saved contact or pitcher summary; those results were left unchanged.</p></div>}
  </section>;
}
