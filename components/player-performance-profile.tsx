import presentation from "./player-profile-presentation.module.css";
import { fullSwingFileLabel } from "@/lib/full-swing-file-label";
import { HittingTeamAverageLine } from "@/components/hitting-team-average";
import { hittingTeamAverage, type HittingTeamAverage } from "@/lib/hitting-team-averages";
import { BlastPracticeReports } from "@/components/blast-practice-reports";
import type { Measurement } from "@/lib/imports/engine";
import { profileMetricLabel } from "@/lib/profile-metric-label";
import { parseBlastSource, blastPeriodLabel, formatBlastValue } from "@/lib/blast-metrics";
import { ProfileTrendChart } from "@/components/profile-trend-chart";
import { SessionProgress } from "@/components/session-progress";
import { SessionTimeline } from "@/components/session-timeline";
import { PracticeGameBridge } from "@/components/practice-game-bridge";
import { blastProgress, pitchProgress } from "@/lib/session-progress";
import { profileTrends } from "@/lib/profile-trends";
import type { SharedGameStat } from "@/lib/game-server";
import type { GameComparison } from "@/lib/game-metrics";
import { MeasurementChange } from "@/components/measurement-change";
import { playerRenphoChange } from "@/lib/measurement-change";
import { RenphoBodyScore } from "@/components/renpho-body-score";
import { StatInfo } from "@/components/stat-info";
import { PercentileBar } from "@/components/percentile-bar";
import type { ReactNode } from "react";
import { PacificLogo } from "@/components/pacific-brand";
import { ProfileTabs, type ProfileTab } from "@/components/profile-tabs";
import { PlayerOverview } from "@/components/player-overview";
import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import { athleteName, display, type AthleteSeason, type RosterAthlete } from "@/lib/types";
import { getPlayerProfileLayout, getSessionPerformance, withoutWeeklyBlastCards } from "@/lib/player-profile-layout";
import { formatHeight, formatMetricNumber } from "@/lib/measurement-display";
import { isTimedMetric, type getPlayerPerformance, type PlayerMetricCard, type PlayerMetricReading } from "@/lib/player-performance";

