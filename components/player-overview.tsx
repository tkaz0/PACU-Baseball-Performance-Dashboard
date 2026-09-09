import { StatInfo } from "@/components/stat-info";
import { PercentileBar, PercentileLegend } from "@/components/percentile-bar";
import { formatHeight } from "@/lib/measurement-display";
import styles from "./percentile-bar.module.css";
import { ArrowUpRight, Crosshair, TrendingUp, ChevronDown } from "lucide-react";
import type { PlayerMetricCard } from "@/lib/player-performance";
import { getPlayerInsights, type PlayerRelativeInsight } from "@/lib/player-insights";
import { leaderboardMetricLabel, leaderboardTestDate } from "@/lib/leaderboards";

function RelativeResults({ items }: { items: PlayerRelativeInsight[] }) {
  return <ul className="m-0 list-none space-y-5 p-0">{items.map(item => <li className="border-t border-[var(--line-subtle)] pt-4 first:border-0 first:pt-0" key={item.metric.key}>
    <div className="flex items-baseline justify-between gap-3"><h3 className="m-0 min-w-0 text-sm font-bold">{leaderboardMetricLabel(item.metric)}<StatInfo metric={item.metric.key} label={leaderboardMetricLabel(item.metric)} /></h3><span className="shrink-0 text-xl font-bold tabular-nums">{Math.round(item.percentile.value)}<span className="muted ml-1 text-[10px] font-medium">PCTL</span></span></div>
    <p className="mb-3 mt-1 text-xs leading-5 text-[var(--text-secondary)]"><span className="break-all font-semibold text-[var(--text-primary)]">{String(item.latest.value)} {item.latest.unit === "ratio" ? "" : item.latest.unit}</span> · <time dateTime={item.latest.measuredAt}>{leaderboardTestDate(item.latest.measuredAt)}</time></p>
    <PercentileBar value={item.percentile.value} sampleSize={item.percentile.sampleSize} label={item.metric.label} />
    <p className="mb-0 mt-2 text-[11px] text-[var(--text-secondary)]">{item.percentile.sampleSize} comparable players</p>
  </li>)}</ul>;
}

