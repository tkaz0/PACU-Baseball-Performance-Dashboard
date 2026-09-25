import type { CoachFocusItem } from "@/lib/coach-focus-server";
import { saveCoachFocus } from "@/app/(workspace)/athletes/[id]/focus-actions";

const dateLabel=(value:string)=>new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"});
function FocusForm({athleteId,item}:{athleteId:string;item?:CoachFocusItem}){
  return <form action={saveCoachFocus} className="grid gap-3 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3 sm:p-4">
    <input type="hidden" name="athleteId" value={athleteId}/><input type="hidden" name="itemId" value={item?.id??""}/>
    <label className="grid gap-1 text-xs font-semibold">Focus <input name="title" maxLength={120} required defaultValue={item?.title??""} placeholder="e.g. Repeat home-to-first test" className="w-full"/></label>
    <label className="grid gap-1 text-xs font-semibold">Coach Note <span className="font-normal text-[var(--text-secondary)]">(staff only)</span><textarea name="note" maxLength={600} rows={2} defaultValue={item?.staffNote??""} placeholder="Optional coaching context" className="w-full"/></label>
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3"><label className="grid gap-1 text-xs font-semibold">Retest By <input type="date" name="targetDate" min="2026-09-01" max="2027-12-31" defaultValue={item?.targetDate??""}/></label>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="shared" defaultChecked={item?.shared??false}/>Share this focus with player</label>
      {item&&<label className="flex items-center gap-2 text-xs"><input type="checkbox" name="completed" defaultChecked={!!item.completedAt}/>Completed</label>}</div>
    <button className="btn btn-primary justify-self-start" type="submit">{item?"Save Focus":"Add Focus"}</button>
  </form>;
}
export function CoachFocusItems({items,athleteId,staff,status}:{items:CoachFocusItem[];athleteId:string;staff:boolean;status?:string}){
  const active=items.filter(item=>!item.completedAt),completed=items.filter(item=>item.completedAt);
  if(!staff&&!active.length)return null;
  return <section aria-label="Coach focus" className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-4 sm:p-5">
    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--accent-readable)]">Development</p><h2 className="m-0 text-lg font-bold">Coach Focus</h2><p className="mb-0 mt-1 text-xs text-[var(--text-secondary)]">{staff?"Keep up to two active priorities per player. Notes stay with the staff; a focus appears to the player only when shared.":"Priorities your coaches have shared with you."}</p>
    {status==="saved"&&<p role="status" className="notice mt-3">Focus saved.</p>}{status==="invalid"&&<p role="alert" className="notice mt-3">Check the title, note, and date, then try again.</p>}{status==="save-error"&&<p role="alert" className="notice mt-3">Focus could not be saved. Check that there are no more than two active priorities.</p>}
    {active.length?<div className="mt-4 grid gap-3 sm:grid-cols-2">{active.map(item=><article key={item.id} className="rounded-lg border border-[var(--line-subtle)] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="m-0 text-sm font-bold">{item.title}</h3>{staff&&<span className="rounded-full bg-[var(--surface-raised)] px-2 py-1 text-[10px] font-semibold">{item.shared?"Player Can See":"Staff Only"}</span>}</div>{item.targetDate&&<p className="mb-0 mt-2 text-xs text-[var(--text-secondary)]">Retest by <time dateTime={item.targetDate}>{dateLabel(item.targetDate)}</time></p>}{staff&&item.staffNote&&<p className="mb-0 mt-2 text-xs leading-5 text-[var(--text-secondary)]">{item.staffNote}</p>}{staff&&<details className="mt-3 border-t border-[var(--line-subtle)] pt-2"><summary className="cursor-pointer text-xs font-semibold text-[var(--accent-readable)]">Edit Focus</summary><div className="mt-3"><FocusForm athleteId={athleteId} item={item}/></div></details>}</article>)}</div>:<p className="mb-0 mt-4 text-sm text-[var(--text-secondary)]">No active focus items yet.</p>}
    {staff&&active.length<2&&<details className="mt-4"><summary className="cursor-pointer text-xs font-bold text-[var(--accent-readable)]">Add Coach Focus</summary><div className="mt-3"><FocusForm athleteId={athleteId}/></div></details>}
    {staff&&completed.length>0&&<details className="mt-4 border-t border-[var(--line-subtle)] pt-3"><summary className="cursor-pointer text-xs font-semibold">Completed Focus · {completed.length}</summary><ul className="mb-0 mt-2 list-none space-y-2 p-0 text-xs">{completed.map(item=><li key={item.id}>{item.title}<details className="mt-1"><summary className="cursor-pointer text-[var(--accent-readable)]">Edit</summary><div className="mt-2"><FocusForm athleteId={athleteId} item={item}/></div></details></li>)}</ul></details>}
  </section>;
}
