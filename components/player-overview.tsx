import { HittingTeamAverageLine } from "@/components/hitting-team-average";
import { hittingTeamAverage, type HittingTeamAverage } from "@/lib/hitting-team-averages";
import { profileMetricLabel } from "@/lib/profile-metric-label";
import { formatMetricNumber } from "@/lib/measurement-display";
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
import overview from "./player-overview.module.css";
import { percentileColor } from "@/lib/percentile-color";
import { ArrowUpRight, Crosshair, TrendingUp, ChevronDown } from "lucide-react";
import { isTimedMetric, type PlayerMetricCard } from "@/lib/player-performance";
import { getPlayerInsights, type PlayerRelativeInsight } from "@/lib/player-insights";
import { leaderboardMetricLabel, leaderboardTestDate } from "@/lib/leaderboards";

type OverviewInsight = { key: string; metric: string; label: string; value: string; percentile: number; sampleSize: number; discipline: string; game?: GameOverviewMetric };
function testingInsight(item: PlayerRelativeInsight): OverviewInsight {
  return { key: `test:${item.metric.key}`, metric: item.metric.key, label: profileMetricLabel(item.metric.key,leaderboardMetricLabel(item.metric),item.latest.source), value: `${formatMetricNumber(item.latest.value, item.metric.key, item.latest.source, item.latest.unit === "s" ? item.latest.value.toFixed(2) : String(item.latest.value))} ${item.latest.unit === "ratio" ? "" : item.latest.unit}`, percentile: item.percentile.value, sampleSize: item.percentile.sampleSize, discipline: testingDiscipline(item.metric) };
}
function gameInsight(item: GameOverviewMetric): OverviewInsight {
  return { key: `game:${item.source}:${item.metric}`, metric: item.metric, label: item.label, value: gameValue(item.value, item.unit), percentile: item.comparison!.percentile!, sampleSize: item.comparison!.sampleSize, discipline: item.source === "qpa_fall_2026" ? "Hitting" : "Pitching", game: item };
}
const gameDate = (date: string) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Los_Angeles" }).format(new Date(date));
function testingDiscipline(metric: PlayerMetricCard["metric"]): string {
  return isTimedMetric(metric.key) ? "Athletic Testing" : metric.group === "hitting" ? "Hitting" : metric.group === "pitching" ? "Pitching" : "Position Throwing";
}
function RelativeResults({ items, separate = false }: { items: OverviewInsight[]; separate?: boolean }) {
  if (separate) return <div className={overview.highlightGroups}>{["Hitting", "Pitching", "Athletic Testing", "Position Throwing"].map(discipline => {
    const group = items.filter(item => item.discipline === discipline);
    return group.length ? <div key={discipline} data-insight-discipline={discipline}><h3 className={overview.disciplineLabel}>{discipline}</h3><RelativeResults items={group}/></div> : null;
  })}</div>;
  return <ul className={overview.highlightList}>{items.map(item => <li key={item.key}>
    <div className={overview.highlightResult}>
      <div><h3>{item.label}<StatInfo metric={item.metric} label={item.label}/></h3><span className={overview.resultValue}>{item.value}</span></div>
      <span className={overview.percentileBadge} style={percentileColor(item.percentile)} aria-label={`${Math.round(item.percentile)} percentile among ${item.sampleSize} comparable Pacific players`}><strong>{Math.round(item.percentile)}</strong><span>PCTL</span></span>
    </div>
    <p className={overview.highlightMeta}>{item.discipline} · {item.sampleSize} comparable players</p>
    {item.game && <GameOpportunity source={item.game.source} metric={item.game.metric} count={item.game.opportunities}/>}
  </li>)}</ul>;
}
function TestingComparisons({ title, cards, teamAverages=[] }: { title: string; cards: readonly PlayerMetricCard[]; teamAverages?:readonly HittingTeamAverage[] }) {
  if (!cards.length) return null;
  return <section aria-label={`${title} percentiles`} className={overview.panel}><h3 className="m-0 text-base font-bold">{title}</h3><ul className={`${styles.rows} ${styles.overviewRows}`}>{cards.map(card => {
    const reading = card.latest, p = card.percentile;
    const average=reading&&card.metric.group==="hitting"?hittingTeamAverage(teamAverages,card.metric.key,reading.unit,reading.source):undefined;
    const valid = reading && card.percentileStatus === "available" && p && p.sampleSize >= 5 && Number.isFinite(p.value) && p.value >= 0 && p.value <= 100 && p.unit === reading.unit && p.period === reading.period;
    return <li className={styles.row} key={card.metric.key} data-overview-metric={card.metric.key}><div><h3>{profileMetricLabel(card.metric.key,leaderboardMetricLabel(card.metric),reading?.source)}<StatInfo metric={card.metric.key} label={leaderboardMetricLabel(card.metric)}/></h3><span className="mr-2 font-bold tabular-nums">{reading ? `${formatMetricNumber(reading.value,card.metric.key,reading.source,reading.unit === "s" ? reading.value.toFixed(2) : String(reading.value))} ${reading.unit === "ratio" ? "" : reading.unit}` : "—"}</span><MeasurementChange change={playerRenphoChange(card)} metric={card.metric.key}/>{reading && <p className={styles.meta}>Last Tested: <time dateTime={reading.measuredAt}>{leaderboardTestDate(reading.measuredAt)}</time></p>}{average&&<HittingTeamAverageLine average={average}/>}</div><div>{valid ? <><PercentileBar value={p.value} sampleSize={p.sampleSize} label={card.metric.label} descriptive={card.metric.direction === "neutral"}/><p className={styles.meta}>n={p.sampleSize}{card.metric.direction === "neutral" ? " · Descriptive rank" : ""}</p></> : <p className={styles.meta}>{reading ? "Percentile appears after 5 comparable results." : "Not Yet Tested"}</p>}</div></li>;
  })}</ul></section>;
}
function GameComparisons({ metrics }: { metrics: GameOverviewMetric[] }) {
  if (!metrics.length) return <section aria-label="Game Stats percentiles" className={overview.panel}><h3 className="m-0 text-base font-bold">Game Stats</h3><p className="muted mb-0 mt-2 text-xs">Game comparisons appear after recorded Fall results are synced.</p></section>;
  const groups=[...new Set(metrics.map(m=>`${m.source}:${m.eventId}`))].map(key=>metrics.filter(m=>`${m.source}:${m.eventId}`===key));
  return <section aria-label="Game Stats percentiles" className={overview.testingSections}>{groups.map(group=><section className={overview.panel} aria-label={group[0].source === "qpa_fall_2026" ? "Hitting game percentiles" : "Pitching game percentiles"} key={`${group[0].source}:${group[0].eventId}`}><header className={overview.gameHeader}><span>Game Stats</span><h3>{group[0].source === "qpa_fall_2026" ? "Hitting" : "Pitching"}</h3></header><p className={styles.meta}>{group[0].source==="qpa_fall_2026"?"Hitting · Fall 2026 · Cumulative":`Pitching · ${pitchingPeriodLabel(group[0].eventId,group[0].playedOn)}`} · Updated {leaderboardTestDate(gameDate(group.map(m=>m.updatedAt).sort().at(-1)!))}</p><ul className={`${styles.rows} ${styles.compactGameRows}`}>{group.map(item=><li className={styles.row} key={item.metric} data-overview-game-metric={item.metric}>
    <div><h3>{item.label}<StatInfo metric={item.metric} label={item.label}/><span className={styles.inlineValue}>{item.metric==="batting_sb_per_pa"?item.value.toFixed(3):gameValue(item.value,item.unit)}</span></h3><GameOpportunity source={item.source} metric={item.metric} count={item.opportunities}/></div>
    <div>{item.comparison?<><PercentileBar value={item.comparison.percentile!} sampleSize={item.comparison.sampleSize} label={item.label} descriptive={item.direction==="neutral"}/><p className={styles.meta}>n={item.comparison.sampleSize}</p></>:<p className={styles.meta}>{item.metric==="batting_sb_per_pa"?"Recorded rate · percentile not available":"Percentile unavailable for this result."}</p>}</div>
  </li>)}</ul></section>)}</section>;
}

