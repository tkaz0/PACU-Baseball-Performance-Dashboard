"use client";

import { pitchSourceLabel } from "@/lib/pitch-display";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { saveNumericGoal } from "@/app/(workspace)/athletes/[id]/goal-actions";
import { formatGoalValue, goalDateLabel, type PlayerGoalChoice, type PlayerNumericGoal } from "@/lib/player-goals";
import styles from "./player-goals.module.css";
function SaveButton(){const {pending}=useFormStatus();return <button type="submit" className="btn btn-primary" disabled={pending}>{pending?"Saving…":"Save Goal"}</button>;}
export function PlayerGoalForm({athleteId,newId,choices=[],goal}:{athleteId:string;newId?:string;choices?:readonly PlayerGoalChoice[];goal?:PlayerNumericGoal}){
  const [choiceId,setChoiceId]=useState("");
  const choice=choices.find(item=>item.observationId===choiceId);
  return <form action={saveNumericGoal} className={styles.form}>
    <input type="hidden" name="athleteId" value={athleteId}/><input type="hidden" name="goalId" value={goal?.id??newId??""}/><input type="hidden" name="revision" value={goal?.revision??0}/>
    <input type="hidden" name="baselineValue" value={choice?.value??""}/>
    {!goal&&<label>Recorded Starting Point<select name="baselineId" required value={choiceId} onChange={event=>setChoiceId(event.target.value)}><option value="">Choose a recorded result</option>{choices.map(item=><option key={item.observationId} value={item.observationId}>{item.metricLabel} · {pitchSourceLabel(item.source)} · {formatGoalValue(item.value,item.metricKey,item.unit,item.source)} · {goalDateLabel(item.measuredAt)}</option>)}</select></label>}
    {goal&&<p className={styles.formContext}>{goal.metricLabel} · {pitchSourceLabel(goal.source)}<br/>Starting point: {formatGoalValue(goal.baselineValue,goal.metricKey,goal.unit,goal.source)} · {goalDateLabel(goal.baselineDate)}</p>}
    <label>Goal Name<input name="title" required maxLength={100} defaultValue={goal?.title??""}/></label>
    <div className={styles.formPair}><label>Target {goal?.unit??choice?.unit??""}<input type="number" name="target" required min={0} max={1e9} step="any" defaultValue={goal?.targetValue??""}/></label><label>Target Date <span>(optional)</span><input type="date" name="due" min={goal?.baselineDate??choice?.measuredAt??"2026-09-01"} max="2026-12-31" defaultValue={goal?.targetDate??""}/></label></div>
    <label>Coach Note <span>(staff only)</span><input name="note" maxLength={600} defaultValue={goal?.staffNote??""}/></label>
    <label className={styles.check}><input type="checkbox" name="shared" defaultChecked={goal?.shared??false}/>Share this goal with the player</label>
    {goal&&<label className={styles.check}><input type="checkbox" name="completed" defaultChecked={!!goal.completedAt}/>Coach marked complete</label>}
    <p className={styles.hint}>Progress follows newer dated readings for this exact metric, source and unit. Targets are set by the coach.</p>
    <SaveButton/>
  </form>;
}
