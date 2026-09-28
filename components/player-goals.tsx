import { randomUUID } from "node:crypto";
import { Flag, Target } from "lucide-react";
import { PlayerGoalForm } from "@/components/player-goal-form";
import { formatGoalValue, goalDateLabel, playerGoalProgress, type PlayerGoalData, type PlayerNumericGoal } from "@/lib/player-goals";
import styles from "./player-goals.module.css";
function GoalCard({goal,staff}:{goal:PlayerNumericGoal;staff:boolean}){
  const progress=playerGoalProgress(goal),format=(value:number)=>formatGoalValue(value,goal.metricKey,goal.unit,goal.source);
  const label=goal.completedAt?"Coach marked complete":progress.status==="unavailable"?"Starting reading needs review":progress.status==="awaiting"?"Waiting for a newer test":progress.status==="reached"?"Target reached":progress.status==="away"?"Below starting progress":`${Math.round(progress.percent!)}% toward target`;
  return <article className={styles.card}>
    <header><h3>{goal.title}</h3>{staff&&<span>{goal.shared?"Shared":"Staff Only"}</span>}</header>
    <p className={styles.metric}>{goal.metricLabel}</p><p className={styles.source}>{goal.source} · Fall 2026</p>
    <div className={styles.values}><div><span>Starting Point</span><strong>{format(goal.baselineValue)}</strong><small>{goalDateLabel(goal.baselineDate)}</small></div><div><span>{goal.completedAt?"At Completion":"Latest Reading"}</span><strong>{goal.currentValue===null?"—":format(goal.currentValue)}</strong><small>{goal.currentDate?goalDateLabel(goal.currentDate):"Unavailable"}</small></div><div><span>Coach Target</span><strong>{format(goal.targetValue)}</strong><small>{goal.targetDate?`By ${goalDateLabel(goal.targetDate)}`:"No date set"}</small></div></div>
    <div className={styles.progressLabel}><span>{label}</span>{progress.status==="away"&&!goal.completedAt&&<span>{Math.abs(Math.round(progress.percent!))}% behind start</span>}</div>
    {progress.percent!==null?<div role="progressbar" aria-label={`${goal.title}: progress from starting point to coach target`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.barPercent} aria-valuetext={label} className={styles.track}><span style={{width:`${progress.barPercent}%`}}/></div>:<p className={styles.hint}>The original reading changed or is unavailable. A coach can close this goal and choose a fresh starting point.</p>}
    {staff&&goal.staffNote&&<p className={styles.note}>{goal.staffNote}</p>}
    {staff&&<details className={styles.edit}><summary>Edit Goal</summary><PlayerGoalForm athleteId={goal.athleteId} goal={goal}/></details>}
  </article>;
}
export function PlayerGoals({data,athleteId,staff,status}:{data:PlayerGoalData;athleteId:string;staff:boolean;status?:string}){
  // Defense in depth for any server caller composing a Player View as.
  const visible=data.goals.filter(goal=>staff||goal.shared),active=visible.filter(goal=>!goal.completedAt),completed=visible.filter(goal=>goal.completedAt);
  if(!staff&&!visible.length)return null;
  const messages:Record<string,string>={saved:"Goal saved.",invalid:"Check the goal, target, starting point and date.",stale:"This goal or starting reading changed. Review the refreshed values before saving again.","save-error":"Goal was not saved. Check your target and the four-active-goal limit.",unverified:"The save could not be confirmed. Review the current goals before trying again."};
  return <section aria-label="Player goals" className={styles.section}>
    <header className={styles.heading}><div><p>Development</p><h2><Target size={19} aria-hidden="true"/>Goals</h2></div><span>{active.length} Active</span></header>
    {status&&messages[status]&&<p role={status==="saved"?"status":"alert"} className="notice">{messages[status]}</p>}
    {active.length?<div className={styles.grid}>{active.map(goal=><GoalCard key={goal.id} goal={goal} staff={staff}/>)}</div>:staff?<p className={styles.hint}>Choose a recorded result and set a target to track progress.</p>:null}
    {staff&&active.length<4&&<details className={styles.add}><summary><Flag size={14} aria-hidden="true"/>Add Numeric Goal</summary>{data.choices.length?<PlayerGoalForm athleteId={athleteId} choices={data.choices} newId={randomUUID()}/>:<p className={styles.hint}>No supported Fall testing result is available as a starting point. Weekly Blast summaries and game-sheet totals are not goal baselines.</p>}</details>}
    {!!completed.length&&<details className={styles.completed}><summary>Completed Goals · {completed.length}</summary><div className={styles.grid}>{completed.map(goal=><GoalCard key={goal.id} goal={goal} staff={staff}/>)}</div></details>}
  </section>;
}
