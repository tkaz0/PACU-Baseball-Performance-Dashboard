import { formatInnings } from "@/lib/pitching-stats";
import { GameRateBar } from "@/components/game-rate-bar";
import Link from "next/link";
import { StatInfo } from "@/components/stat-info";
import { LimitedSample } from "@/components/limited-sample";
import type { SharedGameStat } from "@/lib/game-server";
import { formatTeamGameMetric, teamGameSummary, type TeamGameMetric } from "@/lib/team-game-stats";

const updated = (date: string) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
function Metric({ metric }: { metric: TeamGameMetric }) {
  return <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-4">
    <dt className="text-xs font-semibold text-[var(--text-secondary)]">{metric.label}<StatInfo metric={metric.metric} label={metric.label}/></dt>
    <dd className="mt-2 text-2xl font-bold tabular-nums">{formatTeamGameMetric(metric)}</dd>
    <GameRateBar value={metric.value} unit={metric.unit} label={metric.label}/>
    {metric.metric==="pitching_era"&&metric.value===null?<p className="muted mb-0 mt-2 text-xs">Earned runs and innings needed</p>:metric.pending ? <p className="muted mb-0 mt-2 text-xs">Counts need review</p> : metric.opportunities !== undefined ? <div className="muted mt-2 text-xs">{metric.opportunityLabel==="outs"?`${formatInnings(metric.opportunities)} IP`:`${metric.opportunities.toLocaleString("en-US")} ${metric.opportunityLabel}`}{metric.opportunityLabel!=="outs"&&<LimitedSample count={metric.opportunities} pitching={metric.opportunityLabel === "pitches"} opportunityLabel={metric.opportunityLabel}/>}</div> : null}
  </div>;
}
export function TeamGameStats({ stats, names }: { stats: SharedGameStat[]; names: Map<string, string> }) {
  const batting = teamGameSummary(stats, "qpa_fall_2026"), pitching = teamGameSummary(stats, "pitching_fall_2026");
  const playerIds = [...new Set(stats.map(r => r.athlete_id))].sort((a, b) => (names.get(a) ?? "").localeCompare(names.get(b) ?? ""));
  const pending = [...batting.counts, ...batting.rates, ...pitching.counts, ...pitching.rates].some(m => m.pending&&m.metric!=="pitching_era");
  return <div className="space-y-6">
    <section className="panel p-5 sm:p-6" aria-label="Team batting statistics">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-2"><div><h2 className="m-0 text-xl font-bold">Team Batting</h2><p className="muted mb-0 mt-1 text-xs">QPA · Fall 2026{batting.players > 0 && ` · ${batting.players} ${batting.players === 1 ? "player" : "players"} with recorded results`}</p></div>{batting.updatedAt && <p className="muted m-0 text-xs">Updated {updated(batting.updatedAt)}</p>}</div>
      {!batting.entries ? <p className="muted text-sm">Team batting totals will appear after the first verified QPA update.</p> : <>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">{batting.rates.slice(0, 6).map(m => <Metric key={m.metric} metric={m}/>)}</dl>
        <dl className="team-game-counts">{batting.counts.filter(m=>["pa","pumps","rbi","sb"].includes(m.metric)).map(m=><div key={m.metric}><dt>{m.label}<StatInfo metric={m.metric} label={m.label}/></dt><dd>{formatTeamGameMetric(m)}</dd></div>)}</dl>
        <details className="team-game-more"><summary>More Team Totals &amp; Rates</summary><dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{[...batting.counts.filter(m=>!["pa","pumps","rbi","sb"].includes(m.metric)), batting.rates[6], batting.rates[7]].map(m => <Metric key={m.metric} metric={m}/>)}</dl></details>
      </>}
    </section>
    <section className="panel p-5 sm:p-6" aria-label="Team pitching statistics">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-2"><div><h2 className="m-0 text-xl font-bold">Team Pitching</h2><p className="muted mb-0 mt-1 text-xs">Pitching · Fall 2026{pitching.entries > 0 && ` · ${pitching.players} ${pitching.players === 1 ? "pitcher" : "pitchers"} · ${pitching.games} recorded ${pitching.games === 1 ? "period" : "periods"}`}</p></div>{pitching.updatedAt && <p className="muted m-0 text-xs">Updated {updated(pitching.updatedAt)}</p>}</div>
      {!pitching.entries ? <p className="muted mb-0 text-sm">No recorded pitching results yet. Team totals will appear after a verified Pitching sheet update.</p> : <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[...pitching.rates, ...pitching.counts].map(m => <Metric key={m.metric} metric={m}/>)}</dl>}
    </section>
    {pending && <p className="notice text-sm">Some totals or rates need source counts reviewed. Other recorded stats remain available. <Link prefetch={false} href="/game-stats/review" className="text-link">Open Data Review</Link></p>}
    {playerIds.length > 0 && <details className="panel p-5 sm:p-6"><summary className="cursor-pointer font-semibold">Player Breakdown · {playerIds.length} Players</summary>
      <p className="muted mt-3 text-xs">Select a name to open the player’s full profile.</p>
      {batting.entries > 0 && <div className="table-wrap mt-4"><table aria-label="Player batting breakdown"><thead><tr><th>Player</th>{["PA", "AB", "AVG", "OBP", "QPA %", "HH %", "HR", "RBI", "SB", "SB/PA"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{playerIds.flatMap(id => {
        const summary = teamGameSummary(stats.filter(r => r.athlete_id === id), "qpa_fall_2026");
        if (!summary.entries) return [];
        const metrics = [...summary.counts, ...summary.rates];
        return [<tr key={id}><th scope="row"><Link prefetch={false} href={`/athletes/${id}`} className="text-link whitespace-nowrap">{names.get(id) ?? "Player"}</Link></th>{["pa", "ab", "batting_avg", "batting_obp", "qpa_pct", "batting_hh_pct", "pumps", "rbi", "sb", "batting_sb_per_pa"].map(key => { const m = metrics.find(m => m.metric === key)!; return <td key={key} className="tabular-nums" title={m.pending ? "Counts need review" : undefined}>{formatTeamGameMetric(m)}</td>; })}</tr>];
      })}</tbody></table></div>}
      {pitching.entries > 0 && <div className="table-wrap mt-4"><table aria-label="Player pitching breakdown"><thead><tr><th>Pitcher</th><th>Pitches</th><th>Strike %</th><th>K</th><th>BB</th></tr></thead><tbody>{playerIds.flatMap(id => {
        const summary = teamGameSummary(stats.filter(r => r.athlete_id === id), "pitching_fall_2026"); if (!summary.entries) return [];
        return [<tr key={id}><th scope="row"><Link prefetch={false} href={`/athletes/${id}`} className="text-link whitespace-nowrap">{names.get(id) ?? "Player"}</Link></th>{[summary.counts[0], summary.rates[0], summary.counts[2], summary.counts[3]].map(m => <td key={m.metric} className="tabular-nums" title={m.pending ? "Counts need review" : undefined}>{formatTeamGameMetric(m)}</td>)}</tr>];
      })}</tbody></table></div>}
    </details>}
    <p className="muted text-xs leading-5">Totals include rostered players matched to the saved Fall sheets; unmatched sheet rows are excluded. Rates use combined counts and opportunities. A rate stays pending if any contributing player’s required counts are missing or inconsistent.</p>
  </div>;
}
