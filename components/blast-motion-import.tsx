"use client";
import { useState } from "react";
import Link from "next/link";
import { FileDropZone } from "@/components/file-drop-zone";
import { FullSwingImport, type SaveImportAction } from "@/components/full-swing-import";
import { ImportConfirmation } from "@/components/import-confirmation";
import { buildImportConfirmation, type ImportConfirmationData } from "@/lib/import-confirmation";
import { readImportFile, type ImportFile } from "@/lib/imports/files";
import { selectTable, type ImportTable } from "@/lib/imports/engine";
import { selectRosterSummaries } from "@/lib/imports/roster-selection";
import { blastIdentityTable, previewBlastPerformance } from "@/lib/imports/blast-performance";
import { blastPeriodLabel, blastUnit, formatBlastValue, type BlastSummaryKind } from "@/lib/blast-metrics";
import { athleteName, type RosterAthlete } from "@/lib/types";
import styles from "./blast-reports.module.css";
const message = (error: unknown) => error instanceof Error ? error.message : "The report could not be saved. Retry this reviewed report.";

export function BlastMotionImport({roster,saveAction}:{roster:RosterAthlete[];saveAction:SaveImportAction}) {
  const [custom,setCustom]=useState(false),[file,setFile]=useState<ImportFile|null>(null),[table,setTable]=useState<ImportTable|null>(null);
  const [reportName,setReportName]=useState("");
  const [kind,setKind]=useState<BlastSummaryKind|"">(""),[start,setStart]=useState(""),[end,setEnd]=useState("");
  const [overrides,setOverrides]=useState<Record<string,string>>({}),[excluded,setExcluded]=useState<string[]>([]);
  const [review,setReview]=useState<ReturnType<typeof previewBlastPerformance>|null>(null),[confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false),[locked,setLocked]=useState(false),[error,setError]=useState(""),[receipt,setReceipt]=useState<ImportConfirmationData|null>(null);
  const invalidate=()=>{setReview(null);setConfirmed(false);setError("");};
  async function choose(next?:File) {
    if (!next) return;
    invalidate();setFile(null);setTable(null);setKind("");setOverrides({});setExcluded([]);setBusy(true);
    try {
      if (!next.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a Blast Performance CSV.");
      const parsed=await readImportFile(next), original=selectTable(parsed.sheets[0].matrix,0);
      blastIdentityTable(original);setFile(parsed);setTable(original);setReportName(parsed.fileName.replace(/\.csv$/i,""));
    } catch(e) {setError(message(e));} finally {setBusy(false);}
  }
  const selection=table?selectRosterSummaries(blastIdentityTable(table),{identityKind:"name",identityColumn:0,identityOverrides:overrides},roster,excluded):null;
  function prepare() {
    invalidate();
    try {if(!file||!table||!kind)throw new Error("Choose Average or Peak (95th Percentile) for this file.");
      if(!reportName.trim() || reportName.trim().length>296 || /[\u0000-\u001f\u007f]/.test(reportName))throw new Error("Enter a report name of 1–296 characters.");
      setReview(previewBlastPerformance({table,roster,file:{...file,fileName:`${reportName.trim()}.csv`,sheetName:file.sheets[0].name},kind,start,end,overrides,excluded}));
    }catch(e){setError(message(e));}
  }
  async function save() {
    if(!confirmed||!review||busy)return;
    setBusy(true);setLocked(true);setError("");
    try {const result=await saveAction(review.rows);setReceipt({...buildImportConfirmation(review.rows,roster,result,review.skipped.map(p=>({label:p.identity,reason:p.reason}))),reportingPeriod:blastPeriodLabel(start,end)});}
    catch(e){setError(message(e));}finally{setBusy(false);}
  }
  if(custom)return <div className="space-y-4"><button type="button" className="btn btn-secondary" onClick={()=>setCustom(false)}>Back to Weekly Blast Reports</button><FullSwingImport vendor="Blast Motion" category="hitting" roster={roster} saveAction={saveAction}/></div>;
  return <section className="card space-y-5">
    <header><p className={styles.eyebrow}>Practice · Hitting</p><h2>Blast Motion Reports</h2><p className="muted">Upload weekly reports containing only new practice swings. Average and 95th-percentile CSVs are reviewed separately.</p></header>
    {receipt?<><ImportConfirmation receipt={receipt}/><button className="btn btn-primary" onClick={()=>{setReceipt(null);setLocked(false);setFile(null);setTable(null);setKind("");invalidate();}}>Import Next Report</button></>:<>
      <FileDropZone label="Drop in a Blast Performance CSV" description="Average Performance or Peak (95th Percentile) · CSV" accept=".csv" disabled={busy||locked} onFile={choose}/>
      {file&&<fieldset disabled={busy||locked} className="space-y-5">
        <label className={styles.reportName}>Report Name<input type="text" maxLength={296} value={reportName} onChange={e=>{invalidate();setReportName(e.target.value);}}/></label>
        <div className={styles.fields}>
          <label>Report Type<select value={kind} onChange={e=>{invalidate();setKind(e.target.value as BlastSummaryKind|"");}}><option value="">Choose report type…</option><option value="average">Weekly Average</option><option value="p95">Peak · 95th Percentile</option></select></label>
          <label>Period Start<input type="date" min="2026-09-01" max="2026-12-31" value={start} onChange={e=>{invalidate();setStart(e.target.value);}}/></label>
          <label>Period End<input type="date" min="2026-09-01" max="2026-12-31" value={end} onChange={e=>{invalidate();setEnd(e.target.value);}}/></label>
        </div>
        {kind==="p95"&&<p className="notice">These are Blast’s 95th-percentile results. They will be saved as Peak (95th), separate from true maximums.</p>}
        {selection&&<details className={styles.matches} open={selection.skipped.length>0}><summary>Player Matches · {selection.players.filter(p=>p.included).length} Matched · {selection.skipped.length} Skipped</summary><div className={styles.matchList}>{selection.players.map((p,i)=><label key={p.identity||i} className={styles.matchRow}><span>{p.identity||"Missing Name"}</span><select aria-label={`Match ${p.identity||`row ${i+1}`}`} value={p.included?p.athlete!.athlete_code:""} onChange={e=>{invalidate();setOverrides(prev=>({...prev,[p.identity]:e.target.value}));setExcluded(prev=>e.target.value?prev.filter(n=>n!==p.identity):[...new Set([...prev,p.identity])]);}}><option value="">No Player / Skip</option>{roster.map(a=><option key={a.athlete_code} value={a.athlete_code}>{athleteName(a)} · {a.athlete_code}</option>)}</select></label>)}</div></details>}
        <button type="button" className="btn btn-secondary" onClick={prepare}>Review Report</button>
      </fieldset>}
      {review&&<div className="space-y-4">
        <div><h3>{reportName.trim()}</h3><p className="muted">{kind==="average"?"Weekly Average":"Peak · 95th Percentile"}</p><p className="muted">{blastPeriodLabel(start,end)} · {review.players.filter(p=>p.included).length} Players · {review.rows.length} Readings · {review.skipped.length} Skipped</p></div>
        <div className={styles.reviewList}>{review.players.filter(p=>p.included).map(p=>{
          const rows=review.rows.filter(r=>r.athlete_code===p.athlete!.athlete_code),speed=rows.find(r=>r.unit==="mph"),count=rows.find(r=>r.unit==="count");
          return <details key={p.identity} className={styles.reviewPlayer}><summary><span>{athleteName(p.athlete!)}</span><span className={styles.reviewSummary}>{count?.value??"—"} Swings · {speed?`${formatBlastValue(speed.value,speed.unit)} mph`:"—"} Bat Speed</span></summary><div className={styles.tableWrap}><table><thead><tr><th>Measurement</th><th>{kind==="average"?"Average":"95th Percentile"}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><th scope="row">{row.metric}</th><td>{formatBlastValue(row.value,row.unit)} {blastUnit(row.unit)}</td></tr>)}</tbody></table></div><Link href={`/athletes/${p.athlete!.id}`}>View Profile</Link></details>;
        })}</div>
        <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={busy||locked} onChange={e=>setConfirmed(e.target.checked)}/><span>I checked the report type, dates, player matches and measurements against this export. This report contains only new swings, its dates do not overlap an earlier report of the same type, and it has not already been imported under another file.</span></label>
        <button type="button" className="btn btn-primary" disabled={!confirmed||busy} onClick={save}>{busy?"Saving…":locked?"Retry Reviewed Report":"Save to Profiles"}</button>
        {locked&&!receipt&&<p className="muted">This review is locked for an identical retry. Reload only after checking whether the report was saved.</p>}
      </div>}
      {!file&&!busy&&<button className="btn btn-secondary" onClick={()=>setCustom(true)}>Use a Custom Summary CSV</button>}
    </>}
    {error&&<p className="notice notice-error" role="alert">{error}</p>}
  </section>;
}
