import { StatInfo } from "@/components/stat-info";
import type { PlayerMetricReading } from "@/lib/player-performance";
import { leaderboardTestDate } from "@/lib/leaderboards";

export function RenphoBodyScore({ reading }: { reading: PlayerMetricReading | null }) {
  return <section className="panel border-t-4 border-t-pacu-red p-5 sm:p-6" data-testid="renpho-body-score">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-lg font-bold">RENPHO Body Score<StatInfo metric="body_score" label="RENPHO Body Score" /></h2><span className="text-xs text-[var(--text-secondary)]">From Your Report</span></div>
    {reading ? <><div className="my-4 flex items-baseline gap-2"><strong className="text-4xl font-black tabular-nums">{reading.value}</strong><span className="text-sm text-[var(--text-secondary)]">/ 100 points</span></div><p className="mb-0 text-xs text-[var(--text-secondary)]">Last Tested <time dateTime={reading.measuredAt}>{leaderboardTestDate(reading.measuredAt)}</time></p></> : <p className="mb-0 text-sm text-[var(--text-secondary)]">Body Score has not been imported yet. Add the original RENPHO report to read its top-right score.</p>}
  </section>;
}
