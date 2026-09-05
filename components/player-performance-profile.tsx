import type { ReactNode } from "react";
import { Activity, ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import { athleteName, display, type AthleteSeason, type RosterAthlete } from "@/lib/types";
import type { getPlayerPerformance, PlayerMetricCard, PlayerMetricReading } from "@/lib/player-performance";

export type PlayerPerformanceProfileProps = {
  athlete: RosterAthlete;
  performance: ReturnType<typeof getPlayerPerformance>;
  season?: AthleteSeason | null;
  fictional?: boolean;
  action?: ReactNode;
};

function measurementDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function ReadingValue({ reading }: { reading: PlayerMetricReading }) {
  const value = reading.derived ? `≈${reading.value.toFixed(1)}` : String(reading.value);
  return <><span className="break-all font-bold tabular-nums">{value}</span><span className="ml-1 text-xs font-medium text-[#65666b]">{reading.unit}</span></>;
}

function Percentile({ card }: { card: PlayerMetricCard }) {
  const percentile = card.percentile;
  const available = card.latest && percentile && Number.isFinite(percentile.value) && percentile.value >= 0 && percentile.value <= 100 && percentile.sampleSize >= 5;
  const neutral = card.metric.direction === "neutral";
  if (!available) {
    return <div className="text-xs leading-5 text-[#74757a]" data-testid="player-percentile-unavailable">
      {card.cohortSampleSize !== null && card.latest && <span className="mr-1.5 font-semibold text-[#55565c]">Pacific n={card.cohortSampleSize}</span>}
      {card.percentileStatus === "small_cohort" ? "Need 5 comparable players" : card.latest ? "Team comparison not available" : "Percentile appears after testing"}
    </div>;
  }
  const rounded = Math.round(percentile.value);
  return <div data-testid="player-percentile" data-metric-key={card.metric.key} data-percentile={percentile.value} data-sample-size={percentile.sampleSize} data-direction={card.metric.direction}>
    <div className="mb-2 flex items-baseline justify-between gap-3"><span className="text-[11px] font-medium text-[#737479]">Pacific n={percentile.sampleSize}</span><span className={`text-xs font-bold tabular-nums ${neutral ? "text-[#484950]" : "text-pacu-red"}`}>{rounded}<span className="ml-1 font-normal text-[#737479]">percentile</span></span></div>
    <div role="meter" aria-label={`${card.metric.label} Pacific percentile`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentile.value} aria-valuetext={`${rounded} percentile among ${percentile.sampleSize} comparable Pacific players${neutral ? "; measured value, not a rating" : ""}`} className="relative h-2.5 rounded-full bg-[#eeeeef]" data-testid="player-percentile-bar">
      <span className={`absolute inset-y-0 left-0 rounded-full ${neutral ? "bg-[#6d6e75]" : "bg-pacu-red"}`} style={{ width: `${percentile.value}%` }} aria-hidden="true" />
      <span className="absolute -top-0.5 left-1/2 h-3.5 w-px bg-[#484950]/45" aria-hidden="true" />
      <span className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${neutral ? "bg-[#6d6e75]" : "bg-pacu-red"}`} style={{ left: `${percentile.value}%` }} aria-hidden="true" />
    </div>
  </div>;
}

function MetricRow({ card }: { card: PlayerMetricCard }) {
  const reading = card.latest;
  const baseline = card.summerBaseline;
  return <li className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-3 border-t border-[#eeeef0] px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_6rem]" data-testid="player-metric" data-metric-key={card.metric.key} data-value={reading?.value} data-unit={reading?.unit} data-date={reading?.measuredAt}>
    <div className="min-w-0"><h3 className="m-0 text-sm font-semibold text-[#24252a]">{card.metric.label}</h3>
      {reading ? <p className="mb-0 mt-1 text-[11px] text-[#74757a]"><time dateTime={reading.measuredAt}>{measurementDate(reading.measuredAt)}</time><span className="mx-1.5" aria-hidden="true">·</span>{reading.period === "summer_2026" ? "Summer baseline" : "Fall 2026"}{reading.derived ? " · Calculated" : ""}</p> : <p className="mb-0 mt-1 text-[11px] text-[#74757a]">No {card.metric.group === "body" ? "reviewed reading" : "Fall 2026 reading"}</p>}
    </div>
    <div className="text-right text-lg md:order-3">{reading ? <ReadingValue reading={reading} /> : <span className="text-sm font-medium text-[#8a8b90]">No data</span>}</div>
    <div className="col-span-2 min-w-0 md:order-2 md:col-span-1"><Percentile card={card} /></div>
    {baseline && reading?.period === "fall_2026" && <p className="col-span-2 mb-0 mt-0 text-[11px] text-[#77787d] md:order-4 md:col-span-3">Summer baseline: {String(baseline.value)} {baseline.unit} · <time dateTime={baseline.measuredAt}>{measurementDate(baseline.measuredAt)}</time>{baseline.unit !== reading.unit ? " · Different units; shown separately" : ""}</p>}
  </li>;
}

function MetricGroup({ id, title, description, cards, neutral = false }: { id: string; title: string; description: string; cards: PlayerMetricCard[]; neutral?: boolean }) {
  const hasPercentile = cards.some(card => card.percentile && card.percentile.sampleSize >= 5);
  return <section id={id} className="overflow-hidden rounded-lg border border-[#e0e0e3] bg-white" aria-labelledby={`${id}-heading`}>
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-5 sm:px-6"><div><h2 id={`${id}-heading`} className="m-0 text-xl font-bold tracking-tight">{title}</h2><p className="mb-0 mt-1 max-w-2xl text-xs leading-5 text-[#717277]">{description}</p></div><span className="rounded border border-[#e9e9eb] px-2 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#686970]">{neutral ? "Measured values" : "Fall 2026"}</span></div>
    {hasPercentile && <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_6rem] gap-x-5 border-t border-[#eeeef0] bg-[#fbfbfc] px-6 py-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[#77787e] md:grid"><span>Measurement / test date</span><div className="flex justify-between"><span>0</span><span>Pacific percentile · 50</span><span>100</span></div><span className="text-right">Latest</span></div>}
    <ul className="m-0 list-none p-0">{cards.map(card => <MetricRow key={card.metric.key} card={card} />)}</ul>
    {!cards.length && <p className="mx-5 mb-5 text-sm text-[#717277]">No reviewed measurements are available in this group.</p>}
  </section>;
}

export function PlayerPerformanceProfile({ athlete, performance, season, fictional = false, action }: PlayerPerformanceProfileProps) {
  const selectedSeason = season ?? [...athlete.athlete_seasons].sort((a, b) => b.season.localeCompare(a.season))[0];
  const playerType = selectedSeason?.player_type?.toLowerCase().replace(/[\s-]+/g, "_");
  const showHitting = playerType !== "pitcher";
  const showPitching = playerType !== "position";
  const position = [selectedSeason?.primary_position, selectedSeason?.secondary_position].filter((value, index, values) => value && values.indexOf(value) === index).join(" / ");
  const cards = [...performance.body, ...(showHitting ? performance.hitting : []), ...(showPitching ? performance.pitching : [])];
  const sourcedCards = cards.filter(card => card.latest);
  const bodyFirst = performance.body.some(card => card.latest) && ![...(showHitting ? performance.hitting : []), ...(showPitching ? performance.pitching : [])].some(card => card.latest);
  const body = <MetricGroup id="body-measurements" title="Body measurements" description="Latest reviewed body readings. Summer measurements stay visible as a baseline until Fall testing is added. Body percentiles describe measured values, not a rating." cards={performance.body} neutral />;
  return <div className="min-w-0 space-y-6" data-testid="player-performance-profile">
    <section className="relative overflow-hidden rounded-lg border-t-4 border-pacu-red bg-[#1c1d20] px-5 py-6 text-white sm:px-8 sm:py-8" aria-label="Player profile">
      <div className="flex items-center justify-between gap-4"><p className="m-0 text-[10px] font-bold uppercase tracking-[.2em] text-[#e0e0e3]">Pacific Baseball<span className="mx-2 text-[#a4a4aa]" aria-hidden="true">/</span>Performance</p><span className="shrink-0 rounded border border-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">{fictional ? "Fictional profile" : "Player profile"}</span></div>
      <div className="mt-7 flex items-center justify-between gap-4 sm:gap-8">
        <div className="min-w-0"><h1 className="m-0 break-words text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl">{athleteName(athlete)}</h1><p className="mb-0 mt-3 text-sm font-semibold text-[#ededf0]">{position || "Position to be added"}</p>
          <dl className="mb-0 mt-5 flex flex-wrap gap-x-6 gap-y-3 text-xs"><div><dt className="text-[10px] uppercase tracking-wider text-[#a7a8af]">Bats / Throws</dt><dd className="m-0 mt-1 font-semibold">{display(selectedSeason?.bats)} / {display(selectedSeason?.throws)}</dd></div><div><dt className="text-[10px] uppercase tracking-wider text-[#a7a8af]">Season</dt><dd className="m-0 mt-1 font-semibold">{selectedSeason?.season ?? "To be added"}</dd></div></dl>
        </div>
        <dl className="m-0 shrink-0 border-l border-white/15 pl-4 text-center sm:pl-8"><dt className="text-[9px] font-semibold uppercase tracking-[.1em] text-[#b3b4ba]">Jersey number</dt><dd className="m-0 mt-2 text-5xl font-black leading-none tracking-tighter sm:text-7xl">{display(selectedSeason?.jersey_number)}</dd></dl>
      </div>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dfdfe2] pb-4"><nav aria-label="Performance profile sections" className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold">{showHitting && <a className="text-[#34353b] no-underline hover:text-pacu-red" href="#hitting-performance">Hitting</a>}{showPitching && <a className="text-[#34353b] no-underline hover:text-pacu-red" href="#pitching-performance">Pitching</a>}<a className="text-[#34353b] no-underline hover:text-pacu-red" href="#body-measurements">Body</a></nav>{action}</div>
    <div className="flex items-start gap-3"><Activity size={18} className="mt-0.5 shrink-0 text-pacu-red" aria-hidden="true" /><div><h2 className="m-0 text-sm font-bold">Your performance snapshot</h2><p className="mb-0 mt-1 text-xs leading-5 text-[#717277]">Exact readings with their test dates. Percentile bars appear when at least 5 comparable Pacific players have data.</p></div></div>
    {bodyFirst && body}
    {showHitting && <MetricGroup id="hitting-performance" title="Hitting performance" description="Fall 2026 hitting and athletic testing. Missing readings stay empty until reviewed data is added." cards={performance.hitting} />}
    {showPitching && <MetricGroup id="pitching-performance" title="Pitching performance" description="Fall 2026 pitching measurements. Spin is shown as a measured value; more spin is not automatically better." cards={performance.pitching} />}
    {!bodyFirst && body}

    <details className="group rounded-lg border border-[#e0e0e3] bg-white" data-testid="player-performance-methods"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold sm:px-6">Sources &amp; percentile method<ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
      <div className="space-y-5 border-t border-[#eeeef0] px-5 py-5 text-xs leading-6 text-[#65666d] sm:px-6"><p className="m-0">Pacific percentiles compare the latest comparable reading per player within the same metric, unit, source and testing period. Tied values share a percentile. They describe this team cohort, with no MLB, NCAA or outside-athlete comparison. The mark at 50 is the cohort midpoint.</p>
        <div className="grid gap-3 sm:grid-cols-2"><p className="m-0"><ArrowUp size={13} className="mr-1 inline" aria-hidden="true" />For metrics where higher is better, a larger measured value produces a higher percentile. <ArrowDown size={13} className="mx-1 inline" aria-hidden="true" />For lower-is-better metrics, including timed tests and BB %, a lower measured value produces a higher percentile.</p><p className="m-0">Body composition and spin use neutral bars. Higher percentiles indicate higher measured values in those groups, without a good/bad score. Missing values and cohorts under 5 are not charted.</p></div>
        <p className="m-0">Baseball performance window: September 1–December 31, 2026. Summer body baseline: June 1–August 31, 2026. Each reading carries its recorded test date. Values retain their saved units, and different units are never mixed in a percentile. Calculated values marked ≈ are rounded to one decimal in the snapshot; the full result and formula appear below.</p>
        {sourcedCards.length > 0 ? <div className="overflow-x-auto"><table><caption className="sr-only">Sources for the performance snapshot</caption><thead><tr><th>Measurement</th><th>Test date</th><th>Value</th><th>Source / method</th></tr></thead><tbody>{sourcedCards.map(card => {
          const reading = card.latest!;
          return <tr key={card.metric.key}><td className="font-semibold">{card.metric.label}</td><td className="whitespace-nowrap">{reading.measuredAt}</td><td className="whitespace-nowrap">{String(reading.value)} {reading.unit}</td><td className="min-w-52 max-w-sm break-words">{reading.derived && reading.derivation && <p className="mb-1 mt-0">{reading.derivation}</p>}<span>{reading.source}</span>{reading.provenance.map(source => <span className="mt-1 block" key={source.id}>{source.source_file} · {source.source_sheet || "File"} · Row {source.source_row}</span>)}</td></tr>;
        })}</tbody></table></div> : <p className="m-0">Source details appear with the first reviewed measurements.</p>}
      </div>
    </details>
  </div>;
}
