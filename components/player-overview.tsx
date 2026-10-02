import { countLabel } from "@/lib/game-opportunities";
import { ScaleLegend } from "@/components/charts/scale-legend";
import { PercentileRing } from "@/components/charts/percentile-ring";
import { Sparkline } from "@/components/charts/sparkline";
import { isAdvancedGameMetric } from "@/lib/advanced-game-presentation";
import { pitchSourceLabel } from "@/lib/pitch-display";
import { HittingTeamAverageLine } from "@/components/hitting-team-average";
import { hittingTeamAverage, type HittingTeamAverage } from "@/lib/hitting-team-averages";
import { profileSessionContext } from "@/lib/player-profile-layout";
import { profileOverviewGroups } from "@/lib/profile-overview-groups";
import { profileMetricLabel } from "@/lib/profile-metric-label";
import { formatMetricNumber } from "@/lib/measurement-display";
import { pitchingPeriodLabel } from "@/lib/game-source";
import { ProfileTrendChart } from "@/components/profile-trend-chart";
import { PhysicalityRadar, physicalityRadarPoints } from "@/components/physicality-radar";
import { profileTrends, type ProfileTrend } from "@/lib/profile-trends";
import { MeasurementChange } from "@/components/measurement-change";
import { playerRenphoChange } from "@/lib/measurement-change";
import type { StatGuideContext } from "@/lib/stat-benchmarks";
import { StatInfo } from "@/components/stat-info";
import { PercentileBar, PercentileLegend } from "@/components/percentile-bar";
import { GameOpportunity } from "@/components/game-opportunity";
import { gameOverviewMetrics, type GameOverviewMetric } from "@/lib/game-overview";
import { gameValue, type GameComparison } from "@/lib/game-metrics";
import type { SharedGameStat } from "@/lib/game-server";
import styles from "./percentile-bar.module.css";
import overview from "./player-overview.module.css";
import { percentileColor } from "@/lib/percentile-color";
import { ArrowUpRight, Crosshair, TrendingUp, ChevronDown, ChartNoAxesCombined } from "lucide-react";
import { isTimedMetric, type PlayerMetricCard } from "@/lib/player-performance";
import { getPlayerInsights, type PlayerRelativeInsight } from "@/lib/player-insights";
import { leaderboardMetricLabel, leaderboardTestDate } from "@/lib/leaderboards";