function compactNumber(value: number): string {
  if (value > 0 && value < 0.1) return "<0.1";
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function PlayerOverview({ cards }: { cards: readonly PlayerMetricCard[] }) {
  const insights = getPlayerInsights(cards);
  const availableCards = cards.filter(card => card.latest);
  const comparisonCards = availableCards.filter(card => card.percentile && card.percentile.sampleSize >= 5 && Number.isFinite(card.percentile.value) && card.percentile.value >= 0 && card.percentile.value <= 100);
  const lastTested = availableCards.map(card => card.latest!.measuredAt).sort().at(-1);
  const bodyResultsOnly = availableCards.length > 0 && availableCards.every(card => card.metric.group === "body");
  return <section aria-label="Player overview" className="space-y-5" data-testid="player-overview">
    <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4"><div className="max-w-xl"><h2 className="m-0 text-xl font-bold tracking-tight">Performance Snapshot</h2><p className="mb-0 mt-1.5 text-sm leading-6 text-[var(--text-secondary)]">{bodyResultsOnly ? comparisonCards.length ? "Your latest measurements and Pacific team comparisons. Performance highlights will build as testing continues." : "Your body measurements are ready in Physicality. Performance highlights will build as testing continues." : "Strengths, areas to improve, and progress from your latest testing."}</p></div>{lastTested && <dl className="m-0 flex gap-6 rounded-lg bg-[var(--surface-raised)] px-4 py-3 text-xs"><div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Available Metrics</dt><dd className="m-0 mt-1 font-bold tabular-nums">{availableCards.length}</dd></div><div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Last Tested</dt><dd className="m-0 mt-1 font-semibold"><time dateTime={lastTested}>{leaderboardTestDate(lastTested)}</time></dd></div></dl>}</div>
    {comparisonCards.length > 0 && <section aria-label="Pacific percentiles" className="rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-5 sm:p-6">
      <h2 className="mb-2 mt-0 text-lg font-bold">Pacific Percentiles</h2><PercentileLegend />
      <ul className={styles.rows}>{comparisonCards.map(card => {
        const reading = card.latest!, percentile = card.percentile!;
        const value = card.metric.key === "height" ? formatHeight(reading.value, reading.unit) : null;
        return <li className={styles.row} key={card.metric.key}><div><h3>{leaderboardMetricLabel(card.metric)}<StatInfo metric={card.metric.key} label={leaderboardMetricLabel(card.metric)} /></h3><span className="font-bold tabular-nums">{value ?? `${reading.derived ? `≈${reading.value.toFixed(1)}` : String(reading.value)} ${reading.unit === "ratio" ? "" : reading.unit}`}</span><p className={styles.meta}>Last Tested: <time dateTime={reading.measuredAt}>{leaderboardTestDate(reading.measuredAt)}</time> · {reading.source}</p></div><div><PercentileBar value={percentile.value} sampleSize={percentile.sampleSize} label={card.metric.label} descriptive={card.metric.direction === "neutral"} /><p className={styles.meta}>{percentile.sampleSize} comparable Pacific players{card.metric.direction === "neutral" ? " · Measured value, not a rating" : ""}</p></div></li>;
      })}</ul>
    </section>}
    <div className="grid items-stretch gap-4 xl:grid-cols-3">
      {[
        { title: "Strengths", icon: TrendingUp, items: insights.strengths, note: "Top quarter of team results", empty: "No results are in the top quarter right now." },
        { title: "Weaknesses", icon: Crosshair, items: insights.weaknesses, note: "Bottom quarter of team results", empty: "No results are in the bottom quarter right now." },
      ].map(({ title, icon: Icon, items, note, empty }) => <section className="h-full rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-5 sm:p-6" key={title} aria-label={title}>
        <div className="mb-5 flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-raised)] text-[var(--accent-readable)]"><Icon size={18} aria-hidden="true" /></span><div><h2 className="m-0 text-base font-bold">{title}</h2><p className="mb-0 mt-1 text-[11px] text-[var(--text-secondary)]">{note}</p></div></div>
        {items.length ? <RelativeResults items={items} /> : <p className="m-0 min-h-12 text-sm leading-6 text-[var(--text-secondary)]">{insights.comparableMetricCount ? empty : "Waiting for comparable team testing."}</p>}
      </section>)}
      <section className="h-full rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-5 sm:p-6" aria-label="Biggest jumps">
        <div className="mb-5 flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-raised)] text-[var(--accent-readable)]"><ArrowUpRight size={18} aria-hidden="true" /></span><div><h2 className="m-0 text-base font-bold">Biggest Jumps</h2><p className="mb-0 mt-1 text-[11px] text-[var(--text-secondary)]">Progress since your previous test</p></div></div>
        {insights.biggestJumps.length ? <ul className="m-0 list-none space-y-5 p-0">{insights.biggestJumps.map(item => <li className="border-t border-[var(--line-subtle)] pt-4 first:border-0 first:pt-0" key={item.metric.key}>
          <h3 className="m-0 text-sm font-bold">{leaderboardMetricLabel(item.metric)}<StatInfo metric={item.metric.key} label={leaderboardMetricLabel(item.metric)} /></h3>
          <p className="mb-1 mt-2 text-xl font-bold tabular-nums text-[var(--accent-readable)]" title={`Relative improvement: ${item.relativeImprovementPercent}%`}>{compactNumber(item.relativeImprovementPercent)}% <span className="text-xs font-semibold">improvement</span></p>
          <p className="mb-1 mt-0 break-words text-sm font-semibold tabular-nums" title={`Exact change: ${item.change} ${item.changeUnit === "pp" ? "percentage points" : item.changeUnit}`}>{String(item.previous.value)} → {String(item.latest.value)} {item.latest.unit === "ratio" ? "" : item.latest.unit}</p>
          <p className="muted mb-0 text-[11px]"><time dateTime={item.previous.measuredAt}>{leaderboardTestDate(item.previous.measuredAt)}</time> → <time dateTime={item.latest.measuredAt}>{leaderboardTestDate(item.latest.measuredAt)}</time></p>
        </li>)}</ul> : <p className="m-0 min-h-12 text-sm leading-6 text-[var(--text-secondary)]">Repeat testing will highlight your largest gains.</p>}
      </section>
    </div>
    {!insights.comparableMetricCount && <p className="m-0 max-w-3xl text-xs leading-6 text-[var(--text-secondary)]">Highlights appear once at least five players have matching performance tests. Your recorded measurements are available in the tabs above.</p>}
    <details className="group border-t border-[var(--line-subtle)] pt-4 text-xs text-[var(--text-secondary)]"><summary className="flex min-h-8 w-fit cursor-pointer list-none items-center gap-2 font-semibold">How This Overview Works<ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
      <div className="mt-3 max-w-3xl space-y-2 leading-relaxed">
        <p>Strengths are at or above the 75th Pacific percentile; weaknesses are at or below the 25th. Each comparison uses the same test, source, unit and testing period, with at least five comparable players. Up to three results appear in each section.</p>
        <p>Biggest jumps compare the latest result with the previous testing date for the same measurement, source, unit and period. Gains are ordered by relative percentage improvement; higher or lower values count as improvement according to the test. A percentage improvement is relative to the previous value, not a percentage-point change. Displayed improvement percentages are rounded to one decimal.</p>
        <p>Height, weight, body composition and fastball spin stay descriptive throughout the profile. They are not labeled strengths, weaknesses or improvements. These highlights summarize recorded testing results.</p>
      </div>
    </details>
  </section>;
}
