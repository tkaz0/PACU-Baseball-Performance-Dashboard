import { pitchingPeriodLabel } from "@/lib/game-source";
import { ProfileTrendChart } from "@/components/profile-trend-chart";
import { profileTrends } from "@/lib/profile-trends";
import { MeasurementChange } from "@/components/measurement-change";
import { playerRenphoChange } from "@/lib/measurement-change";
import { StatInfo } from "@/components/stat-info";
import { PercentileBar, PercentileLegend } from "@/components/percentile-bar";
import { GameOpportunity } from "@/components/game-opportunity";
import { gameOverviewMetrics, type GameOverviewMetric } from "@/lib/game-overview";
import { gameValue, type GameComparison } from "@/lib/game-metrics";
import type { SharedGameStat } from "@/lib/game-server";
import styles from "./percentile-bar.module.css";
import { ArrowUpRight, Crosshair, TrendingUp, ChevronDown } from "lucide-react";
import type { PlayerMetricCard } from "@/lib/player-performance";
import { getPlayerInsights, type PlayerRelativeInsight } from "@/lib/player-insights";
import { leaderboardMetricLabel, leaderboardTestDate } from "@/lib/leaderboards";

type OverviewInsight = { key: string; metric: string; label: string; value: string; percentile: number; sampleSize: number; date: string; context: string; game?: GameOverviewMetric };
function testingInsight(item: PlayerRelativeInsight): OverviewInsight {
  return { key: `test:${item.metric.key}`, metric: item.metric.key, label: leaderboardMetricLabel(item.metric), value: `${item.latest.unit === "s" ? item.latest.value.toFixed(2) : item.latest.value} ${item.latest.unit === "ratio" ? "" : item.latest.unit}`, percentile: item.percentile.value, sampleSize: item.percentile.sampleSize, date: item.latest.measuredAt, context: "Last Tested" };
}
function gameInsight(item: GameOverviewMetric): OverviewInsight {
  return { key: `game:${item.source}:${item.metric}`, metric: item.metric, label: item.label, value: gameValue(item.value, item.unit), percentile: item.comparison!.percentile!, sampleSize: item.comparison!.sampleSize, date: gameDate(item.updatedAt), context: item.source === "qpa_fall_2026" ? "QPA · Updated" : `Pitching ${pitchingPeriodLabel(item.eventId,item.playedOn)} · Updated`, game: item };
}
const gameDate = (date: string) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Los_Angeles" }).format(new Date(date));
function RelativeResults({ items }: { items: OverviewInsight[] }) {
  return <ul className="m-0 list-none space-y-3 p-0">{items.map(item => <li className="border-t border-[var(--line-subtle)] pt-3 first:border-0 first:pt-0" key={item.key}>
    <div className="flex items-baseline justify-between gap-3"><h3 className="m-0 min-w-0 text-sm font-bold">{item.label}<StatInfo metric={item.metric} label={item.label}/></h3><span className="shrink-0 text-xl font-bold tabular-nums">{Math.round(item.percentile)}<span className="muted ml-1 text-[10px] font-medium">PCTL</span></span></div>
    <p className="mb-2 mt-1 text-xs leading-5 text-[var(--text-secondary)]"><span className="font-semibold text-[var(--text-primary)]">{item.value}</span> · {item.context} <time dateTime={item.date}>{leaderboardTestDate(item.date)}</time>{item.game && <GameOpportunity source={item.game.source} metric={item.game.metric} count={item.game.opportunities}/>}</p>
    <PercentileBar value={item.percentile} sampleSize={item.sampleSize} label={item.label}/><p className="mb-0 mt-2 text-[11px] text-[var(--text-secondary)]">{item.sampleSize} comparable players</p>
  </li>)}</ul>;
}
function TestingComparisons({ title, cards }: { title: string; cards: readonly PlayerMetricCard[] }) {
  if (!cards.length) return null;
  return <section aria-label={`${title} percentiles`} className="rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-3 sm:p-4"><h3 className="m-0 text-base font-bold">{title}</h3><ul className={`${styles.rows} ${styles.overviewRows}`}>{cards.map(card => {
    const reading = card.latest, p = card.percentile;
    const valid = reading && card.percentileStatus === "available" && p && p.sampleSize >= 5 && Number.isFinite(p.value) && p.value >= 0 && p.value <= 100 && p.unit === reading.unit && p.period === reading.period;
    return <li className={styles.row} key={card.metric.key} data-overview-metric={card.metric.key}><div><h3>{leaderboardMetricLabel(card.metric)}<StatInfo metric={card.metric.key} label={leaderboardMetricLabel(card.metric)}/></h3><span className="mr-2 font-bold tabular-nums">{reading ? `${reading.unit === "s" ? reading.value.toFixed(2) : reading.value} ${reading.unit === "ratio" ? "" : reading.unit}` : "—"}</span><MeasurementChange change={playerRenphoChange(card)} metric={card.metric.key}/>{reading && <p className={styles.meta}>Last Tested: <time dateTime={reading.measuredAt}>{leaderboardTestDate(reading.measuredAt)}</time></p>}</div><div>{valid ? <><PercentileBar value={p.value} sampleSize={p.sampleSize} label={card.metric.label} descriptive={card.metric.direction === "neutral"}/><p className={styles.meta}>n={p.sampleSize}{card.metric.direction === "neutral" ? " · Descriptive rank" : ""}</p></> : <p className={styles.meta}>{reading ? "Percentile appears after 5 comparable results." : "Not Yet Tested"}</p>}</div></li>;
  })}</ul></section>;
}
function GameComparisons({ metrics }: { metrics: GameOverviewMetric[] }) {
  if (!metrics.length) return <section aria-label="Game Stats percentiles" className="rounded-lg border border-dashed border-[var(--line-subtle)] p-3 sm:p-4"><h3 className="m-0 text-base font-bold">Game Stats</h3><p className="muted mb-0 mt-2 text-xs">Game comparisons appear after recorded Fall results are synced.</p></section>;
  const groups=[...new Set(metrics.map(m=>`${m.source}:${m.eventId}`))].map(key=>metrics.filter(m=>`${m.source}:${m.eventId}`===key));
  return <section aria-label="Game Stats percentiles" className="rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-3 sm:p-4"><h3 className="m-0 text-base font-bold">Game Stats</h3>{groups.map(group=><div key={`${group[0].source}:${group[0].eventId}`}><p className={styles.meta}>{group[0].source==="qpa_fall_2026"?"Hitting · Fall 2026 · Cumulative":`Pitching · ${pitchingPeriodLabel(group[0].eventId,group[0].playedOn)}`} · Updated {leaderboardTestDate(gameDate(group.map(m=>m.updatedAt).sort().at(-1)!))}</p><ul className={`${styles.rows} ${styles.compactGameRows}`}>{group.map(item=><li className={styles.row} key={item.metric} data-overview-game-metric={item.metric}>
    <div><h3>{item.label}<StatInfo metric={item.metric} label={item.label}/><span className={styles.inlineValue}>{item.metric==="batting_sb_per_pa"?item.value.toFixed(3):gameValue(item.value,item.unit)}</span></h3><GameOpportunity source={item.source} metric={item.metric} count={item.opportunities}/></div>
    <div>{item.comparison?<><PercentileBar value={item.comparison.percentile!} sampleSize={item.comparison.sampleSize} label={item.label} descriptive={item.direction==="neutral"}/><p className={styles.meta}>n={item.comparison.sampleSize}</p></>:<p className={styles.meta}>{item.metric==="batting_sb_per_pa"?"Recorded rate · percentile not available":"Percentile unavailable for this result."}</p>}</div>
  </li>)}</ul></div>)}</section>;
}

