"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { readImportFile } from "@/lib/imports/files";
import { selectTable } from "@/lib/imports/engine";
import { summarizeFullSwingSession, type FullSwingSession } from "@/lib/imports/full-swing-session";
import { type PitchAssignmentSnapshot } from "@/lib/imports/pitch-assignments";
import { loadPitchAssignments } from "@/app/(workspace)/imports/actions";
import { reclassifyLegacyPitch, restoreLegacyPitch } from "@/app/(workspace)/admin/csv-corrections/pitch-actions";
import { verifyLegacyPitchFile, type LegacyPitchReview, type LegacyPitchHistory, type ReclassifyPitchRequest, type RestorePitchRequest } from "@/lib/legacy-pitch-reclassification";
import { fullSwingFileLabel } from "@/lib/full-swing-file-label";

function Reclassify({ athleteId, item }: { athleteId: string; item: LegacyPitchReview }) {
  const router = useRouter();
  const [loaded,setLoaded] = useState<{hash:string;session:FullSwingSession;labels:PitchAssignmentSnapshot}|null>(null);
  const [identity,setIdentity] = useState("");
  const [approved,setApproved] = useState(false), [pending,setPending] = useState(false), [message,setMessage] = useState(""), [done,setDone] = useState(false);
  const [attempt,setAttempt] = useState<ReclassifyPitchRequest|null>(null);
  let rows: number[] = [], problem = "";
  if (loaded && identity) {
    try { rows = verifyLegacyPitchFile(item,loaded.hash,loaded.session,loaded.labels,identity); }
    catch (error) { problem = error instanceof Error ? error.message : "Review the original report."; }
  }
  async function open(file?: File) {
    if (!file || attempt) return;
    setPending(true); setLoaded(null); setIdentity(""); setApproved(false); setMessage("");
    try {
      const input = await readImportFile(file);
      if (input.fileHash !== item.fileHash || input.sheets.length !== 1 || !file.name.toLowerCase().endsWith('.csv')) throw new Error("Choose this report’s exact original Full Swing CSV.");
      const session = summarizeFullSwingSession(selectTable(input.sheets[0].matrix,0));
      const labels = await loadPitchAssignments(input.fileHash);
      if ("error" in labels) throw new Error(labels.error);
      setLoaded({ hash:input.fileHash,session,labels });
    } catch (error) { setMessage(error instanceof Error ? error.message : "The CSV could not be checked."); }
    finally { setPending(false); }
  }
  async function save() {
    if (!approved || pending || done || !rows.length) return;
    const input = attempt ?? {requestId:crypto.randomUUID(),athleteId,fileHash:item.fileHash,fingerprint:item.fingerprint,sourceRows:rows};
    setAttempt(input); setPending(true); setMessage("");
    try {
      const result = await reclassifyLegacyPitch(input,true);
      if (result.error) {setMessage(result.error);return;}
      setDone(true); setMessage("Saved as 4-Seam Fastball. All velocity, spin, and sample results were preserved."); router.refresh();
    } catch {setMessage("The save is uncertain. Refresh and check Pitch Label History before retrying the same request.");}
    finally {setPending(false);}
  }
  const pitchers = loaded ? [...new Set(loaded.session.pitches.map(p=>p.identity))] : [];
  return <section className="rounded-xl border border-[var(--line-subtle)] p-4" aria-label="Review unspecified pitch">
    <h3 className="m-0 text-base font-semibold">{fullSwingFileLabel(item.sourceFile,item.source,item.date)}</h3>
    <p className="muted my-2 text-sm">{item.date} · Unspecified Pitch → 4-Seam Fastball</p>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{([
      ['classified_avg_velocity','Average Velocity'],['classified_max_velocity','Max Velocity'],['classified_avg_spin','Average Spin'],['classified_max_spin','Max Spin']
    ] as const).map(([key,label])=>{const metric=item.metrics.find(m=>m.metricKey===key)!;return <div key={key}><span className="muted text-xs">{label}</span><p className="m-0 font-semibold tabular-nums">{metric.value.toFixed(1)} <small>{metric.unit}</small></p></div>;})}</div>
    {!done && <fieldset disabled={pending || !!attempt} className="mt-4 space-y-3">
      <label className="block text-sm">Original Full Swing CSV<input type="file" accept=".csv" onChange={e=>void open(e.target.files?.[0])}/></label>
      {loaded && <label className="block text-sm">Match this profile to the export pitcher<select value={identity} onChange={e=>{setIdentity(e.target.value);setApproved(false);}}><option value="">Choose the pitcher…</option>{pitchers.map(p=><option key={p} value={p}>{p}</option>)}</select></label>}
      {problem && <p role="alert" className="notice notice-error text-sm">{problem}</p>}
      {!!rows.length && <><p role="status" className="notice text-sm">Original CSV verified: {rows.length} pitches and all 7 saved results match.</p><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/><span>I reviewed this player and confirm these pitches are 4-seam fastballs.</span></label></>}
    </fieldset>}
    {!done && <button type="button" className="btn btn-primary mt-4" disabled={!approved || !rows.length || pending} onClick={()=>void save()}>{pending?'Checking…':attempt?'Retry Same Pitch Correction':'Save as 4-Seam Fastball'}</button>}
    {message && <p role={done?'status':'alert'} className={`mt-3 text-sm notice ${done?'':'notice-error'}`}>{message}</p>}
  </section>;
}
function Restore({athleteId,item}:{athleteId:string;item:LegacyPitchHistory}) {
  const router=useRouter(),[approved,setApproved]=useState(false),[pending,setPending]=useState(false),[attempt,setAttempt]=useState<RestorePitchRequest|null>(null),[message,setMessage]=useState('');
  async function restore() {
    if (!approved || pending || !item.canRestore) return;
    const input=attempt??{requestId:crypto.randomUUID(),athleteId,correctionRequestId:item.requestId,fingerprint:item.afterFingerprint};
    setAttempt(input);setPending(true);setMessage('');
    try {const result=await restoreLegacyPitch(input,true);if(result.error){setMessage(result.error);return;}setMessage('Previous labels restored.');router.refresh();}
    catch {setMessage('The restore is uncertain. Refresh Pitch Label History before retrying the same request.');}
    finally {setPending(false);}
  }
  return <li className="border-t border-[var(--line-subtle)] py-4"><strong>{fullSwingFileLabel(item.sourceFile,item.source,item.date)}</strong><p className="muted text-sm">{item.pitchCount} pitches saved as 4-Seam Fastball · {item.date}</p>{item.canRestore?<><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={approved} disabled={pending || !!attempt} onChange={e=>setApproved(e.target.checked)}/><span>Restore the previous unspecified labels for this correction.</span></label><button type="button" className="btn btn-secondary mt-3" disabled={!approved || pending} onClick={()=>void restore()}>{attempt?'Retry Same Restore':'Restore Previous Pitch Labels'}</button></>:<p className="muted text-sm">This report changed after the correction. Review its current results before restoring.</p>}{message && <p role="status" className="notice text-sm">{message}</p>}</li>;
}
export function LegacyPitchReclassification({athleteId,groups,history}:{athleteId:string;groups:LegacyPitchReview[];history:LegacyPitchHistory[]}) {
  if (!groups.length && !history.length) return null;
  return <section className="panel my-5 max-w-3xl space-y-4 p-5" aria-label="Pitch label corrections"><h2 className="m-0 text-lg font-semibold">Correct an Unspecified Pitch</h2><p className="muted text-sm">Confirm a 4-seam classification against the original CSV. Saved numbers and other pitchers stay unchanged.</p>{groups.map(item=><Reclassify key={item.fingerprint} athleteId={athleteId} item={item}/>)}{!!history.length&&<details open><summary className="cursor-pointer font-semibold">Pitch Label History</summary><ul className="m-0 list-none p-0">{history.map(item=><Restore key={item.requestId} athleteId={athleteId} item={item}/>)}</ul></details>}</section>;
}
