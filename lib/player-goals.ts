import { formatHeight, formatMetricNumber } from "@/lib/measurement-display";
export const GOAL_METRIC_KEYS = ["height","weight","grip_strength","grip_dominant","grip_non_dominant","body_fat_pct","muscle_mass","body_score",
  "max_exit_velocity","avg_exit_velocity","bat_speed","max_bat_speed","avg_bat_speed","smash_factor","max_distance",
  "home_to_first","home_to_second","boxer_t","steal_start_12ft","max_pitch_velocity","avg_pitch_velocity","avg_fastball_spin",
  "infield_velocity","outfield_velocity","classified_avg_velocity","classified_max_velocity","classified_avg_spin","classified_max_spin"] as const;
export type GoalMetricKey = typeof GOAL_METRIC_KEYS[number];
export type PlayerGoalChoice = { observationId:string;metricKey:GoalMetricKey;metricLabel:string;source:string;unit:string;value:number;measuredAt:string };
export type PlayerNumericGoal = {
  id:string;athleteId:string;title:string;metricKey:GoalMetricKey;metricLabel:string;source:string;unit:string;period:"fall_2026";
  baselineValue:number;baselineDate:string;baselineValid:boolean;targetValue:number;targetDate:string|null;staffNote:string|null;shared:boolean;
  completedAt:string|null;revision:number;createdAt:string;currentValue:number|null;currentDate:string|null;
};
export type PlayerGoalData = {goals:PlayerNumericGoal[];choices:PlayerGoalChoice[]};
export function formatGoalValue(value:number,metricKey:string,unit:string,source:string){
  return (metricKey==="height"?formatHeight(value,unit):null)??`${formatMetricNumber(value,metricKey,source)} ${unit}`;
}
export type GoalProgress = {percent:number|null;barPercent:number;status:"unavailable"|"awaiting"|"toward"|"away"|"reached";remaining:number|null};
/** Relative to an explicit coach target, never a health threshold or a percentile. */
export function playerGoalProgress(goal:Pick<PlayerNumericGoal,"baselineValue"|"baselineDate"|"baselineValid"|"targetValue"|"currentValue"|"currentDate">):GoalProgress {
  const {baselineValue:baseline,targetValue:target,currentValue:current}=goal;
  if(!goal.baselineValid||current===null||!goal.currentDate||![baseline,target,current].every(Number.isFinite)||target===baseline)
    return {percent:null,barPercent:0,status:"unavailable",remaining:null};
  const percent=(current-baseline)/(target-baseline)*100;
  if(!Number.isFinite(percent))return {percent:null,barPercent:0,status:"unavailable",remaining:null};
  return {percent,barPercent:Math.min(100,Math.max(0,percent)),status:goal.currentDate===goal.baselineDate?"awaiting":percent>=100?"reached":percent<0?"away":"toward",remaining:Math.max(0,(target-current)*Math.sign(target-baseline))};
}
export const goalDateLabel=(value:string)=>new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"});
