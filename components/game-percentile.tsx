import { PercentileBar } from "@/components/percentile-bar";
import { gameDirection, type GameComparison } from "@/lib/game-metrics";
export function GamePercentile({comparison,label}:{comparison?:GameComparison;label:string}){
 if(!comparison||comparison.percentile===null||comparison.sampleSize<5)return null;
 return <div className="mt-4 border-t border-[var(--line-subtle)] pt-4"><div className="mb-2 flex flex-wrap justify-between gap-1 text-[11px] text-[var(--text-secondary)]"><span>Pacific n={comparison.sampleSize}</span><span><strong>{Math.round(comparison.percentile)}</strong> percentile</span></div><PercentileBar value={comparison.percentile} sampleSize={comparison.sampleSize} label={label} descriptive={gameDirection(comparison.source,comparison.metric)==="neutral"}/></div>;
}
