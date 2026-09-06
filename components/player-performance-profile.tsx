import type { ReactNode } from "react";
import { PacificLogo } from "@/components/pacific-brand";
import { ProfileTabs, type ProfileTab } from "@/components/profile-tabs";
import { PlayerOverview } from "@/components/player-overview";
import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import { athleteName, display, type AthleteSeason, type RosterAthlete } from "@/lib/types";
import { getPlayerProfileLayout } from "@/lib/player-profile-layout";
import { formatHeight } from "@/lib/measurement-display";
import type { getPlayerPerformance, PlayerMetricCard, PlayerMetricReading } from "@/lib/player-performance";

export type PlayerPerformanceProfileProps = {
  athlete: RosterAthlete; performance: ReturnType<typeof getPlayerPerformance>; season?: AthleteSeason | null;
  fictional?: boolean; action?: ReactNode; physicalityDetails?: ReactNode; history?: ReactNode;
};
function measurementDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}
function ReadingValue({ reading }: { reading: PlayerMetricReading }) {
  const height = reading.metricKey === "height" ? formatHeight(reading.value, reading.unit) : null;
  if (height) return <span className="font-bold tabular-nums" title={`Recorded: ${reading.value} ${reading.unit}`}>{height}</span>;
  const value = reading.derived ? `≈${reading.value.toFixed(1)}` : String(reading.value);
  return <><span className="break-all font-bold tabular-nums">{value}</span><span className="ml-1.5 text-sm font-medium text-[var(--text-secondary)]">{reading.unit}</span></>;
}
function Percentile({ card }: { card: PlayerMetricCard }) {
  const percentile = card.percentile;
  if (!card.latest || !percentile || !Number.isFinite(percentile.value) || percentile.value < 0 || percentile.value > 100 || percentile.sampleSize < 5) return null;
  const rounded = Math.round(percentile.value), neutral = card.metric.direction === "neutral";
  return <div className="mt-4" data-testid="player-percentile" data-metric-key={card.metric.key} data-percentile={percentile.value} data-sample-size={percentile.sampleSize} data-direction={card.metric.direction}>
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1 text-[11px] text-[var(--text-secondary)]"><span>Pacific n={percentile.sampleSize}</span><span><strong className="text-[var(--text-primary)]">{rounded}</strong> percentile</span></div>
    <div role="meter" aria-label={`${card.metric.label} Pacific percentile`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentile.value} aria-valuetext={`${rounded} percentile among ${percentile.sampleSize} comparable Pacific players${neutral ? "; measured value, not a rating" : ""}`} className="relative h-2.5 overflow-hidden rounded-full bg-[var(--surface-raised)]" data-testid="player-percentile-bar">
      <span className={`absolute inset-y-0 left-0 rounded-full ${neutral ? "bg-[#6d6e75]" : "bg-pacu-red"}`} style={{ width: `${percentile.value}%` }} aria-hidden="true" />
      <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--text-secondary)] opacity-40" aria-hidden="true" />
    </div>
  </div>;
}
function MetricCard({ card }: { card: PlayerMetricCard }) {
  const reading = card.latest;
  return <li className="min-w-0 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-4 sm:p-5" data-testid="player-metric" data-metric-key={card.metric.key} data-value={reading?.value} data-unit={reading?.unit} data-date={reading?.measuredAt}>
    <h3 className="m-0 text-sm font-semibold text-[var(--text-secondary)]">{card.metric.key === "bat_speed" ? "Bat Speed (Unspecified)" : card.metric.label}</h3>
    <div className="mt-3 text-3xl leading-tight text-[var(--text-primary)]">{reading ? <ReadingValue reading={reading} /> : <span className="text-2xl font-medium text-[var(--text-secondary)]" aria-label="Not yet tested">—</span>}</div>
    {!reading && <p className="mb-0 mt-2 text-[11px] text-[var(--text-secondary)]">Not Yet Tested</p>}
    {reading && <p className="mb-0 mt-2 text-[11px] text-[var(--text-secondary)]">Last Tested: <time dateTime={reading.measuredAt}>{measurementDate(reading.measuredAt)}</time>{reading.derived ? " · Calculated" : ""}</p>}
    <Percentile card={card} />
  </li>;
}
function MetricGroup({ id, title, cards }: { id: string; title: string; cards: PlayerMetricCard[] }) {
  return <section id={id} aria-labelledby={`${id}-heading`} className="min-w-0"><h2 id={`${id}-heading`} className="mb-4 text-lg font-bold">{title}</h2><ul className={`m-0 grid list-none grid-cols-1 gap-3 p-0 min-[360px]:grid-cols-2 ${cards.length === 2 ? "xl:grid-cols-2" : cards.length === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>{cards.map(card => <MetricCard key={card.metric.key} card={card} />)}</ul></section>;
}
export function PlayerPerformanceProfile({ athlete, performance, season, fictional = false, action, physicalityDetails, history }: PlayerPerformanceProfileProps) {
  const selectedSeason = season ?? [...athlete.athlete_seasons].sort((a, b) => b.season.localeCompare(a.season))[0];
  const position = [selectedSeason?.primary_position, selectedSeason?.secondary_position].filter((value, index, values) => value && values.indexOf(value) === index).join(" / ");
  const layout = getPlayerProfileLayout(performance, selectedSeason);
  const cards = [...layout.physicality, ...layout.additionalBody, ...layout.speedAgility, ...(layout.showHitting ? [...layout.hitting, ...layout.otherHitting] : []), ...layout.fieldThrowing, ...layout.pitching];
  const sourcedCards = cards.filter(card => card.latest);
  const lastTested = sourcedCards.map(card => card.latest!.measuredAt).sort().at(-1);
  const tabs: ProfileTab[] = [
    { id: "overview", label: "Overview", content: <PlayerOverview cards={cards} /> },
    { id: "physicality", label: "Physicality", content: <>
      <MetricGroup id="body-measurements" title="Physicality" cards={layout.physicality} />
      {!!layout.additionalBody.length && <MetricGroup id="body-composition" title="Body Composition" cards={layout.additionalBody} />}
      {physicalityDetails}
      {!!layout.speedAgility.length && <MetricGroup id="speed-agility" title="Speed & Agility" cards={layout.speedAgility} />}
    </> },
    ...(layout.showHitting ? [{ id: "hitting", label: "Hitting", content: <><MetricGroup id="hitting-performance" title="Hitting" cards={layout.hitting} />{!!layout.otherHitting.length && <MetricGroup id="other-hitting" title="Other Hitting Measurements" cards={layout.otherHitting} />}</> }] : []),
    { id: "throwing", label: "Throwing", content: <>
      {!!layout.fieldThrowing.length && <MetricGroup id="field-throwing" title="Position Throwing" cards={layout.fieldThrowing} />}
      {!!layout.pitching.length && <MetricGroup id="pitching-performance" title="Pitching" cards={layout.pitching} />}
      {!layout.hasThrowingRole && <section className="panel p-5"><h2 className="text-lg font-bold">Throwing</h2><p className="muted mb-0 text-sm">Position-specific throwing tests have not been assigned.</p></section>}
    </> },
  ];
  return <div className="min-w-0 space-y-6" data-testid="player-performance-profile">
    <section className="relative overflow-hidden rounded-lg border-t-4 border-pacu-red bg-[#1c1d20] px-5 py-6 text-white sm:px-8 sm:py-8" aria-label="Player profile">
      <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><PacificLogo className="w-10 shrink-0" decorative /><p className="m-0 text-[10px] font-bold uppercase tracking-[.2em] text-[#e0e0e3]">Pacific Baseball<span className="mx-2 text-[#a4a4aa]" aria-hidden="true">/</span>Performance</p></div><span className="shrink-0 rounded border border-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">{fictional ? "Fictional profile" : "Player profile"}</span></div>
      <div className="mt-7 flex items-center justify-between gap-4 sm:gap-8">
        <div className="min-w-0"><h1 className="m-0 break-words text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl">{athleteName(athlete)}</h1><p className="mb-0 mt-3 text-sm font-semibold text-[#ededf0]">{position || "Position to be added"}</p>
          <dl className="mb-0 mt-5 flex flex-wrap gap-x-6 gap-y-3 text-xs"><div><dt className="text-[10px] uppercase tracking-wider text-[#a7a8af]">Bats / Throws</dt><dd className="m-0 mt-1 font-semibold">{display(selectedSeason?.bats)} / {display(selectedSeason?.throws)}</dd></div><div><dt className="text-[10px] uppercase tracking-wider text-[#a7a8af]">Season</dt><dd className="m-0 mt-1 font-semibold">{selectedSeason?.season ?? "To be added"}</dd></div><div><dt className="text-[10px] uppercase tracking-wider text-[#a7a8af]">Athlete ID</dt><dd className="m-0 mt-1 font-mono font-semibold">{athlete.athlete_code}</dd></div><div><dt className="text-[10px] uppercase tracking-wider text-[#a7a8af]">Last Tested</dt><dd className="m-0 mt-1 font-semibold">{lastTested ? <time dateTime={lastTested}>{measurementDate(lastTested)}</time> : "Not Yet Tested"}</dd></div></dl>
        </div>
        <dl className="m-0 shrink-0 border-l border-white/15 pl-4 text-center sm:pl-8"><dt className="text-[9px] font-semibold uppercase tracking-[.1em] text-[#b3b4ba]">Jersey Number</dt><dd className="m-0 mt-2 text-5xl font-black leading-none tracking-tighter sm:text-7xl">{display(selectedSeason?.jersey_number)}</dd></dl>
      </div>
    </section>

    <ProfileTabs key={athlete.athlete_code} tabs={tabs} action={action} />
    {history}
    <details className="group rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)]" data-testid="player-performance-methods"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold sm:px-6">Sources &amp; Percentiles<ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
      <div className="space-y-5 border-t border-[#eeeef0] px-5 py-5 text-xs leading-6 text-[#65666d] sm:px-6"><p className="m-0">Pacific percentiles compare the latest comparable reading per player within the same metric, unit, source and testing period. Tied values share a percentile. They describe this team cohort, with no MLB, NCAA or outside-athlete comparison. The mark at 50 is the cohort midpoint.</p>
        <div className="grid gap-3 sm:grid-cols-2"><p className="m-0"><ArrowUp size={13} className="mr-1 inline" aria-hidden="true" />For metrics where higher is better, a larger measured value produces a higher percentile. <ArrowDown size={13} className="mx-1 inline" aria-hidden="true" />For lower-is-better metrics, including timed tests and BB %, a lower measured value produces a higher percentile.</p><p className="m-0">Body composition and spin use neutral bars. Higher percentiles indicate higher measured values in those groups, without a good/bad score. Missing values and cohorts under 5 are not charted.</p></div>
        <p className="m-0">Baseball performance window: September 1–December 31, 2026. Body comparisons use separate June 1–August 31 and September 1–December 31 testing periods. Each reading carries its recorded test date. Height displays in feet and inches, rounded to one tenth of an inch. Original values and units remain below; different units are never mixed in a percentile. Calculated values marked ≈ are rounded to one decimal in the snapshot; the full result and formula appear below.</p>
        {sourcedCards.length > 0 ? <div className="overflow-x-auto"><table><caption className="sr-only">Sources for the performance snapshot</caption><thead><tr><th>Measurement</th><th>Test date</th><th>Value</th><th>Source / method</th></tr></thead><tbody>{sourcedCards.map(card => {
          const reading = card.latest!;
          return <tr key={card.metric.key}><td className="font-semibold">{card.metric.label}</td><td className="whitespace-nowrap">{reading.measuredAt}</td><td className="whitespace-nowrap">{String(reading.value)} {reading.unit}</td><td className="min-w-52 max-w-sm break-words">{reading.derived && reading.derivation && <p className="mb-1 mt-0">{reading.derivation}</p>}<span>{reading.source}</span>{reading.provenance.map(source => <span className="mt-1 block" key={source.id}>{source.source_file} · {source.source_sheet || "File"} · Row {source.source_row}</span>)}</td></tr>;
        })}</tbody></table></div> : <p className="m-0">Source details appear with the first reviewed measurements.</p>}
      </div>
    </details>
  </div>;
}
