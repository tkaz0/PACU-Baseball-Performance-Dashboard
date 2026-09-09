import { PLAYER_METRICS } from "@/lib/player-performance";

export type AnalyticsPlayer = { id: string; code: string; name: string; academicClass: string; position: string; playerType: string; bats: string; throws: string };
export type AnalyticsReading = { id: string; athleteId: string; metric: string; label: string; unit: string; source: string; date: string; value: number; importedAt: string };
export type AnalyticsDataset = { players: AnalyticsPlayer[]; readings: AnalyticsReading[] };
export type AnalyticsVariable = { key: string; metric: string; label: string; unit: string; source: string; count: number };
export type AnalyticsPoint = { player: AnalyticsPlayer; x: AnalyticsReading; y: AnalyticsReading; gap: number };
export type ColorGroup = "academicClass" | "position" | "playerType" | "bats" | "throws" | "team";
export const COLOR_GROUPS: { key: ColorGroup; label: string }[] = [{key:"academicClass",label:"Class"},{key:"position",label:"Primary Position"},{key:"playerType",label:"Player Type"},{key:"bats",label:"Bats"},{key:"throws",label:"Throws"},{key:"team",label:"Team"}];
const body = new Set(["body_fat_mass","bone_mass","protein_mass","body_water_mass","skeletal_muscle_mass","bmi","bmr","fat_free_mass","subcutaneous_fat_pct","skeletal_muscle_pct","body_water_pct","protein_pct","metabolic_age","visceral_fat","smi","whr","bone_mass_pct",...PLAYER_METRICS.filter(m=>m.group==="body").map(m=>m.key)]);
export const variableKey = (row: AnalyticsReading) => JSON.stringify([row.metric,row.unit,row.source.trim().toLowerCase().replace(/\s+/g," ")]);
export const prettyGroup = (value: string) => value.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
export const pointGroup = (player: AnalyticsPlayer, group: ColorGroup) => group === "team" ? "Pacific" : prettyGroup(player[group] || "Not listed");
export function readingsForPeriod(readings: readonly AnalyticsReading[], period: "fall" | "earlier"): AnalyticsReading[] {
  return readings.filter(row=>period==="fall" ? row.date>="2026-09-01"&&row.date<="2026-12-31" : body.has(row.metric)&&row.date>="2026-06-01"&&row.date<="2026-08-31");
}
/** One latest observation per player/metric/source/unit. Date first, then import time and immutable ID. */
export function latestAnalyticsReadings(readings: readonly AnalyticsReading[]): AnalyticsReading[] {
  const latest=new Map<string,AnalyticsReading>();
  for(const row of readings){const key=JSON.stringify([row.athleteId,variableKey(row)]),old=latest.get(key);if(!old||row.date>old.date||(row.date===old.date&&(row.importedAt>old.importedAt||(row.importedAt===old.importedAt&&row.id>old.id))))latest.set(key,row);}
  return [...latest.values()];
}
export function analyticsVariables(readings: readonly AnalyticsReading[]): AnalyticsVariable[] {
  const variables=new Map<string,AnalyticsVariable>();
  for(const row of latestAnalyticsReadings(readings)){const key=variableKey(row),old=variables.get(key);if(old)old.count++;else variables.set(key,{key,metric:row.metric,label:PLAYER_METRICS.find(m=>m.key===row.metric)?.label??row.label,unit:row.unit,source:row.source,count:1});}
  return [...variables.values()].sort((a,b)=>a.label.localeCompare(b.label)||a.unit.localeCompare(b.unit)||a.source.localeCompare(b.source));
}
export function pairAnalytics(players: readonly AnalyticsPlayer[], readings: readonly AnalyticsReading[], xKey: string, yKey: string, maxGap: number) {
  const x=new Map<string,AnalyticsReading>(),y=new Map<string,AnalyticsReading>();
  for(const row of latestAnalyticsReadings(readings)){const key=variableKey(row);if(key===xKey)x.set(row.athleteId,row);if(key===yKey)y.set(row.athleteId,row);}
  const points:AnalyticsPoint[]=[],excluded:{player:AnalyticsPlayer;reason:string}[]=[];
  for(const player of players){const a=x.get(player.id),b=y.get(player.id);if(!a||!b){excluded.push({player,reason:!a&&!b?"Missing both measurements":!a?"Missing X measurement":"Missing Y measurement"});continue;}
    const gap=Math.round(Math.abs(Date.parse(a.date)-Date.parse(b.date))/86400000);
    if(gap>maxGap){excluded.push({player,reason:`Test dates are ${gap} days apart`});continue;}
    points.push({player,x:a,y:b,gap});}
  return {points,excluded};
}
export type LinearFit = { r: number|null; rSquared: number|null; slope: number; meanX:number;meanY:number };
/** Centered, scaled least squares; no regression claims with fewer than five paired players. */
export function linearFit(points: readonly {x:number;y:number}[]): LinearFit|null {
  if(points.length<5||new Set(points.map(p=>p.x)).size<2||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
  const scaleX=Math.max(...points.map(p=>Math.abs(p.x)),1),scaleY=Math.max(...points.map(p=>Math.abs(p.y)),1);
  const xs=points.map(p=>p.x/scaleX),ys=points.map(p=>p.y/scaleY),mx=xs.reduce((s,x)=>s+x,0)/points.length,my=ys.reduce((s,y)=>s+y,0)/points.length;
  let xx=0,yy=0,xy=0;for(let i=0;i<xs.length;i++){const dx=xs[i]-mx,dy=ys[i]-my;xx+=dx*dx;yy+=dy*dy;xy+=dx*dy;}
  if(xx===0)return null;const constantY=new Set(points.map(p=>p.y)).size<2;const slope=constantY?0:(xy/xx)*(scaleY/scaleX),r=constantY||yy===0?null:Math.max(-1,Math.min(1,(xy/Math.sqrt(xx))/Math.sqrt(yy)));
  const fit={r,rSquared:r===null?null:r*r,slope,meanX:mx*scaleX,meanY:my*scaleY};
  return Object.values(fit).every(value=>value===null||Number.isFinite(value))?fit:null;
}
export function chartDomain(values: number[]): [number,number] {
  if(!values.length)return [0,1];const min=Math.min(...values),max=Math.max(...values),padding=(max-min||Math.abs(max)||1)*.1;
  const low=min-padding,high=max+padding,rawStep=(high-low)/4;
  const magnitude=10**Math.floor(Math.log10(rawStep));
  const step=[1,2,2.5,5,10].map(n=>n*magnitude).find(n=>n>=rawStep)??rawStep;
  return [Math.floor(low/step)*step,Math.ceil(high/step)*step];
}