function compactNumber(value: number): string {
  if (value > 0 && value < 0.1) return "<0.1";
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function PlayerOverview({ cards, gameStats = [], gameComparisons = [], showMethods = true }: { cards: readonly PlayerMetricCard[]; gameStats?: readonly SharedGameStat[]; gameComparisons?: readonly GameComparison[]; showMethods?: boolean }) {
  const physicality = ["muscle_mass", "body_score", "body_fat_pct"].flatMap(key => cards.filter(card => card.metric.key === key));
  const testing = cards.filter(card => card.metric.group !== "body");
  const insights = getPlayerInsights(testing);
  const games = gameOverviewMetrics(gameStats, gameComparisons);
  const eligibleGames = games.filter(item => item.insightEligible && item.comparison && item.opportunities !== null);
  const strengths = [...insights.strengths.map(testingInsight), ...eligibleGames.filter(item => item.comparison!.percentile! >= 75).map(gameInsight)].sort((a,b) => b.percentile - a.percentile || a.key.localeCompare(b.key)).slice(0,3);
  const weaknesses = [...insights.weaknesses.map(testingInsight), ...eligibleGames.filter(item => item.comparison!.percentile! <= 25).map(gameInsight)].sort((a,b) => a.percentile - b.percentile || a.key.localeCompare(b.key)).slice(0,3);
  const comparableCount = insights.comparableMetricCount + eligibleGames.length;
  const availableCards = cards.filter(card => card.latest);
  const comparisonCards = availableCards.filter(card => card.percentile && card.percentile.sampleSize >= 5 && Number.isFinite(card.percentile.value) && card.percentile.value >= 0 && card.percentile.value <= 100);
  const lastTested = availableCards.map(card => card.latest!.measuredAt).sort().at(-1);
  const bodyResultsOnly = availableCards.length > 0 && availableCards.every(card => card.metric.group === "body");
  return <section aria-label="Player overview" className={styles.overview} data-testid="player-overview">
    <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4"><div className="max-w-xl"><h2 className="m-0 text-xl font-bold tracking-tight">Performance Snapshot</h2><p className="mb-0 mt-1.5 text-sm leading-6 text-[var(--text-secondary)]">{games.length ? "Your latest testing and Fall game results, compared with Pacific players." : bodyResultsOnly ? comparisonCards.length ? "Your latest measurements and Pacific team comparisons. Performance highlights will build as testing continues." : "Your body measurements are ready in Physicality. Performance highlights will build as testing continues." : "Strengths, areas to improve, and progress from your latest testing."}</p></div>{(lastTested || games.length > 0) && <dl className="m-0 flex flex-wrap gap-6 rounded-lg bg-[var(--surface-raised)] px-4 py-3 text-xs"><div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Available Metrics</dt><dd className="m-0 mt-1 font-bold tabular-nums">{availableCards.length + games.length}</dd></div>{lastTested && <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Last Tested</dt><dd className="m-0 mt-1 font-semibold"><time dateTime={lastTested}>{leaderboardTestDate(lastTested)}</time></dd></div>}{games.length > 0 && <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Game Stats Updated</dt><dd className="m-0 mt-1 font-semibold">{leaderboardTestDate(gameDate(games.map(g=>g.updatedAt).sort().at(-1)!))}</dd></div>}</dl>}</div>
    <div className={styles.insights}>
      {[
        { title: "Strengths", icon: TrendingUp, items: strengths, note: "Top quarter of team results", empty: "No results are in the top quarter right now." },
        { title: "Weaknesses", icon: Crosshair, items: weaknesses, note: "Bottom quarter of team results", empty: "No results are in the bottom quarter right now." },
      ].map(({ title, icon: Icon, items, note, empty }) => <section className="rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-3 sm:p-4" key={title} aria-label={title}>
        <div className="mb-2 flex items-center gap-2"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-raised)] text-[var(--accent-readable)]"><Icon size={18} aria-hidden="true" /></span><div><h2 className="m-0 text-base font-bold">{title}</h2><p className="mb-0 mt-1 text-[11px] text-[var(--text-secondary)]">{note}</p></div></div>
        {items.length ? <RelativeResults items={items} /> : <p className="m-0 text-xs leading-5 text-[var(--text-secondary)]">{comparableCount ? empty : "Waiting for comparable testing or game results."}</p>}
      </section>)}
      <section className="rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-3 sm:p-4" aria-label="Biggest jumps">
        <div className="mb-2 flex items-center gap-2"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-raised)] text-[var(--accent-readable)]"><ArrowUpRight size={18} aria-hidden="true" /></span><div><h2 className="m-0 text-base font-bold">Biggest Jumps</h2><p className="mb-0 mt-1 text-[11px] text-[var(--text-secondary)]">Progress since your previous test</p></div></div>
        {insights.biggestJumps.length ? <ul className="m-0 list-none space-y-3 p-0">{insights.biggestJumps.map(item => <li className="border-t border-[var(--line-subtle)] pt-3 first:border-0 first:pt-0" key={item.metric.key}>
          <h3 className="m-0 text-sm font-bold">{leaderboardMetricLabel(item.metric)}<StatInfo metric={item.metric.key} label={leaderboardMetricLabel(item.metric)} /></h3>
          <p className="mb-1 mt-2 text-xl font-bold tabular-nums text-[var(--accent-readable)]" title={`Relative improvement: ${item.relativeImprovementPercent}%`}>{compactNumber(item.relativeImprovementPercent)}% <span className="text-xs font-semibold">improvement</span></p>
          <p className="mb-1 mt-0 break-words text-sm font-semibold tabular-nums" title={`Exact change: ${item.change} ${item.changeUnit === "pp" ? "percentage points" : item.changeUnit}`}>{String(item.previous.value)} → {String(item.latest.value)} {item.latest.unit === "ratio" ? "" : item.latest.unit}</p>
          <p className="muted mb-0 text-[11px]"><time dateTime={item.previous.measuredAt}>{leaderboardTestDate(item.previous.measuredAt)}</time> → <time dateTime={item.latest.measuredAt}>{leaderboardTestDate(item.latest.measuredAt)}</time></p>
        </li>)}</ul> : <p className="m-0 text-xs leading-5 text-[var(--text-secondary)]">Repeat testing will highlight your largest gains.</p>}
      </section>
    </div>
    {!comparableCount && <p className="m-0 max-w-3xl text-xs leading-6 text-[var(--text-secondary)]">Highlights appear once at least five players have comparable testing or game results. Your recorded measurements are available in the tabs above.</p>}
    <div className={styles.percentileSections} aria-label="Pacific percentiles"><div><h2 className="mb-2 mt-0 text-lg font-bold">Pacific Percentiles</h2><PercentileLegend/></div>
      <TestingComparisons title="Physicality" cards={physicality}/>
      <GameComparisons metrics={games}/>
      <TestingComparisons title="Hitting & Athletic Testing" cards={testing.filter(c => c.metric.group === "hitting" && c.latest)}/>
      <TestingComparisons title="Throwing" cards={testing.filter(c => ["pitching", "throwing"].includes(c.metric.group) && c.latest)}/>
    </div>
    <ProfileTrendChart series={profileTrends([...physicality, ...testing])} />
    {showMethods && <details className="group border-t border-[var(--line-subtle)] pt-4 text-xs text-[var(--text-secondary)]"><summary className="flex min-h-8 w-fit cursor-pointer list-none items-center gap-2 font-semibold">How This Overview Works<ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
      <div className="mt-3 max-w-3xl space-y-2 leading-relaxed">
        <p>Strengths are at or above the 75th Pacific percentile; weaknesses are at or below the 25th. Testing comparisons use the same test, source, unit and period; game comparisons use the same current cumulative QPA or pitching snapshot, with at least five comparable players. Game highlights use batting rates and pitching K/9, BB/9, Runs/9 and Strike %, with opportunity counts and limited-sample labels. Lower batting K % is favorable. Raw game totals do not determine strengths or weaknesses. Up to three results appear in each section.</p>
        <p>Biggest jumps compare the latest result with the previous testing date for the same measurement, source, unit and period. Gains are ordered by relative percentage improvement; higher or lower values count as improvement according to the test. A percentage improvement is relative to the previous value, not a percentage-point change. Displayed improvement percentages are rounded to one decimal.</p>
        <p>Body fat ranks lower percentages higher, matching the leaderboard. Height, weight, body composition and fastball spin stay descriptive throughout the profile. They are not labeled strengths, weaknesses or improvements. These highlights summarize current recorded results, not a prediction. Cumulative game snapshots do not establish biggest jumps.</p>
      </div>
    </details>}
  </section>;
}
