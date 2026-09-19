"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setCsvRemoval } from "@/app/(workspace)/admin/csv-corrections/actions";
import type { CsvRemovalReview, CsvRemovalRequest } from "@/lib/csv-removal";
function FileCorrection({athleteId,item,restore=false}:{athleteId:string;item:CsvRemovalReview["active"][number]|CsvRemovalReview["archived"][number];restore?:boolean}) {
 const router=useRouter(),[approved,setApproved]=useState(false),[pending,setPending]=useState(false),[attempt,setAttempt]=useState<CsvRemovalRequest|null>(null),[message,setMessage]=useState(""),[done,setDone]=useState(false);
 async function submit(){
  if(!approved || pending || done)return;
  const input=attempt??{requestId:"requestId" in item?item.requestId:crypto.randomUUID(),athleteId,fileHash:item.fileHash,fingerprint:item.fingerprint,restore};
  setAttempt(input);setPending(true);setMessage("");
  try {const result=await setCsvRemoval(input,true);if(result.error){setMessage(result.error);return;}setDone(true);setMessage(`${result.receipt!.count} readings ${restore?"restored":"removed"}.`);router.refresh();}
  catch {setMessage("The result is uncertain. Retry this same request or refresh to check saved removals.");}finally{setPending(false);}
 }
 return <section className="panel my-4 p-5"><h3 className="m-0 break-words text-base font-bold">{item.sourceFile}</h3><p className="muted text-sm">{item.count} readings{"firstDate" in item?` · ${item.firstDate}${item.lastDate!==item.firstDate?` to ${item.lastDate}`:""}`:" · Removed from the dashboard"}</p>
 {!done&&<><label className="mb-4 flex items-start gap-3 text-sm"><input type="checkbox" checked={approved} disabled={pending||!!attempt} onChange={e=>setApproved(e.target.checked)}/><span>I reviewed this player and file. {restore?"Restore the saved readings to this player.":"Remove only this file’s readings from this player."}</span></label><button className="btn btn-secondary" disabled={!approved||pending} onClick={()=>void submit()}>{pending?"Saving…":restore?"Restore Readings":attempt?"Retry Same Removal":"Remove CSV Readings"}</button></>}
 {message&&<p className={`mt-4 text-sm ${done?"notice":"notice notice-error"}`} role={done?"status":"alert"}>{message}</p>}</section>;
}
export function CsvRemoval({athleteId,review}:{athleteId:string;review:CsvRemovalReview}) {
 return <div className="max-w-3xl"><h2 className="mt-8 text-lg font-semibold">Current CSV Results</h2>{review.active.length?review.active.map(item=><FileCorrection key={`${item.fileHash}:${item.fingerprint}`} athleteId={athleteId} item={item}/>):<p className="notice">No Full Swing CSV results are assigned to this player.</p>}
 {review.archived.some(item=>!item.restored)&&<><h2 className="mt-8 text-lg font-semibold">Removed CSV Results</h2>{review.archived.filter(item=>!item.restored).map(item=><FileCorrection key={item.requestId} athleteId={athleteId} item={item} restore/>)}</>}</div>;
}
