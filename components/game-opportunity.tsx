import { LimitedSample } from "@/components/limited-sample";
import { gameOpportunityLabel } from "@/lib/game-opportunities";
export function GameOpportunity({source,metric,count}:{source:string;metric:string;count:number|null|undefined}) {
 const label=gameOpportunityLabel(source,metric);
 return label&&count!=null&&count>0?<span className="mt-1 block text-xs font-normal leading-snug tracking-normal text-[var(--text-secondary)] tabular-nums">{count.toLocaleString("en-US")} {label}<br/><LimitedSample count={count} pitching={source==="pitching_fall_2026"}/></span>:null;
}
