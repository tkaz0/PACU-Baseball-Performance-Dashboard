export const WEEKLY_SOURCES = [
  {key:"qpa_fall_2026",label:"QPA Hitting · Fall"},
  {key:"pitching_fall_2026",label:"Pitching Stats · Fall"},
  {key:"player_metrics",label:"Player Metrics"},
] as const;
export type WeeklySource = typeof WEEKLY_SOURCES[number]["key"];
export type CheckOutcome = "completed" | "needs_review" | "failed";
export type WeeklySourceCheck = {source:WeeklySource;outcome:CheckOutcome;checkedAt:string};
export type WeeklySourceStatus = {source:WeeklySource;outcome:CheckOutcome|null;checkedAt:string|null;savedAt:string|null};
export const weeklySource = (value:unknown):value is WeeklySource => WEEKLY_SOURCES.some(source=>source.key===value);
export const checkOutcome = (value:unknown):value is CheckOutcome => value==="completed"||value==="needs_review"||value==="failed";
export function parseWeeklySourceChecks(value:unknown):WeeklySourceCheck[] {
  if(!Array.isArray(value)||value.length>WEEKLY_SOURCES.length)throw new Error("Weekly source status could not be verified.");
  const rows=value.map(row=>{
    if(!row||typeof row!=="object"||Array.isArray(row))throw new Error("Weekly source status could not be verified.");
    const item=row as Record<string,unknown>;
    if(!weeklySource(item.source)||!checkOutcome(item.outcome)||typeof item.checked_at!=="string"||!Number.isFinite(Date.parse(item.checked_at)))throw new Error("Weekly source status could not be verified.");
    return {source:item.source,outcome:item.outcome,checkedAt:item.checked_at};
  });
  if(new Set(rows.map(row=>row.source)).size!==rows.length)throw new Error("Weekly source status could not be verified.");
  return rows;
}
