"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/file-drop-zone";
import { parseRenphoMappingFile, type RenphoMapping } from "@/lib/renpho-mapping-file";
import { saveRosterRenphoIds } from "@/app/(workspace)/admin/import/renpho/actions";

export function RenphoMappingImport({ roster }: { roster: { code: string; name: string }[] }) {
  const [rows, setRows] = useState<RenphoMapping[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  async function choose(file?: File) {
    setRows([]); setConfirmed(false); setError(""); setReceipt("");
    if (!file) return;
    setBusy(true);
    try {
      if (!/\.json$/i.test(file.name) || file.size < 1 || file.size > 65536) throw new Error("Choose a prepared JSON roster ID file up to 64 KiB.");
      setRows(parseRenphoMappingFile(await file.text(), roster.map(row => row.code)));
    } catch { setError("This roster ID file could not be read. Check the player codes and unique report IDs."); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!confirmed || !rows.length || busy) return;
    setBusy(true); setError("");
    try {
      const result = await saveRosterRenphoIds(rows, true);
      if ("error" in result) throw new Error(result.error);
      setReceipt(`RENPHO IDs saved: ${result.created} added · ${result.unchanged} already linked. Report matching is ready for staff.`);
      setRows([]); setConfirmed(false);
    } catch { setError("The save could not be confirmed. Existing matches are preserved; retry this same reviewed file to verify or complete it."); }
    finally { setBusy(false); }
  }
  return <section className="panel space-y-5 p-5 sm:p-7">
    <FileDropZone label="Roster ID File" description="Upload the prepared JSON file from the roster check." accept=".json,application/json" disabled={busy} onFile={file => { void choose(file); }} />
    {error && <p role="alert" className="notice notice-error">{error}</p>}
    {receipt && <p role="status" className="notice notice-success">{receipt}</p>}
    {!!rows.length && <>
      <h2 className="text-lg font-bold">Review {rows.length} Report ID{rows.length === 1 ? "" : "s"}</h2>
      <div className="table-wrap"><table><caption className="sr-only">Roster RENPHO ID matches</caption><thead><tr><th>Player</th><th>PAC ID</th><th>RENPHO ID</th></tr></thead><tbody>{rows.map(row => <tr key={row.renpho_id}><th scope="row">{roster.find(athlete => athlete.code === row.athlete_code)?.name}</th><td>{row.athlete_code}</td><td>{row.renpho_id}</td></tr>)}</tbody></table></div>
      <p className="muted text-sm">Earlier report IDs stay linked. An ID already assigned to another player cannot be moved by this import.</p>
      <label className="flex items-start gap-3"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>I checked these player names and RENPHO IDs against the master roster.</span></label>
      <button type="button" className="btn btn-primary" disabled={!confirmed || busy} onClick={() => { void save(); }}>{busy ? "Saving IDs…" : "Save Roster RENPHO IDs"}</button>
    </>}
  </section>;
}
