import type { ContactReading } from "@/lib/contact-quality";
import { isLikelyFoul } from "@/lib/likely-foul";
type Bin = { label: string; count: number; share: number };
export type ContactDistribution = { count: number; mean: number; min: number; max: number; p10: number; p90: number; bins: Bin[] };
/** Linear interpolation between ordered observations (R7). Descriptive, never a grade. */
function quantile(sorted: readonly number[], p: number) {
  const index=(sorted.length-1)*p, left=Math.floor(index), fraction=index-left;
  return sorted[left]+fraction*(sorted[Math.ceil(index)]-sorted[left]);
}
function distribution(values: number[], bins: { label:string; accepts:(value:number)=>boolean }[]): ContactDistribution | null {
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  return {count:values.length,mean:values.reduce((sum,n)=>sum+n,0)/values.length,min:sorted[0],max:sorted.at(-1)!,p10:quantile(sorted,.1),p90:quantile(sorted,.9),
    bins:bins.map(bin=>{const count=values.filter(bin.accepts).length;return {label:bin.label,count,share:100*count/values.length};})};
}
/** Both charts use the same complete paired Full Swing contact population. */
export function contactConsistency(rows: readonly ContactReading[],{includeLikelyFouls=false}:{includeLikelyFouls?:boolean}={}) {
  const valid=rows.filter(r=>(includeLikelyFouls||!isLikelyFoul(r))&&Number.isFinite(r.exitVelocity)&&r.exitVelocity>0&&r.exitVelocity<=200&&Number.isFinite(r.launchAngle)&&Math.abs(r.launchAngle)<=90);
  return {exitVelocity:distribution(valid.map(r=>r.exitVelocity),[
    {label:"Below 70",accepts:v=>v<70},...[[70,80],[80,90],[90,100],[100,110]].map(([lo,hi])=>({label:`${lo}–<${hi}`,accepts:(v:number)=>v>=lo&&v<hi})),{label:"110+",accepts:v=>v>=110},
  ]),launchAngle:distribution(valid.map(r=>r.launchAngle),[
    {label:"Below −10°",accepts:v=>v< -10},{label:"−10–<8°",accepts:v=>v>=-10&&v<8},{label:"8–32°",accepts:v=>v>=8&&v<=32},{label:">32–<50°",accepts:v=>v>32&&v<50},{label:"50°+",accepts:v=>v>=50},
  ])};
}