type OverviewInsight = { key: string; metric: string; label: string; value: string; percentile: number; sampleSize: number; discipline: string; context: string; guide: StatGuideContext; game?: GameOverviewMetric };
function testingInsight(item: PlayerRelativeInsight): OverviewInsight {
  return { key: `test:${item.metric.key}`, guide: {source:item.latest.source,unit:item.latest.unit,period:item.latest.period,value:item.latest.value}, metric: item.metric.key, label: profileMetricLabel(item.metric.key,leaderboardMetricLabel(item.metric),item.latest.source), value: `${formatMetricNumber(item.latest.value, item.metric.key, item.latest.source, item.latest.unit === "s" ? item.latest.value.toFixed(2) : String(item.latest.value))} ${item.latest.unit === "ratio" ? "" : item.latest.unit}`, percentile: item.percentile.value, sampleSize: item.percentile.sampleSize, discipline: testingDiscipline(item.metric), context: isTimedMetric(item.metric.key) ? "Testing" : profileSessionContext(item.latest.source) === "in_game" ? "In-Game" : "Practice" };
}
function gameInsight(item: GameOverviewMetric): OverviewInsight {
  return { key: `game:${item.source}:${item.metric}`, guide: {source:item.source,unit:item.unit,period:"fall_2026",eventId:item.eventId,value:item.value}, metric: item.metric, label: item.label, value: gameValue(item.value, item.unit), percentile: item.comparison!.percentile!, sampleSize: item.comparison!.sampleSize, discipline: item.source === "qpa_fall_2026" ? "Hitting" : "Pitching", context: "In-Game", game: item };
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
  return <><RelativeRows items={items.slice(0,1)}/>{items.length > 1 && <details className={overview.additionalHighlights}><summary>{items.length-1} more {items.length === 2 ? "highlight" : "highlights"}<ChevronDown size={13} aria-hidden="true"/></summary><RelativeRows items={items.slice(1)}/></details>}</>;
}
function RelativeRows({items}:{items:OverviewInsight[]}) {
  return <ul className={overview.highlightList}>{items.map(item => <li key={item.key}>
    <div className={overview.highlightResult}>
      <div><h3>{item.label}<StatInfo metric={item.metric} label={item.label} {...item.guide}/></h3><span className={overview.resultValue}>{item.value}</span></div>
      <span className={overview.percentileBadge} style={percentileColor(item.percentile)} aria-label={`${Math.round(item.percentile)} percentile among ${item.sampleSize} comparable Pacific players`}><strong>{Math.round(item.percentile)}</strong><span>PCTL</span></span>
    </div>
    <div className={overview.highlightBar} aria-hidden="true"><span style={{ width: `${item.percentile}%`, backgroundColor: percentileColor(item.percentile).backgroundColor }} /><i /></div>
    <p className={overview.highlightMeta}>{item.discipline} · {item.context} · {item.sampleSize} teammates with this stat</p>
    {item.game && <GameOpportunity source={item.game.source} metric={item.game.metric} count={item.game.opportunities}/>}
  </li>)}</ul>;
}
function TestingComparisons({ title, cards, context, teamAverages=[] }: { title: string; cards: readonly PlayerMetricCard[]; context?: string; teamAverages?:readonly HittingTeamAverage[] }) {
  if (!cards.length) return null;
  const row = (card: PlayerMetricCard) => {
    const reading = card.latest, p = card.percentile;
    const average=reading&&card.metric.group==="hitting"?hittingTeamAverage(teamAverages,card.metric.key,reading.unit,reading.source):undefined;
    const valid = reading && card.percentileStatus === "available" && p && p.sampleSize >= 5 && Number.isFinite(p.value) && p.value >= 0 && p.value <= 100 && p.unit === reading.unit && p.period === reading.period;
    return <li className={styles.row} key={`${card.metric.key}:${reading?.source}:${reading?.unit}:${reading?.period}`} data-overview-metric={card.metric.key}>
      <div><h3>{profileMetricLabel(card.metric.key,leaderboardMetricLabel(card.metric),reading?.source)}<StatInfo metric={card.metric.key} label={leaderboardMetricLabel(card.metric)} value={reading?.value} unit={reading?.unit} source={reading?.source} period={reading?.period} percentile={card.percentile?.sampleSize && card.percentile.sampleSize>=5?card.percentile.value:null}/></h3><span className="mr-2 font-bold tabular-nums">{reading ? `${formatMetricNumber(reading.value,card.metric.key,reading.source,reading.unit === "s" ? reading.value.toFixed(2) : String(reading.value))} ${reading.unit === "ratio" ? "" : reading.unit}` : "—"}</span><MeasurementChange change={playerRenphoChange(card)} metric={card.metric.key}/>{reading && <p className={styles.meta}>{pitchSourceLabel(reading.source)} · <time dateTime={reading.measuredAt}>{leaderboardTestDate(reading.measuredAt)}</time></p>}{average&&<HittingTeamAverageLine average={average}/>}</div>
      <div>{valid ? <><PercentileBar value={p.value} sampleSize={p.sampleSize} label={card.metric.label} descriptive={card.metric.direction === "neutral"}/><p className={styles.meta}>{p.sampleSize} teammates{card.metric.direction === "neutral" ? " · Descriptive rank" : ""}</p></> : <p className={styles.meta}>{reading ? "Team rank appears after five players record the same test." : "Not Yet Tested"}</p>}</div>
    </li>;
  };
  return <section aria-label={`${title}${context ? ` · ${context}` : ""} percentiles`} className={`${overview.panel} ${overview.comparisonCard}`}>
    <header className={overview.comparisonHeader}><div><p>{context || "Team Comparison"}</p><h3>{title}</h3></div><span>{cards.length} {cards.length === 1 ? "stat" : "stats"}</span></header>
    <ul className={`${styles.rows} ${styles.overviewRows}`}>{cards.slice(0,4).map(row)}</ul>
    {cards.length > 4 && <details className={overview.additionalRows}><summary>All {title.toLowerCase()} results <span>+{cards.length-4}</span><ChevronDown size={14} aria-hidden="true"/></summary><ul className={`${styles.rows} ${styles.overviewRows}`}>{cards.slice(4).map(row)}</ul></details>}
  </section>;
}
function GameComparisonRows({metrics}:{metrics:GameOverviewMetric[]}) {
  return <ul className={`${styles.rows} ${styles.compactGameRows}`}>{metrics.map(item=><li className={styles.row} key={item.metric} data-overview-game-metric={item.metric}>
    <div><h3>{item.label}<StatInfo metric={item.metric} label={item.label} value={item.value} unit={item.unit} source={item.source} period="fall_2026" eventId={item.eventId}/><span className={styles.inlineValue}>{item.metric==="batting_sb_per_pa"?item.value.toFixed(3):gameValue(item.value,item.unit)}</span></h3><GameOpportunity source={item.source} metric={item.metric} count={item.opportunities}/></div>
    <div>{item.comparison?<><PercentileBar value={item.comparison.percentile!} sampleSize={item.comparison.sampleSize} label={item.label} descriptive={item.direction==="neutral"}/><p className={styles.meta}>{item.comparison.sampleSize} teammates</p></>:<p className={styles.meta}>{item.metric==="batting_sb_per_pa"?"Recorded rate · team rank not available":"Team rank not available for this result."}</p>}</div>
  </li>)}</ul>;
}
function GameComparisons({ metrics }: { metrics: GameOverviewMetric[] }) {
  if (!metrics.length) return null;
  const groups=[...new Set(metrics.map(m=>`${m.source}:${m.eventId}`))].map(key=>metrics.filter(m=>`${m.source}:${m.eventId}`===key));
  return <section aria-label="Game Stats percentiles" className={overview.gameCards}>{groups.map(group=>{
    const hitting = group[0].source === "qpa_fall_2026";
    return <section className={`${overview.panel} ${overview.comparisonCard}`} aria-label={hitting ? "Hitting game percentiles" : "Pitching game percentiles"} key={`${group[0].source}:${group[0].eventId}`}>
      <header className={overview.comparisonHeader}><div><p>In-Game · Fall 2026</p><h3>{hitting ? "Hitting" : "Pitching"}</h3></div><span>Game Stats</span></header>
      <p className={overview.comparisonCaption}>{hitting ? "Cumulative hitting" : pitchingPeriodLabel(group[0].eventId,group[0].playedOn)} · Updated {leaderboardTestDate(gameDate(group.map(m=>m.updatedAt).sort().at(-1)!))}</p>
      <GameComparisonRows metrics={group.slice(0,4)}/>
      {group.length > 4 && <details className={overview.additionalRows}><summary>All {hitting ? "hitting" : "pitching"} game stats <span>+{group.length-4}</span><ChevronDown size={14} aria-hidden="true"/></summary><GameComparisonRows metrics={group.slice(4)}/></details>}
    </section>;
  })}</section>;
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
  const hasPhysicalityRadar = physicalityRadarPoints(physicality).length === 3;
  const testingGroups = profileOverviewGroups(testing);
  const trends = profileTrends([...physicality, ...testing]);
  const headlineKeys = ["batting_production_plus", "pitching_k_bb", "body_score", "muscle_mass", "max_exit_velocity", "max_pitch_velocity", "body_fat_pct"];
  type Headline = { key: string; guide: StatGuideContext; label: string; value: string; detail: string; percentile: number | null; neutral: boolean; trend: ProfileTrend | null; lowerIsBetter: boolean };
  const headline = headlineKeys.flatMap((key): Headline[] => {
    const game = games.find(item => item.metric === key);
    if (game) return [{key, guide:{source:game.source,unit:game.unit,period:"fall_2026" as const,eventId:game.eventId,value:game.value}, label:game.label, value:gameValue(game.value,game.unit), detail:game.opportunities == null ? "In-Game · Fall 2026" : `${countLabel(game.opportunities, "chances")} · In-Game`, percentile: game.comparison && game.comparison.sampleSize >= 5 ? game.comparison.percentile : null, neutral: game.direction === "neutral", trend: null as ProfileTrend | null, lowerIsBetter: game.direction === "lower"}];
    const card = availableCards.find(item => item.metric.key === key);
    if (!card?.latest) return [];
    return [{key,guide:{source:card.latest.source,unit:card.latest.unit,period:card.latest.period,value:card.latest.value} as StatGuideContext,label:profileMetricLabel(key,leaderboardMetricLabel(card.metric),card.latest.source),value:`${formatMetricNumber(card.latest.value,key,card.latest.source)} ${card.latest.unit === "ratio" ? "" : card.latest.unit}`.trim(),detail:`Tested ${leaderboardTestDate(card.latest.measuredAt)}`, percentile: card.percentile && card.percentile.sampleSize >= 5 && Number.isFinite(card.percentile.value) ? card.percentile.value : null, neutral: card.metric.direction === "neutral", trend: trends.find(trend => trend.key === key) ?? null, lowerIsBetter: card.metric.direction === "lower"}];
  }).slice(0,4);
  return <section aria-label="Player overview" className={styles.overview} data-testid="player-overview">
    <div className={overview.snapshotHeader}><div className={overview.snapshotIntro}><h2 className="m-0 text-xl font-bold tracking-tight">Performance Snapshot</h2><p className="mb-0 mt-1.5 text-sm leading-6 text-[var(--text-secondary)]">{games.length ? (showMethods ? "This player’s latest tests and Fall game stats, alongside the Pacific team." : "Your latest tests and Fall game stats, alongside the Pacific team.") : bodyResultsOnly ? comparisonCards.length ? (showMethods ? "This player’s latest body results compared with the team. More highlights will appear as testing continues." : "Your latest body results compared with the team. More highlights will appear as testing continues.") : (showMethods ? "Body results are in Physicality. More highlights will appear as testing continues." : "Your body results are in Physicality. More highlights will appear as testing continues.") : (showMethods ? "Where this player stands now and how they have changed since earlier tests." : "Where you stand now and how you have changed since earlier tests.")}</p></div>{(lastTested || games.length > 0) && <dl className={overview.snapshotFacts}><div><dt className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Stats Available</dt><dd className="m-0 mt-1 font-bold tabular-nums">{availableCards.length + games.length}</dd></div>{lastTested && <div><dt className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Last Tested</dt><dd className="m-0 mt-1 font-semibold"><time dateTime={lastTested}>{leaderboardTestDate(lastTested)}</time></dd></div>}{games.length > 0 && <div><dt className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Game Stats Updated</dt><dd className="m-0 mt-1 font-semibold">{leaderboardTestDate(gameDate(games.map(g=>g.updatedAt).sort().at(-1)!))}</dd></div>}</dl>}</div>
    {!!headline.length && <dl className={overview.headlineStats} data-count={headline.length} aria-label="Key performance results">{headline.map(item=><div key={item.key} className={overview.heroTile}><div className={overview.heroTop}><div className="min-w-0"><dt>{item.label}<StatInfo metric={item.key} label={item.label} {...item.guide}/></dt><dd>{item.value}</dd></div>{item.percentile !== null && <PercentileRing value={item.percentile} neutral={item.neutral} label={item.label} size={54}/>}</div>{item.trend && <Sparkline points={item.trend.points} width={160} height={30} label={`${item.label} trend`} lowerIsBetter={item.lowerIsBetter}/>}<p>{item.detail}{item.percentile !== null ? ` · ${item.neutral ? "Team position" : "Team percentile"}` : ""}</p></div>)}</dl>}
    {comparableCount > 0 && <ScaleLegend low="Bottom of team" high="Top of team" note="Percentile colors: red is the top of the team for that stat. Gray rings are body or spin positions, not grades."/>}
    <div className={overview.insights} data-has-jumps={insights.biggestJumps.length > 0 || undefined}>
      {[
        { title: "Strengths", icon: TrendingUp, items: strengths, note: "Results in the top quarter of the team", empty: "No results are in the top quarter right now." },
        { title: "Areas to Work On", icon: Crosshair, items: weaknesses, note: "Results in the bottom quarter of the team", empty: "No results fall in the bottom quarter right now." },
      ].map(({ title, icon: Icon, items, note, empty }) => <section className={overview.panel} key={title} aria-label={title} data-highlight={title === "Strengths" ? "strengths" : "weaknesses"}>
        <div className={overview.highlightHeader}><span className={overview.highlightIcon}><Icon size={18} aria-hidden="true" /></span><div><h2 className="m-0 text-base font-bold">{title}</h2><p className="mb-0 mt-1 text-xs text-[var(--text-secondary)]">{note}</p></div></div>
        {items.length ? <RelativeResults items={items} separate={twoWay} /> : <p className="m-0 text-xs leading-5 text-[var(--text-secondary)]">{comparableCount ? empty : "Waiting for enough teammates with the same test or game stat."}</p>}
      </section>)}
      <section className={overview.panel} aria-label="Biggest jumps" data-highlight="progress">
        <div className={overview.highlightHeader}><span className={overview.highlightIcon}><ArrowUpRight size={18} aria-hidden="true" /></span><div><h2 className="m-0 text-base font-bold">Biggest Jumps</h2><p className="mb-0 mt-1 text-xs text-[var(--text-secondary)]">{showMethods ? "Progress since the previous test" : "Progress since your previous test"}</p></div></div>
        {insights.biggestJumps.length ? <ul className={overview.highlightList}>{insights.biggestJumps.map(item => <li key={item.metric.key}>
          {twoWay && <p className={overview.disciplineLabel}>{testingDiscipline(item.metric)}</p>}
          <h3 className="m-0 text-sm font-bold">{profileMetricLabel(item.metric.key,leaderboardMetricLabel(item.metric),item.latest.source)}<StatInfo metric={item.metric.key} label={leaderboardMetricLabel(item.metric)} value={item.latest.value} source={item.latest.source} unit={item.latest.unit} period={item.latest.period} /></h3>
          <p className={overview.jumpValue} title={`Relative improvement: ${item.relativeImprovementPercent}%`}>{compactNumber(item.relativeImprovementPercent)}% <span className="text-xs font-semibold">improvement</span></p>
          <p className={overview.jumpReadings} title={`Change: ${formatMetricNumber(item.change,item.metric.key)} ${item.changeUnit === "pp" ? "percentage points" : item.changeUnit}`}>{formatMetricNumber(item.previous.value,item.metric.key,item.previous.source)} → {formatMetricNumber(item.latest.value,item.metric.key,item.latest.source)} {item.latest.unit === "ratio" ? "" : item.latest.unit}</p>
          <p className="muted mb-0 text-xs"><time dateTime={item.previous.measuredAt}>{leaderboardTestDate(item.previous.measuredAt)}</time> → <time dateTime={item.latest.measuredAt}>{leaderboardTestDate(item.latest.measuredAt)}</time></p>
        </li>)}</ul> : <p className="m-0 text-xs leading-5 text-[var(--text-secondary)]">{showMethods ? "Biggest gains will show up after another test." : "Your biggest gains will show up after another test."}</p>}
      </section>
    </div>
    {!comparableCount && <p className="m-0 max-w-3xl text-xs leading-6 text-[var(--text-secondary)]">Team comparisons need at least five players with the same test or game stat. {showMethods ? "This player’s own results are available in the other tabs." : "Your own results are available in the other tabs."}</p>}
    {(physicality.some(card=>card.latest) || games.length > 0 || testingGroups.length > 0) && <details className={overview.comparisonBoard} aria-label="Detailed team comparisons">
      <summary className={overview.boardHeader}><div><ChartNoAxesCombined size={20} aria-hidden="true"/><span>Detailed Team Comparisons</span></div><span>Percentiles, testing and game stats <ChevronDown size={16} aria-hidden="true"/></span></summary>
      <PercentileLegend/>
      {(physicality.some(card=>card.latest) || games.length > 0) && <div className={overview.primaryComparisons} data-has-body={physicality.some(card=>card.latest)} data-has-games={games.length>0}>
        {physicality.some(card=>card.latest) && <div className={overview.physicalityComparison}>{hasPhysicalityRadar ? <PhysicalityRadar cards={physicality}/> : <TestingComparisons teamAverages={teamAverages} title="Physicality" cards={physicality.filter(card => card.latest)}/>}</div>}
        <GameComparisons metrics={games.filter(item => !isAdvancedGameMetric(item.metric))}/>
      </div>}
      {testingGroups.length > 0 && <div className={overview.testingCards} aria-label="Testing percentiles">{testingGroups.map(group=><TestingComparisons key={group.id} teamAverages={teamAverages} title={group.title} context={group.context} cards={group.cards}/>)}</div>}
    </details>}
    {trends.length > 0 && <details className={overview.moreTesting}><summary>Testing Trends <ChevronDown size={16} aria-hidden="true"/></summary><ProfileTrendChart series={trends}/></details>}
    {showMethods && <details className="group border-t border-[var(--line-subtle)] pt-4 text-xs text-[var(--text-secondary)]"><summary className="flex min-h-8 w-fit cursor-pointer list-none items-center gap-2 font-semibold">How These Highlights Work<ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
      <div className="mt-3 max-w-3xl space-y-2 leading-relaxed">
        <p>Strengths are in the top quarter of the Pacific team; areas to work on are in the bottom quarter. Testing comparisons use the same test, source, unit and period; game comparisons use the same current cumulative QPA or pitching snapshot, with at least five comparable players. Game highlights include advanced production rates, WHIP, K/BB, K/9, BB/9, Runs/9 and Strike %, with opportunity counts and limited-sample labels. Lower batting K % is favorable. Playing-time totals do not decide strengths or areas to work on. Up to three results appear in each section.</p>
        <p>Biggest jumps compare the latest result with the previous testing date for the same measurement, source, unit and period. Gains are ordered by relative percentage improvement; higher or lower values count as improvement according to the test. A percentage improvement is relative to the previous value, not a percentage-point change. Displayed improvement percentages are rounded to one decimal.</p>
        <p>Body fat ranks lower percentages higher, matching the leaderboard. Height, weight, body composition and fastball spin stay descriptive throughout the profile. They are not labeled strengths, weaknesses or improvements. These highlights summarize current recorded results, not a prediction. Cumulative game snapshots do not establish biggest jumps.</p>
      </div>
    </details>}
  </section>;
}