export type PlayerPerformanceProfileProps = {
  athlete: RosterAthlete; performance: ReturnType<typeof getPlayerPerformance>; season?: AthleteSeason | null;
  overviewGameStats?: SharedGameStat[]; gameComparisons?: GameComparison[];
  teamAverages?: readonly HittingTeamAverage[]; blastReadings?: readonly Measurement[]; timelineReadings?: readonly Measurement[]; pitchResults?: ReactNode; practicePitchResults?: ReactNode; contactResults?: ReactNode; practiceContactResults?: ReactNode; coachFocus?:ReactNode; simplified?: boolean; fictional?: boolean; action?: ReactNode; muscleBalance?: ReactNode; movementScreening?: ReactNode; physicalityDetails?: ReactNode; history?: ReactNode; gameStats?: ReactNode;
};
function measurementDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}
function ReadingValue({ reading }: { reading: PlayerMetricReading }) {
  const height = reading.metricKey === "height" ? formatHeight(reading.value, reading.unit) : null;
  if (height) return <span className="font-extrabold tabular-nums" title={`Recorded: ${reading.value} ${reading.unit}`}>{height}</span>;
  const value = parseBlastSource(reading.source) ? formatBlastValue(reading.value,reading.unit) : formatMetricNumber(reading.value, reading.metricKey, reading.source, reading.unit === "s" ? reading.value.toFixed(2) : reading.derived ? `≈${reading.value.toFixed(1)}` : String(reading.value));
  return <><span className="font-extrabold tabular-nums">{value}</span><span className="ml-1.5 text-sm font-medium tracking-normal text-[var(--text-secondary)]">{reading.unit}</span></>;
}
function Percentile({ card }: { card: PlayerMetricCard }) {
  const percentile = card.percentile;
  if (!card.latest || !percentile || !Number.isFinite(percentile.value) || percentile.value < 0 || percentile.value > 100 || percentile.sampleSize < 5) return null;
  const rounded = Math.round(percentile.value), neutral = card.metric.direction === "neutral";
  return <div className="mt-3 border-t border-[var(--line-subtle)] pt-2" data-testid="player-percentile" data-metric-key={card.metric.key} data-percentile={percentile.value} data-sample-size={percentile.sampleSize} data-direction={card.metric.direction}>
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1 text-[11px] text-[var(--text-secondary)]"><span>{percentile.sampleSize} teammates</span><span><strong className="text-[var(--text-primary)]">{rounded}</strong> percentile</span></div>
    <PercentileBar value={percentile.value} sampleSize={percentile.sampleSize} label={card.metric.label} descriptive={neutral} testId="player-percentile-bar" />
  </div>;
}
function MetricSparkline({card}:{card:PlayerMetricCard}) {
  const trend=profileTrends([card])[0];
  if(!trend)return null;
  const values=trend.points.map(point=>point.value), low=Math.min(...values), high=Math.max(...values);
  const span=Math.max(high-low,Math.abs(high)*.05,.1), base=low-(span-(high-low))/2;
  const coordinates=trend.points.map((point,index)=>({x:3+index*124/(trend.points.length-1),y:34-(point.value-base)/span*30}));
  const latest=trend.points.at(-1)!,previous=trend.points.at(-2)!;
  const delta=latest.value-previous.value;
  const label=`${trend.label}: ${trend.points.length} test dates, ${previous.value} to ${latest.value} ${trend.unit}`;
  return <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--line-subtle)] pt-3" aria-label={label}>
    <span className="text-[11px] text-[var(--text-secondary)]">Since previous test <strong className="ml-1 font-semibold tabular-nums text-[var(--text-primary)]">{delta>0?"+":""}{formatMetricNumber(delta,card.metric.key,trend.source,delta.toFixed(isTimedMetric(card.metric.key)?2:1))} {trend.unit}</strong></span>
    <svg viewBox="0 0 130 38" width="94" height="32" className="shrink-0" role="img" aria-label={`${trend.label} trend across ${trend.points.length} dates`}>
      <polyline points={coordinates.map(point=>`${point.x},${point.y}`).join(" ")} fill="none" stroke="var(--accent-readable)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={coordinates.at(-1)!.x} cy={coordinates.at(-1)!.y} r="3.5" fill="var(--accent-readable)"/>
    </svg>
  </div>;
}
function MetricCard({ card, teamAverages=[] }: { card: PlayerMetricCard; teamAverages?: readonly HittingTeamAverage[] }) {
  const reading = card.latest;
  return <li className={`performance-metric-card flex min-w-0 flex-col rounded-lg border border-[var(--line-subtle)] p-3 sm:p-4 ${reading ? "bg-[var(--surface-panel)]" : "border-dashed bg-[var(--surface-page)]"}`} data-testid="player-metric" data-metric-key={card.metric.key} data-value={reading?.value} data-unit={reading?.unit} data-date={reading?.measuredAt}>
    <h3 className={presentation.metricTitle}>{profileMetricLabel(card.metric.key,card.metric.key === "bat_speed" ? "Bat Speed (Unspecified)" : card.metric.label,reading?.source)}<StatInfo metric={card.metric.key} label={card.metric.label} /></h3>
    <div className={presentation.metricValue}>{reading ? <><span className={presentation.readingValue}>{card.timedTrials && <span className={presentation.bestLabel}>Best</span>}<ReadingValue reading={reading} /></span><MeasurementChange change={playerRenphoChange(card)} metric={card.metric.key}/></> : <span className="font-medium text-[var(--text-secondary)]" aria-label="Not yet tested">—</span>}</div>
    {reading && card.metric.group === "hitting" && /^Full Swing · (Game|Intrasquad|Practice|Hitting)$/.test(reading.source) && <HittingTeamAverageLine average={hittingTeamAverage(teamAverages,card.metric.key,reading.unit,reading.source)}/>}
    {!reading && <p className="mb-0 mt-3 text-[11px] text-[var(--text-secondary)]">Not Yet Tested</p>}
    {card.timedTrials && <p className="mb-0 mt-2 text-sm text-[var(--text-secondary)]">Average <strong className="tabular-nums text-[var(--text-primary)]">{card.timedTrials.average.toFixed(2)} s</strong><span className="ml-2 text-xs">{card.timedTrials.count} {card.timedTrials.count === 1 ? "trial" : "trials"} · Fall 2026</span></p>}
    {reading && <div className={presentation.metricMeta}>
      {card.metric.group !== "body" && <p className={presentation.metricSource}>{reading.source}</p>}
      <p className={presentation.metricDate}>{parseBlastSource(reading.source) ? <>Reporting Week: {blastPeriodLabel(parseBlastSource(reading.source)!.start,parseBlastSource(reading.source)!.end)}</> : <>Last Tested: <time dateTime={card.timedTrials?.lastTested ?? reading.measuredAt}>{measurementDate(card.timedTrials?.lastTested ?? reading.measuredAt)}</time></>}{reading.derived ? " · Calculated" : ""}</p>
    </div>}
    <Percentile card={card} />
    <MetricSparkline card={card}/>
  </li>;
}
function MetricGroup({ id, title, cards, teamAverages=[] }: { id: string; title: string; cards: PlayerMetricCard[]; teamAverages?: readonly HittingTeamAverage[] }) {
  if (!cards.length) return null;
  return <section id={id} aria-labelledby={`${id}-heading`} className={presentation.metricGroup}><div className={presentation.groupHeading}><h2 id={`${id}-heading`}>{title}</h2><span aria-hidden="true" /></div><ul className={presentation.metricGrid}>{cards.map(card => <MetricCard key={`${card.metric.key}:${card.latest?.source}:${card.latest?.unit}`} card={card} teamAverages={teamAverages} />)}</ul>{cards.some(card => card.latest && (!card.percentile || card.percentile.sampleSize < 5)) && <p className="mb-0 mt-3 text-xs leading-5 text-[var(--text-secondary)]">Team rankings appear once at least five players have the same test result.</p>}</section>;
}
function SessionMeasurements({ performance, season, context, hasBlast=false, teamAverages=[] }: { teamAverages?:readonly HittingTeamAverage[]; performance: ReturnType<typeof getPlayerPerformance>; season?: AthleteSeason | null; context: "in_game" | "practice"; hasBlast?: boolean }) {
  const layout = getPlayerProfileLayout(getSessionPerformance(performance, context), season);
  const hitting = layout.showHitting ? [...layout.hitting, ...layout.otherHitting] : [];
  const throwing = [...layout.fieldThrowing, ...layout.pitching];
  const hasData = hitting.length + throwing.length > 0;
  if(hasBlast && !hasData)return null;
  return <section className={presentation.sessionMeasurements} aria-label={context === "in_game" ? "In-Game measurements" : "Practice measurements"}>
    <header className={presentation.sessionHeading}><div><p>{context === "in_game" ? "In-Game" : "Practice"} <span aria-hidden="true">/</span> Latest Sessions</p><h2>{context === "in_game" ? "Games & Intrasquad" : (hasBlast ? "Other Practice & Testing" : "Practice & Testing")}</h2></div><span className={presentation.seasonBadge}>Fall 2026</span></header>
    {!hasData && <p className={presentation.emptyState}>{context === "in_game" ? "No game or intrasquad test results yet." : "No practice measurements recorded yet."}</p>}
    <MetricGroup id={`${context}-hitting`} title="Hitting" cards={hitting} teamAverages={teamAverages} />
    <MetricGroup id={`${context}-field`} title="Position Throwing" cards={layout.fieldThrowing} />
    <MetricGroup id={`${context}-pitching`} title="Pitching" cards={layout.pitching} />
    <ProfileTrendChart series={profileTrends([...hitting, ...throwing])} />
  </section>;
}
export function PlayerPerformanceProfile({ athlete, performance, season, blastReadings, timelineReadings=[], teamAverages=[], pitchResults, practicePitchResults, contactResults, practiceContactResults, coachFocus, fictional = false, simplified = false, action, muscleBalance, movementScreening, physicalityDetails, history, gameStats, overviewGameStats = [], gameComparisons = [] }: PlayerPerformanceProfileProps) {
  const hasBlast = !!blastReadings?.some(r=>parseBlastSource(r.source));
  const displayPerformance = hasBlast ? withoutWeeklyBlastCards(performance) : performance;
  const bodyScoreCard = performance.body.find(card => card.metric.key === "body_score" && card.latest);
  const bodyScore = bodyScoreCard?.latest ?? null;
  const selectedSeason = season ?? [...athlete.athlete_seasons].sort((a, b) => b.season.localeCompare(a.season))[0];
  const position = [selectedSeason?.primary_position, selectedSeason?.secondary_position].filter((value, index, values) => value && values.indexOf(value) === index).join(" / ");
  const layout = getPlayerProfileLayout(displayPerformance, selectedSeason);
  const cards = [...layout.physicality, ...layout.additionalBody, ...layout.speedAgility, ...(layout.showHitting ? [...layout.hitting, ...layout.otherHitting] : []), ...layout.fieldThrowing, ...layout.pitching];
  const sourcedCards = [...cards.flatMap(card => card.sourceCards ?? [card]), ...performance.body.filter(card => card.metric.key === "body_score")].filter(card => card.latest);
  const lastTested = sourcedCards.map(card => card.timedTrials?.lastTested ?? card.latest!.measuredAt).sort().at(-1);
  const latestBlast = layout.showHitting ? blastReadings?.flatMap(r => { const period=parseBlastSource(r.source); return period?[period]:[]; }).sort((a,b)=>b.end.localeCompare(a.end))[0] : undefined;
  const newerReport = latestBlast && latestBlast.end > (lastTested ?? "") ? latestBlast : null;
  const tabs: ProfileTab[] = [
    { id: "overview", label: "Overview", content: <><PlayerOverview teamAverages={teamAverages} twoWay={selectedSeason?.player_type?.trim().toLowerCase() === "two_way"} showMethods={!simplified} cards={[...cards, ...(bodyScoreCard ? [bodyScoreCard] : [])]} gameStats={overviewGameStats} gameComparisons={gameComparisons} />{coachFocus}{layout.showHitting&&<PracticeGameBridge performance={performance} blastReadings={blastReadings}/>}</> },
    { id: "physicality", label: "Physicality", content: <>
      {!layout.physicality.length && !layout.additionalBody.length && !bodyScore && <p className={presentation.emptyState}>No physicality measurements recorded yet.</p>}
      <MetricGroup id="body-measurements" title="Physicality" cards={layout.physicality} />
      <div className={bodyScore && layout.additionalBody.length ? presentation.composition : undefined}>
        {bodyScore && <RenphoBodyScore reading={bodyScore} change={bodyScoreCard ? playerRenphoChange(bodyScoreCard) : null}/>}
        {!!layout.additionalBody.length && <MetricGroup id="body-composition" title="Body Composition" cards={layout.additionalBody} />}
      </div>
      {!!layout.speedAgility.length && <MetricGroup id="speed-agility" title="Speed & Agility" cards={layout.speedAgility} />}
      {movementScreening}
      {muscleBalance}
      <ProfileTrendChart series={profileTrends([...layout.physicality, ...layout.additionalBody, ...(bodyScoreCard ? [bodyScoreCard] : []), ...layout.speedAgility])} />
      {!simplified && physicalityDetails}
    </> },
    { id: "in-game", label: "In-Game", content: <><SessionMeasurements teamAverages={teamAverages} performance={performance} season={selectedSeason} context="in_game" />{layout.showHitting && contactResults}{pitchResults}{gameStats && <section aria-label="Cumulative game statistics" className="space-y-4 border-t border-[var(--line-subtle)] pt-6"><h2 className="m-0 text-xl font-bold">Cumulative Game Stats · Fall 2026</h2>{gameStats}</section>}</> },
    { id: "practice", label: "Practice", content: <>{layout.showHitting && hasBlast && <BlastPracticeReports teamAverages={teamAverages} readings={blastReadings!}/>}<SessionMeasurements teamAverages={teamAverages} performance={displayPerformance} season={selectedSeason} context="practice" hasBlast={hasBlast && layout.showHitting} />{layout.showHitting && practiceContactResults}{practicePitchResults}</> },
    { id: "progress", label: "Timeline", content: <><SessionTimeline readings={timelineReadings}/><SessionProgress blast={layout.showHitting ? blastProgress(blastReadings ?? []) : []} pitchingGame={pitchProgress(blastReadings ?? [],"in_game")} pitchingPractice={pitchProgress(blastReadings ?? [],"practice")} /></> },
  ];
  return <div className={`min-w-0 space-y-4 sm:space-y-5 ${presentation.profile}`} data-testid="player-performance-profile">
    <section className="player-identity-card" aria-label="Player profile">
      <div className="pointer-events-none absolute -right-24 -top-32 -z-10 size-80 rotate-45 border border-white/[.05]" aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><PacificLogo className="w-9 shrink-0" decorative /><p className="m-0 text-[10px] font-bold uppercase tracking-[.18em] text-[#e0e0e3]">Pacific Baseball<span className="mx-2 text-[#a4a4aa]" aria-hidden="true">/</span>Performance</p></div>{fictional && <span className="shrink-0 rounded border border-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Fictional profile</span>}</div>
      <div className="my-3 flex items-center justify-between gap-4 sm:my-3 sm:gap-6">
        <div className="min-w-0"><h1 className="m-0 break-words text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-4xl">{athleteName(athlete)}</h1><p className="mb-0 mt-3 text-sm font-semibold text-[#d6d6dc]">{position || "Position to be added"}</p></div>
        <dl className="m-0 shrink-0 border-l border-white/15 pl-4 text-center sm:pl-8"><dt className="text-[9px] font-semibold uppercase tracking-[.1em] text-[#b3b4ba]">Jersey Number</dt><dd className="m-0 mt-2 text-5xl font-black leading-none tracking-tighter text-white sm:text-5xl">{display(selectedSeason?.jersey_number)}</dd></dl>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-2 border-t border-white/15 pt-4 text-xs sm:grid-cols-4"><div><dt className="text-[10px] uppercase tracking-wider text-[#a7a8af]">Bats / Throws</dt><dd className="m-0 mt-1.5 font-semibold">{display(selectedSeason?.bats)} / {display(selectedSeason?.throws)}</dd></div><div><dt className="text-[10px] uppercase tracking-wider text-[#a7a8af]">Season</dt><dd className="m-0 mt-1.5 font-semibold">{selectedSeason?.season ?? "To be added"}</dd></div><div><dt className="text-[10px] uppercase tracking-wider text-[#a7a8af]">PAC ID</dt><dd className="m-0 mt-1.5 font-mono font-semibold">{athlete.athlete_code}</dd></div><div><dt className="text-[10px] uppercase tracking-wider text-[#a7a8af]">{newerReport ? "Latest Report" : "Last Tested"}</dt><dd className="m-0 mt-1.5 font-semibold">{newerReport ? blastPeriodLabel(newerReport.start,newerReport.end) : lastTested ? <time dateTime={lastTested}>{measurementDate(lastTested)}</time> : "Not Yet Tested"}</dd></div></dl>
    </section>

    <ProfileTabs key={athlete.athlete_code} tabs={tabs} action={action} />
    {!simplified && history}
    {!simplified && <details className="group rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)]" data-testid="player-performance-methods"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold sm:px-6">Sources &amp; Percentiles<ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
      <div className="space-y-5 border-t border-[var(--line-subtle)] px-5 py-5 text-xs leading-6 text-[var(--text-secondary)] sm:px-6"><p className="m-0">Timed tests show the fastest recorded trial and the average of recorded trials in the same Fall testing protocol; blanks are excluded. Timed percentiles use each player’s best time. Other Pacific percentiles compare the latest comparable reading per player within the same metric, unit, source and testing period. Tied values share a percentile. They describe this team cohort, with no MLB, NCAA or outside-athlete comparison. The mark at 50 is the cohort midpoint.</p>
        <div className="grid gap-3 sm:grid-cols-2"><p className="m-0"><ArrowUp size={13} className="mr-1 inline" aria-hidden="true" />For metrics where higher is better, a larger measured value produces a higher percentile. <ArrowDown size={13} className="mx-1 inline" aria-hidden="true" />For lower-is-better metrics, including timed tests and BB %, a lower measured value produces a higher percentile.</p><p className="m-0">Blue indicates a lower percentile; red indicates a higher percentile. Lower body fat produces a higher percentile. For height, weight, muscle mass, body score and spin, higher measured values produce higher percentiles. Body measurements remain descriptive. Missing values and cohorts under 5 are not charted.</p></div>
        <p className="m-0">RENPHO changes compare the previous distinct test date for the same measurement, source and unit, including a prior summer report. Percent changes are relative to the prior result; no percent is shown for a zero prior value or an ambiguous same-day comparison. Green marks higher muscle mass/body score or lower body fat; red marks the reverse. Weight, height and other report measurements remain neutral. Colors are display directions, not health ratings.</p>
        <p className="m-0">Baseball performance window: September 1–December 31, 2026. Body comparisons use separate June 1–August 31 and September 1–December 31 testing periods. Each reading carries its recorded test date. Height displays in feet and inches, rounded to one tenth of an inch. Original values and units remain below; different units are never mixed in a percentile. Calculated values marked ≈ are rounded to one decimal in the snapshot; the full result and formula appear below.</p>
        {sourcedCards.length > 0 ? <div className="overflow-x-auto"><table><caption className="sr-only">Sources for the performance snapshot</caption><thead><tr><th>Measurement</th><th>Test Date</th><th>Value</th><th>Source / Method</th></tr></thead><tbody>{sourcedCards.map(card => {
          const reading = card.latest!;
          return <tr key={`${card.metric.key}:${reading.source}:${reading.unit}`}><td className="font-semibold">{profileMetricLabel(card.metric.key,card.metric.label,reading.source)}<StatInfo metric={card.metric.key} label={card.metric.label} /></td><td className="whitespace-nowrap">{reading.measuredAt}</td><td className="whitespace-nowrap">{formatMetricNumber(reading.value,card.metric.key,reading.source)} {reading.unit}</td><td className="min-w-52 max-w-sm break-words">{reading.derived && reading.derivation && <p className="mb-1 mt-0">{reading.derivation}</p>}<span>{reading.source}</span>{reading.provenance.map(source => <span className="mt-1 block" key={source.id}>{fullSwingFileLabel(source.source_file,reading.source,reading.measuredAt)} · {source.source_sheet || "File"} · Row {source.source_row}</span>)}</td></tr>;
        })}</tbody></table></div> : <p className="m-0">Source details appear with the first reviewed measurements.</p>}
      </div>
    </details>}
  </div>;
}
