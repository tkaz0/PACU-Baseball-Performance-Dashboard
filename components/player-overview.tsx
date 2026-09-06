import { ArrowUpRight, Crosshair, TrendingUp, ChevronDown } from "lucide-react";
import type { PlayerMetricCard } from "@/lib/player-performance";
import { getPlayerInsights, type PlayerRelativeInsight } from "@/lib/player-insights";
import { leaderboardMetricLabel, leaderboardTestDate } from "@/lib/leaderboards";

function RelativeResults({ items }: { items: PlayerRelativeInsight[] }) {
  return <ul className="m-0 list-none space-y-5 p-0">{items.map(item => <li key={item.metric.key}>
    <div className="flex items-baseline justify-between gap-3"><h3 className="m-0 min-w-0 text-sm font-bold">{leaderboardMetricLabel(item.metric)}</h3><span className="shrink-0 text-xl font-bold tabular-nums">{Math.round(item.percentile.value)}<span className="muted ml-1 text-[10px] font-medium">PCTL</span></span></div>
    <p className="muted mb-2 mt-1 text-xs"><span className="break-all">{String(item.latest.value)}</span> {item.latest.unit === "ratio" ? "" : item.latest.unit} · <time dateTime={item.latest.measuredAt}>{leaderboardTestDate(item.latest.measuredAt)}</time></p>
    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-raised)]" aria-hidden="true"><div className="h-full rounded-full bg-[var(--accent-readable)]" style={{ width: `${item.percentile.value}%` }} /></div>
    <p className="muted mb-0 mt-2 text-[11px]">{Math.round(item.percentile.value)} percentile · {item.percentile.sampleSize} comparable players</p>
  </li>)}</ul>;
}

function compactNumber(value: number): string {
  if (value > 0 && value < 0.1) return "<0.1";
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function PlayerOverview({ cards }: { cards: readonly PlayerMetricCard[] }) {
  const insights = getPlayerInsights(cards);
  return <section aria-label="Player overview" className="space-y-5" data-testid="player-overview">
    <p className="muted m-0 text-sm">Your strengths, areas to improve, and progress over time.</p>
    <div className="grid items-start gap-4 xl:grid-cols-3">
      {[
        { title: "Strengths", icon: TrendingUp, items: insights.strengths, note: "Top quarter of comparable team results", empty: "No measured results are in the top quarter right now." },
        { title: "Weaknesses", icon: Crosshair, items: insights.weaknesses, note: "Bottom quarter of comparable team results", empty: "No measured results are in the bottom quarter right now." },
      ].map(({ title, icon: Icon, items, note, empty }) => <section className="panel h-full p-5 sm:p-6" key={title} aria-label={title}>
        <div className="mb-3 flex items-center gap-2.5"><Icon size={19} className="text-[var(--accent-readable)]" aria-hidden="true" /><h2 className="m-0 text-lg font-bold">{title}</h2></div>
        {items.length ? <><p className="muted mb-5 text-xs">{note}</p><RelativeResults items={items} /></> : <p className="muted m-0 text-sm leading-relaxed">{insights.comparableMetricCount ? empty : "Waiting for comparable team testing."}</p>}
      </section>)}
      <section className="panel h-full p-5 sm:p-6" aria-label="Biggest jumps">
        <div className="mb-3 flex items-center gap-2.5"><ArrowUpRight size={19} className="text-[var(--accent-readable)]" aria-hidden="true" /><h2 className="m-0 text-lg font-bold">Biggest Jumps</h2></div>
        {insights.biggestJumps.length ? <><p className="muted mb-5 text-xs">Largest gains since the previous comparable test</p><ul className="m-0 list-none space-y-5 p-0">{insights.biggestJumps.map(item => <li key={item.metric.key}>
          <h3 className="m-0 text-sm font-bold">{leaderboardMetricLabel(item.metric)}</h3>
          <p className="mb-1 mt-2 text-xl font-bold tabular-nums text-[var(--accent-readable)]" title={`Relative improvement: ${item.relativeImprovementPercent}%`}>{compactNumber(item.relativeImprovementPercent)}% <span className="text-xs font-semibold">improvement</span></p>
          <p className="mb-1 mt-0 break-words text-sm font-semibold tabular-nums" title={`Exact change: ${item.change} ${item.changeUnit === "pp" ? "percentage points" : item.changeUnit}`}>{String(item.previous.value)} → {String(item.latest.value)} {item.latest.unit === "ratio" ? "" : item.latest.unit}</p>
          <p className="muted mb-0 text-[11px]"><time dateTime={item.previous.measuredAt}>{leaderboardTestDate(item.previous.measuredAt)}</time> → <time dateTime={item.latest.measuredAt}>{leaderboardTestDate(item.latest.measuredAt)}</time></p>
        </li>)}</ul></> : <p className="muted m-0 text-sm leading-relaxed">Improvements will appear after repeat testing shows a gain.</p>}
      </section>
    </div>
    {!insights.comparableMetricCount && <p className="muted m-0 text-xs">Strengths and weaknesses need at least five players with matching tests. Your recorded measurements are available in the tabs above.</p>}
    <details className="group text-xs text-[var(--text-secondary)]"><summary className="flex w-fit cursor-pointer items-center gap-2 font-semibold">How This Overview Works<ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
      <div className="mt-3 max-w-3xl space-y-2 leading-relaxed">
        <p>Strengths are at or above the 75th Pacific percentile; weaknesses are at or below the 25th. Each comparison uses the same test, source, unit and testing period, with at least five comparable players. Up to three results appear in each section.</p>
        <p>Biggest jumps compare the latest result with the previous testing date for the same measurement, source, unit and period. Gains are ordered by relative percentage improvement; higher or lower values count as improvement according to the test. A percentage improvement is relative to the previous value, not a percentage-point change. Displayed improvement percentages are rounded to one decimal.</p>
        <p>Height, weight, body composition and fastball spin stay descriptive in their own tabs. They are not labeled strengths, weaknesses or improvements. These highlights summarize recorded testing results.</p>
      </div>
    </details>
  </section>;
}