function compactNumber(value: number): string {
  if (value > 0 && value < 0.1) return "<0.1";
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function PlayerOverview({ cards, gameStats = [], gameComparisons = [], showMethods = true, twoWay = false, teamAverages=[] }: { teamAverages?:readonly HittingTeamAverage[]; twoWay?: boolean; cards: readonly PlayerMetricCard[]; gameStats?: readonly SharedGameStat[]; gameComparisons?: readonly GameComparison[]; showMethods?: boolean }) {
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
  const lastTested = availableCards.map(card => card.timedTrials?.lastTested ?? card.latest!.measuredAt).sort().at(-1);
  const bodyResultsOnly = availableCards.length > 0 && availableCards.every(card => card.metric.group === "body");
  return <section aria-label="Player overview" className={styles.overview} data-testid="player-overview">
    <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4"><div className="max-w-xl"><h2 className="m-0 text-xl font-bold tracking-tight">Performance Snapshot</h2><p className="mb-0 mt-1.5 text-sm leading-6 text-[var(--text-secondary)]">{games.length ? "Your latest testing and Fall game results, compared with Pacific players." : bodyResultsOnly ? comparisonCards.length ? "Your latest measurements and Pacific team comparisons. Performance highlights will build as testing continues." : "Your body measurements are ready in Physicality. Performance highlights will build as testing continues." : "Strengths, areas to improve, and progress from your latest testing."}</p></div>{(lastTested || games.length > 0) && <dl className="m-0 flex flex-wrap gap-6 rounded-lg bg-[var(--surface-raised)] px-4 py-3 text-xs"><div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Available Metrics</dt><dd className="m-0 mt-1 font-bold tabular-nums">{availableCards.length + games.length}</dd></div>{lastTested && <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Last Tested</dt><dd className="m-0 mt-1 font-semibold"><time dateTime={lastTested}>{leaderboardTestDate(lastTested)}</time></dd></div>}{games.length > 0 && <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Game Stats Updated</dt><dd className="m-0 mt-1 font-semibold">{leaderboardTestDate(gameDate(games.map(g=>g.updatedAt).sort().at(-1)!))}</dd></div>}</dl>}</div>
    <div className={styles.insights}>
      {[
        { title: "Strengths", icon: TrendingUp, items: strengths, note: "Top quarter of team results", empty: "No results are in the top quarter right now." },
        { title: "Weaknesses", icon: Crosshair, items: weaknesses, note: "Bottom quarter of team results", empty: "No results are in the bottom quarter right now." },
      ].map(({ title, icon: Icon, items, note, empty }) => <section className={overview.panel} key={title} aria-label={title} data-highlight={title.toLowerCase()}>
        <div className={overview.highlightHeader}><span className={overview.highlightIcon}><Icon size={18} aria-hidden="true" /></span><div><h2 className="m-0 text-base font-bold">{title}</h2><p className="mb-0 mt-1 text-[11px] text-[var(--text-secondary)]">{note}</p></div></div>
        {items.length ? <RelativeResults items={items} separate={twoWay} /> : <p className="m-0 text-xs leading-5 text-[var(--text-secondary)]">{comparableCount ? empty : "Waiting for comparable testing or game results."}</p>}
      </section>)}
      <section className={overview.panel} aria-label="Biggest jumps" data-highlight="progress">
        <div className={overview.highlightHeader}><span className={overview.highlightIcon}><ArrowUpRight size={18} aria-hidden="true" /></span><div><h2 className="m-0 text-base font-bold">Biggest Jumps</h2><p className="mb-0 mt-1 text-[11px] text-[var(--text-secondary)]">Progress since your previous test</p></div></div>
        {insights.biggestJumps.length ? <ul className={overview.highlightList}>{insights.biggestJumps.map(item => <li key={item.metric.key}>
          {twoWay && <p className={overview.disciplineLabel}>{testingDiscipline(item.metric)}</p>}
          <h3 className="m-0 text-sm font-bold">{profileMetricLabel(item.metric.key,leaderboardMetricLabel(item.metric),item.latest.source)}<StatInfo metric={item.metric.key} label={leaderboardMetricLabel(item.metric)} /></h3>
          <p className={overview.jumpValue} title={`Relative improvement: ${item.relativeImprovementPercent}%`}>{compactNumber(item.relativeImprovementPercent)}% <span className="text-xs font-semibold">improvement</span></p>
          <p className={overview.jumpReadings} title={`Change: ${formatMetricNumber(item.change,item.metric.key)} ${item.changeUnit === "pp" ? "percentage points" : item.changeUnit}`}>{formatMetricNumber(item.previous.value,item.metric.key,item.previous.source)} → {formatMetricNumber(item.latest.value,item.metric.key,item.latest.source)} {item.latest.unit === "ratio" ? "" : item.latest.unit}</p>
          <p className="muted mb-0 text-[11px]"><time dateTime={item.previous.measuredAt}>{leaderboardTestDate(item.previous.measuredAt)}</time> → <time dateTime={item.latest.measuredAt}>{leaderboardTestDate(item.latest.measuredAt)}</time></p>
        </li>)}</ul> : <p className="m-0 text-xs leading-5 text-[var(--text-secondary)]">Repeat testing will highlight your largest gains.</p>}
      </section>
    </div>
    {!comparableCount && <p className="m-0 max-w-3xl text-xs leading-6 text-[var(--text-secondary)]">Highlights appear once at least five players have comparable testing or game results. Your recorded measurements are available in the tabs above.</p>}
    <div className={styles.percentileSections} aria-label="Pacific percentiles"><div className={overview.sectionHeading}><h2 className="mb-2 mt-0 text-lg font-bold">Pacific Percentiles</h2><PercentileLegend/></div>
      <div className={overview.testingSections}>
      <TestingComparisons teamAverages={teamAverages} title="Physicality" cards={physicality}/>
      <TestingComparisons teamAverages={teamAverages} title="Hitting · Testing" cards={testing.filter(c => c.metric.group === "hitting" && !isTimedMetric(c.metric.key) && c.latest)}/>
      <TestingComparisons teamAverages={teamAverages} title="Athletic Testing" cards={testing.filter(c => isTimedMetric(c.metric.key) && c.latest)}/>
      <TestingComparisons teamAverages={teamAverages} title="Position Throwing · Testing" cards={testing.filter(c => c.metric.group === "throwing" && c.latest)}/>
      <TestingComparisons teamAverages={teamAverages} title="Pitching · Testing" cards={testing.filter(c => c.metric.group === "pitching" && c.latest)}/>
      </div>
      <GameComparisons metrics={games}/>
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
