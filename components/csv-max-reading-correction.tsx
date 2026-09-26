"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { archiveCsvMaxReading } from "@/app/(workspace)/admin/csv-corrections/actions";
import type { CsvMaxReading, CsvMaxReadingRequest } from "@/lib/csv-max-reading";
import { fullSwingFileLabel } from "@/lib/full-swing-file-label";

function Reading({athleteId,row}:{athleteId:string;row:CsvMaxReading}) {
 const router=useRouter(),[approved,setApproved]=useState(false),[pending,setPending]=useState(false),[attempt,setAttempt]=useState<CsvMaxReadingRequest|null>(null),[message,setMessage]=useState(""),[done,setDone]=useState(false);
 const label=row.metricKey==="classified_max_spin"?"Max Spin":"Max Distance";
 async function remove(){
  if(!approved||pending||done)return;
  const input=attempt??{requestId:crypto.randomUUID(),athleteId,observationId:row.id,fingerprint:row.fingerprint};
  setAttempt(input);setPending(true);setMessage("");
  try {const result=await archiveCsvMaxReading(input,true);if(result.error){setMessage(result.error);return;}
   setDone(true);setMessage("Reading flagged and removed. The original is saved under Removed CSV Results for restoration.");router.refresh();
  }catch {setMessage("The result is uncertain. Refresh and check saved removals before retrying the same request.");}
  finally {setPending(false);}
 }
 return <li className="border-b border-[var(--line-subtle)] py-4 last:border-b-0">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{label} · {row.value.toFixed(1)} {row.unit}</strong><p className="muted mb-0 mt-1 text-xs">{row.source} · {row.measuredAt} · {fullSwingFileLabel(row.sourceFile,"Full Swing · Intrasquad",row.measuredAt)}</p></div>
   <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={approved} onChange={event=>setApproved(event.target.checked)} disabled={pending||done||!!attempt}/>Review this exact reading</label>
  </div>
  {!done&&<button type="button" className="btn btn-secondary mt-3 text-xs" disabled={!approved||pending} onClick={()=>void remove()}>{pending?"Saving…":attempt?"Retry Same Removal":"Flag & Remove Reading"}</button>}
  {message&&<p role={done?"status":"alert"} className={`mt-3 text-xs ${done?"notice":"notice notice-error"}`}>{message}</p>}
 </li>;
}

export function CsvMaxReadingCorrection({athleteId,rows}:{athleteId:string;rows:CsvMaxReading[]}) {
 return <details className="panel my-5 max-w-3xl p-5"><summary className="cursor-pointer font-semibold">Correct a Single Maximum · {rows.length}</summary>
  <p className="muted mt-3 text-sm">Flag one Full Swing maximum while keeping the player’s other readings from that file. The original can be restored below.</p>
  {rows.length?<ul className="m-0 list-none p-0">{rows.map(row=><Reading key={row.id} athleteId={athleteId} row={row}/>)}</ul>:<p className="muted">No eligible maximum readings are saved for this player.</p>}
 </details>;
}
