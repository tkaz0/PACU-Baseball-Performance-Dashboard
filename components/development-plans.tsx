import { randomUUID } from "node:crypto";
import { CalendarDays,Check,ClipboardList } from "lucide-react";
import { developmentWeekLabel,developmentWeekStart,featuredDevelopmentPlan,type DevelopmentPlan } from "@/lib/development-plans";
import { DevelopmentPlanForm,DevelopmentDrillCheck } from "@/components/development-plan-forms";
import styles from "./development-plans.module.css";

function PlanCard({plan,staff,canComplete}:{plan:DevelopmentPlan;staff:boolean;canComplete:boolean}){
  const completed=plan.drills.filter(drill=>drill.completedAt).length;
  return <article className={`${styles.card} ${plan.archived?styles.archived:""}`}>
    <div className={styles.cardTop}><span className={styles.week}><CalendarDays size={14}/>{developmentWeekLabel(plan.weekStart)}</span>{staff&&<span className={styles.badge}>{plan.archived?"Archived":plan.shared?"Shared With Player":"Staff Draft"}</span>}</div>
    <h3>{plan.focus}</h3>
    <div className={styles.progressRow}><div className={styles.progress} role="progressbar" aria-label="Completed drills" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={plan.drills.length}><span style={{width:`${completed/plan.drills.length*100}%`}}/></div><span>{completed}/{plan.drills.length} Done</span></div>
    <ul className={styles.drills}>{plan.drills.map((drill,index)=><li key={drill.id}><span className={`${styles.drillNumber} ${drill.completedAt?styles.completeNumber:""}`}>{drill.completedAt?<Check size={15} aria-label="Completed"/>:index+1}</span><div className={styles.drillText}><strong>{drill.title}</strong>{drill.cue&&<p>{drill.cue}</p>}{drill.completedAt&&<span className={styles.completedLabel}>Player marked complete</span>}</div>{canComplete&&!plan.archived&&plan.shared&&<DevelopmentDrillCheck key={`${plan.revision}:${drill.id}:${randomUUID()}`} athleteId={plan.athleteId} planId={plan.id} revision={plan.revision} drill={drill} requestId={randomUUID()}/>}</li>)}</ul>
    {staff&&plan.staffNote&&<div className={styles.note}><span>Coach Note · Staff Only</span><p>{plan.staffNote}</p></div>}
    {staff&&<details className={styles.edit}><summary>Edit Weekly Plan</summary><DevelopmentPlanForm key={`${plan.id}:${plan.revision}:${randomUUID()}`} athleteId={plan.athleteId} planId={plan.id} requestId={randomUUID()} weekStart={plan.weekStart} drillIds={Array.from({length:4},()=>randomUUID())} plan={plan}/></details>}
  </article>;
}
/** Call only with the checked reader projection and trusted presented-role booleans. */
export function WeeklyDevelopmentPlans({plans,athleteId,staff,canComplete,today}:{plans:DevelopmentPlan[];athleteId:string;staff:boolean;canComplete:boolean;today:string}){
  const week=developmentWeekStart(today),visible=staff?plans:plans.filter(plan=>plan.shared&&!plan.archived);
  if(!staff&&!visible.length)return null;
  const featured=featuredDevelopmentPlan(visible,today),others=visible.filter(plan=>plan.id!==featured?.id);
  let newWeek=week;while(visible.some(plan=>plan.weekStart===newWeek)&&newWeek<"2027-12-27")newWeek=new Date(Date.parse(`${newWeek}T12:00:00Z`)+7*86400000).toISOString().slice(0,10);
  const addId=randomUUID();
  // Empty plans stay out of the way: hidden for players, a single compact row for staff.
  if(!visible.length){
    if(!staff)return null;
    return <section className={`${styles.section} ${styles.compact}`} aria-label="Weekly development plans"><div className={styles.compactRow}><ClipboardList size={17} aria-hidden="true"/><strong>Weekly Plan</strong><span>No plan yet</span></div><details className={styles.add}><summary>Add Weekly Plan</summary><DevelopmentPlanForm key={addId} athleteId={athleteId} planId={addId} requestId={randomUUID()} weekStart={newWeek} drillIds={Array.from({length:4},()=>randomUUID())}/></details></section>;
  }
  return <section className={styles.section} aria-label="Weekly development plans">
    <div className={styles.heading}><div className={styles.icon}><ClipboardList size={20}/></div><div><p className={styles.eyebrow}>Player Development</p><h2>Weekly Plan</h2></div>{staff&&<span className={styles.staffHint}>Coach Assigned</span>}</div>
    {featured?<PlanCard plan={featured} staff={staff} canComplete={canComplete}/>:<p className={styles.empty}>Set one focus and a few drills for the week. Share the plan when it is ready.</p>}
    {staff&&visible.length<104&&<details className={styles.add}><summary>Add Weekly Plan</summary><DevelopmentPlanForm key={addId} athleteId={athleteId} planId={addId} requestId={randomUUID()} weekStart={newWeek} drillIds={Array.from({length:4},()=>randomUUID())}/></details>}
    {others.length>0&&<details className={styles.history}><summary>More Weeks <span>{others.length}</span></summary><div className={styles.historyGrid}>{others.map(plan=><PlanCard key={plan.id} plan={plan} staff={staff} canComplete={canComplete}/>)}</div></details>}
  </section>;
}
