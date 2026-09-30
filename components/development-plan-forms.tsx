"use client";
import { useActionState,useState } from "react";
import { useRouter } from "next/navigation";
import { Check,RotateCcw } from "lucide-react";
import { saveDevelopmentPlan,completeDevelopmentDrill } from "@/app/(workspace)/athletes/[id]/development-actions";
import { DEVELOPMENT_INITIAL_STATE,DEVELOPMENT_MAX_DRILLS,type DevelopmentPlan,type DevelopmentDrill,type DevelopmentActionState } from "@/lib/development-plans";
import styles from "./development-plans.module.css";
function SaveStatus({state}:{state:DevelopmentActionState}){const router=useRouter();if(state.status==="idle")return null;return <div role={state.status==="saved"?"status":"alert"} className={styles.status}><span>{state.message}</span>{["stale","error","unverified"].includes(state.status)&&<button type="button" className="btn btn-secondary" onClick={()=>router.refresh()}>Refresh Plan</button>}</div>;}
export function DevelopmentPlanForm({athleteId,planId,requestId,weekStart,drillIds,plan}:{athleteId:string;planId:string;requestId:string;weekStart:string;drillIds:string[];plan?:DevelopmentPlan}){
  const [state,action,pending]=useActionState(saveDevelopmentPlan,DEVELOPMENT_INITIAL_STATE);
  const [drills,setDrills]=useState<Pick<DevelopmentDrill,"id"|"title"|"cue">[]>(plan?.drills.map(({id,title,cue})=>({id,title,cue}))??[{id:drillIds[0],title:"",cue:null}]);
  const blocked=pending||["saved","error","unverified","stale"].includes(state.status);
  const change=(index:number,key:"title"|"cue",value:string)=>setDrills(items=>items.map((item,i)=>i===index?{...item,[key]:value}:item));
  return <form action={action} className={styles.form}>
    <input type="hidden" name="athleteId" value={athleteId}/><input type="hidden" name="planId" value={planId}/><input type="hidden" name="requestId" value={requestId}/><input type="hidden" name="revision" value={plan?.revision??0}/><input type="hidden" name="drills" value={JSON.stringify(drills.map(item=>({...item,title:item.title.trim(),cue:item.cue?.trim()||null})))}/>
    <fieldset disabled={blocked}>
      <div className={styles.formTop}><label>Week Starting Monday<input type="date" name="weekStart" min="2026-08-31" max="2027-12-27" step="7" required readOnly={!!plan} defaultValue={plan?.weekStart??weekStart}/></label><label>Weekly Focus<input name="focus" maxLength={120} required defaultValue={plan?.focus??""} placeholder="Enter the player's focus"/></label></div>
      <div className={styles.drillEditor}>{drills.map((drill,index)=><div key={drill.id} className={styles.drillFields}><div className={styles.drillFormHeading}><span>Drill {index+1}</span>{drills.length>1&&<button type="button" onClick={()=>setDrills(items=>items.filter(item=>item.id!==drill.id))}>Remove</button>}</div><label>Drill Name<input required maxLength={120} value={drill.title} onChange={event=>change(index,"title",event.target.value)}/></label><label>Coaching Cue <span>(optional · player can see)</span><input maxLength={300} value={drill.cue??""} onChange={event=>change(index,"cue",event.target.value)}/></label></div>)}</div>
      {drills.length<DEVELOPMENT_MAX_DRILLS&&<button type="button" className="btn btn-secondary" onClick={()=>{const id=drillIds.find(candidate=>!drills.some(drill=>drill.id===candidate));if(id)setDrills(items=>[...items,{id,title:"",cue:null}]);}}>Add Drill</button>}
      <label>Coach Note <span>(staff only)</span><textarea name="staffNote" maxLength={600} rows={2} defaultValue={plan?.staffNote??""}/></label>
      {plan&&plan.drills.some(drill=>drill.completedAt)&&<p className={styles.hint}>Changing a completed drill’s name or cue clears its check so the player can complete the updated drill.</p>}
      <label className={styles.checkbox}><input type="checkbox" name="shared" defaultChecked={plan?.shared??false}/>Share this plan with the player</label>
      {plan&&<label className={styles.checkbox}><input type="checkbox" name="archived" defaultChecked={plan.archived}/>Archive this plan (hide from player)</label>}
      <button className="btn btn-primary" type="submit">{pending?"Saving…":plan?"Save Changes":"Save Weekly Plan"}</button>
    </fieldset><SaveStatus state={state}/>
  </form>;
}
export function DevelopmentDrillCheck({athleteId,planId,revision,drill,requestId}:{athleteId:string;planId:string;revision:number;drill:DevelopmentDrill;requestId:string}){
  const [state,action,pending]=useActionState(completeDevelopmentDrill,DEVELOPMENT_INITIAL_STATE);
  return <form action={action} className={styles.completionForm}>
    <input type="hidden" name="athleteId" value={athleteId}/><input type="hidden" name="planId" value={planId}/><input type="hidden" name="revision" value={revision}/><input type="hidden" name="requestId" value={requestId}/><input type="hidden" name="drillId" value={drill.id}/><input type="hidden" name="completed" value={drill.completedAt?"false":"true"}/>
    <button type="submit" className={`${styles.checkButton} ${drill.completedAt?styles.checked:""}`} disabled={pending||state.status!=="idle"} aria-label={`${drill.completedAt?"Reopen":"Complete"} ${drill.title}`} title={drill.completedAt?"Reopen Drill":"Mark Complete"}>{pending?<span>…</span>:drill.completedAt?<RotateCcw size={16}/>:<Check size={16}/>}<span>{pending?"Saving…":drill.completedAt?"Undo":"Done"}</span></button>
    <SaveStatus state={state}/>
  </form>;
}
