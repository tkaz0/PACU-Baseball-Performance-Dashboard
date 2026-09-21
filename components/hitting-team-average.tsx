import { blastUnit } from "@/lib/blast-metrics";
import type { HittingTeamAverage } from "@/lib/hitting-team-averages";
export function HittingTeamAverageLine({average}:{average?:HittingTeamAverage}) {
  if(!average)return <p className="mt-2 mb-0 text-xs text-[var(--text-secondary)]">Team Average <span className="ml-1">—</span></p>;
  const method=average.method==="swing_weighted"
    ? `Fall average weighted by ${average.swingCount!.toLocaleString("en-US")} saved swings across ${average.athleteCount} players. Average reports only; paired peak reports are not counted again.`
    : `Mean of each player's latest comparable Fall result from ${average.source.replace("full swing","Full Swing")}. Each player counts equally, including when comparing maximum metrics. This is not a pooled swing average.`;
  return <div className="mt-3 border-t border-[var(--line-subtle)] pt-2" data-testid="hitting-team-average">
    <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]"><span>Team Average</span><strong className="tabular-nums text-[var(--text-primary)]">{average.value.toFixed(1)} {blastUnit(average.unit)}</strong></p>
    <details className="mt-1 text-[10px] leading-4 text-[var(--text-secondary)]"><summary className="cursor-pointer">{average.athleteCount} {average.athleteCount===1?"Player":"Players"}{average.swingCount!==null?` · ${average.swingCount.toLocaleString("en-US")} Swings`:" · Latest Results"}</summary><p className="mt-1 mb-0">{method} Results: {average.firstDate}–{average.lastDate}.</p></details>
  </div>;
}
