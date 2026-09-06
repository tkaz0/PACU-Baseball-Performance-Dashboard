"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity, ArrowLeft, ArrowRight, ClipboardList, Database, Upload, UsersRound } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { RosterTable } from "@/components/roster-table";
import { RenphoCharts } from "@/components/renpho-charts";
import { resolveAthleteCode } from "@/lib/athlete-codes";
import { useLocalWorkspace } from "@/components/local-workspace";
import { PlayerPerformanceProfile } from "@/components/player-performance-profile";
import { profileMeasurementVisible } from "@/lib/player-profile-layout";
import { getRenphoReports } from "@/lib/renpho-charts";
import { athleteName, display } from "@/lib/types";

function BaseballDiamond() {
  return <svg className="baseball-field" viewBox="0 0 360 300" fill="none" aria-hidden="true">
    <path d="M180 260 35 115Q180-30 325 115Z" stroke="currentColor" strokeWidth="1.5" />
    <path d="m180 260-90-90 90-90 90 90Z" stroke="currentColor" strokeWidth="1.5" />
    <path d="M180 260 5 85M180 260 355 85M142 222q38-38 76 0" stroke="currentColor" />
    <circle cx="180" cy="170" r="15" stroke="currentColor" />
    <path d="m180 76 7 7-7 7-7-7Zm-90 87 7 7-7 7-7-7Zm180 0 7 7-7 7-7-7Z" fill="currentColor" />
    <path d="M175 254h10v7l-5 5-5-5Z" fill="currentColor" />
    <path d="M67 143q113-114 226 0" stroke="currentColor" strokeDasharray="3 6" />
  </svg>;
}

export function LocalOverview() {
  const { roster, measurements, batches, ready, mode, view, canManage } = useLocalWorkspace();
  if (view.role === "player") return view.athleteCode ? <LocalAthleteProfile key={view.athleteCode} id={view.athleteCode} /> : <div className="panel empty-state"><UsersRound size={30} aria-hidden="true" /><h1 className="page-title">No player selected</h1><p>Choose a player from the View as menu to preview their profile.</p></div>;
  const athletes = [...roster].sort((a, b) => a.last_name.localeCompare(b.last_name));
  const latestSeason = [...new Set(roster.flatMap(a => a.athlete_seasons.map(s => s.season)))].sort().reverse()[0];
  const summaries = [
    { label: mode === "sample" ? "Fictional athletes" : "Roster athletes", value: String(athletes.length), detail: mode === "sample" ? "Starter profiles to explore" : "Permanent profiles across seasons", icon: UsersRound },
    { label: "Performance measurements", value: measurements.length ? measurements.length.toLocaleString() : "No data yet", detail: "Individual readings linked to athletes", icon: Activity },
    ...(canManage ? [{ label: "Import history", value: String(batches.length), detail: "Reviewed batches saved in this browser", icon: ClipboardList }] : []),
  ];
  return <>
    <section className="team-hero">
      <div className="hero-copy">
        <p className="eyebrow">Pacific Baseball <span aria-hidden="true">/</span> Performance</p>
        <h1>{view.role === "coach" ? "Coach overview" : "Team overview"}</h1>
        <p className="hero-description">{mode === "sample" ? "Explore the roster. Open a profile. Build your performance workspace." : "Your roster and performance records. Every athlete, in one place."}</p>
        <div className="hero-actions"><Link href="/preview/roster" className="btn btn-white">View roster <ArrowRight size={16} /></Link>{canManage && <Link href="/preview/import" className="hero-link"><Upload size={16} />Import data</Link>}</div>
      </div>
      <div className="hero-field"><BaseballDiamond /><span className="hero-season">{latestSeason ? `Season ${latestSeason}` : "Pacific Baseball"}</span></div>
    </section>

    <section className="workspace-scoreboard" aria-label="Workspace summary">
      {summaries.map(({ label, value, detail, icon: Icon }, index) => <div className="score-card" key={label}>
        <div className="score-card-heading"><span className="score-index">0{index + 1}</span><Icon size={19} aria-hidden="true" /></div>
        <p className="score-label">{label}</p><p className={`score-value ${value === "No data yet" ? "score-value-empty" : ""}`}>{ready ? value : "…"}</p><p className="score-detail">{detail}</p>
      </div>)}
    </section>

    <section className="roster-section">
      <div className="section-heading"><div><p className="eyebrow">The roster</p><h2>Roster at a glance</h2></div><Link href="/preview/roster" className="text-link">View roster <ArrowRight size={16} /></Link></div>
      <RosterTable athletes={athletes.slice(0, 5)} profileBasePath="/preview/athletes" />
    </section>

    {canManage ? <section className="overview-support">
      <div className="panel workspace-playbook">
        <div className="section-heading"><div><p className="eyebrow text-pacu-red">{mode === "sample" ? "Get started" : "Your activity"}</p><h2>{mode === "sample" ? "From file to profile." : "Recent imports"}</h2></div><ClipboardList size={22} className="text-pacu-red" aria-hidden="true" /></div>
        {mode === "sample" ? <ol className="playbook-steps"><li><span>01</span><div><strong>Start with your roster</strong><p>Bring in a CSV or Excel sheet.</p></div></li><li><span>02</span><div><strong>Connect the measurements</strong><p>Choose athlete matches, metrics, and units.</p></div></li><li><span>03</span><div><strong>Review, then save</strong><p>See the readings on each athlete’s profile.</p></div></li></ol> : batches.length ? <ul className="recent-imports">{[...batches].reverse().slice(0, 3).map(batch => <li key={batch.id}><span className="batch-dot" aria-hidden="true" /><div><strong>{batch.fileName}</strong><p>{batch.source} · {batch.importedAt.slice(0, 10)}</p></div><span className="badge">{batch.kind === "roster" ? "Roster" : "Measurements"}</span></li>)}</ul> : <p className="muted text-sm">No imports saved yet. Bring in your next roster or measurement file.</p>}
        <Link href="/preview/import" className="text-link">Open Import Center <ArrowRight size={15} /></Link>
      </div>
      <div className="workspace-backup"><Database size={26} aria-hidden="true" /><p className="eyebrow">Keep your work</p><h2>Your browser.<br />Your workspace.</h2><p>Imports are saved on this device. Export a backup before switching browsers or clearing site data.</p><Link href="/preview/import" className="text-link">Manage your backup <ArrowRight size={15} /></Link><div className="backup-format">CSV <span>·</span> TSV <span>·</span> XLSX</div></div>
    </section> : <section className="panel access-next"><p className="eyebrow text-pacu-red">Coach workspace</p><h2>Start with an athlete.</h2><p>Open a profile to review available performance measurements and RENPHO charts. New reports appear after an administrator reviews and imports them.</p><Link className="text-link" href="/preview/roster">Explore the roster <ArrowRight size={15} /></Link></section>}
  </>;
}

export function LocalRoster({ initialQuery = "", initialSeason = "" }: { initialQuery?: string; initialSeason?: string }) {
  const { roster, ready, mode, canManage } = useLocalWorkspace();
  const [query, setQuery] = useState(initialQuery);
  const [appliedQuery, setAppliedQuery] = useState(initialQuery);
  const [requestedSeason, setSeason] = useState(initialSeason);
  const seasons = [...new Set(roster.flatMap(a => a.athlete_seasons.map(s => s.season)))].sort().reverse();
  const season = seasons.includes(requestedSeason) ? requestedSeason : seasons[0] ?? "";
  const athletes = [...roster].filter(a => (!season || a.athlete_seasons.some(s => s.season === season)) && `${a.first_name} ${a.preferred_name ?? ""} ${a.last_name} ${a.athlete_code}`.toLowerCase().includes(appliedQuery.trim().toLowerCase())).sort((a, b) => a.last_name.localeCompare(b.last_name));
  return <>
    <PageHeading section="Pacific Baseball / Athlete directory" title="Master roster" description={mode === "sample" ? "Ten fictional profiles to explore while your team finishes the roster." : "Your team, season by season. Open a profile for roster details and performance records."}>{canManage && <Link className="btn btn-primary" href="/preview/import"><Upload size={16} />Import roster</Link>}</PageHeading>
    <form className="panel roster-filters" onSubmit={event => { event.preventDefault(); setAppliedQuery(query); const search = new URLSearchParams({ q: query, season }); window.history.replaceState(null, "", `/preview/roster?${search}`); }}>
      <label className="roster-search">Search athletes<input name="q" placeholder="Name or athlete code" value={query} onChange={event => setQuery(event.target.value)} maxLength={100} /></label>
      <label className="roster-season">Season<select name="season" value={season} onChange={event => setSeason(event.target.value)}>{seasons.map(s => <option key={s}>{s}</option>)}</select></label>
      <button className="btn btn-secondary" disabled={!ready}>Apply filters</button><span className="roster-count"><strong>{athletes.length}</strong> {athletes.length === 1 ? "athlete" : "athletes"}</span>
    </form>
    {athletes.length ? <RosterTable athletes={athletes} season={season} profileBasePath="/preview/athletes" /> : <div className="panel empty-state"><UsersRound size={30} aria-hidden="true" /><h2>No athletes to show</h2><p>Try another search or import your roster.</p></div>}
  </>;
}

export function LocalAthleteProfile({ id }: { id: string }) {
  const { roster, measurements, batches, ready, mode, canManage, canImport, view, getPerformance } = useLocalWorkspace();
  const [metric, setMetric] = useState("");
  const [source, setSource] = useState("");
  const [limit, setLimit] = useState(100);
  const code = resolveAthleteCode(roster, id);
  const athlete = roster.find(a => a.athlete_code === code);
  if (!ready) return <p role="status">Opening athlete profile…</p>;
  if (!athlete) return <div className="panel empty-state"><UsersRound size={30} aria-hidden="true" /><h1 className="page-title">Profile unavailable</h1><p>{canManage ? "This athlete is not in this browser’s roster. Import the roster or restore your workspace backup." : "This profile is unavailable in the current view. Exit preview to choose another athlete."}</p>{view.role !== "player" && <Link href="/preview/roster" className="btn btn-primary">Back to roster</Link>}</div>;
  const seasons = [...athlete.athlete_seasons].sort((a, b) => b.season.localeCompare(a.season));
  const selectedSeason = seasons.find(s => s.season === "2026-27") ?? seasons[0];
  const readings = measurements.filter(m => m.athlete_code === athlete.athlete_code && profileMeasurementVisible(m, selectedSeason)).sort((a, b) => b.measured_at.localeCompare(a.measured_at) || b.source_row - a.source_row);
  const metricKey = (m: { metric: string; unit: string }) => JSON.stringify([m.metric, m.unit]);
  const metrics = [...new Map(readings.map(m => [metricKey(m), `${m.metric} (${m.unit})`])).entries()];
  const sources = [...new Set(readings.map(m => m.source))].sort();
  const filtered = readings.filter(m => (!metric || metricKey(m) === metric) && (!source || m.source === source));
  const hasRenphoReports = getRenphoReports(readings, batches, athlete.athlete_code).length > 0;
  const physicalityDetails = hasRenphoReports && <details className="panel mt-6">
      <summary className="cursor-pointer px-5 py-5 text-sm font-bold sm:px-6">Full RENPHO charts &amp; report history</summary>
      <div className="border-t border-[#eeeef0] px-5 pb-5 sm:px-6"><RenphoCharts key={athlete.athlete_code} readings={readings} batches={batches} athleteCode={athlete.athlete_code} /></div>
    </details>;
  const history = readings.length > 0 && <details id="performance-history" className="panel mt-6">
      <summary className="cursor-pointer px-5 py-5 text-sm font-bold sm:px-6">Measurement history <span className="ml-2 text-xs font-normal text-gray-500">{readings.length.toLocaleString()} readings</span></summary>
      <div className="border-t border-[#eeeef0] p-5 sm:p-6">
        <div className="measurement-filters"><label>Measurement filter<select value={metric} onChange={e => { setMetric(e.target.value); setLimit(100); }}><option value="">All measurements</option>{metrics.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>Source filter<select value={source} onChange={e => { setSource(e.target.value); setLimit(100); }}><option value="">All sources</option>{sources.map(s => <option key={s}>{s}</option>)}</select></label></div>
        <p className="text-xs text-gray-500">{filtered.length} readings · Values and units exactly as reviewed at import</p>
        <div className="table-wrap"><table><caption className="sr-only">Imported performance readings for {athleteName(athlete)}</caption><thead><tr><th>Date</th><th>Measurement</th><th>Value</th><th>Unit</th><th>Source</th><th>File / row</th></tr></thead><tbody>{filtered.slice(0, limit).map(m => <tr key={m.id}><td className="whitespace-nowrap">{m.measured_at}</td><td>{m.metric}</td><td className="font-semibold">{String(m.value)}</td><td>{m.unit}</td><td>{m.source}</td><td className="max-w-xs break-words text-xs text-gray-500">{m.source_file}{m.source_sheet && m.source_sheet !== "CSV" ? ` · ${m.source_sheet}` : ""} · Row {m.source_row}</td></tr>)}</tbody></table></div>
        {filtered.length > limit && <button className="btn btn-secondary mt-4" onClick={() => setLimit(limit + 100)}>Show 100 more readings</button>}
      </div>
    </details>;
  return <>
    {view.role !== "player" && <Link href="/preview/roster" className="profile-back"><ArrowLeft size={15} />Master roster</Link>}
    <PlayerPerformanceProfile athlete={athlete} performance={getPerformance(athlete.athlete_code)} season={selectedSeason} fictional={mode === "sample"}
      action={canImport ? <Link href="/preview/import" className="text-link">Import Information <ArrowRight size={15} /></Link> : undefined}
      physicalityDetails={physicalityDetails} history={history} />

    {canManage && <details className="panel mt-6">
      <summary className="cursor-pointer px-5 py-5 text-sm font-bold sm:px-6">Account and roster details <span className="ml-2 text-xs font-normal text-gray-500">Admin</span></summary>
      <section id="season-details" className="border-t border-[#eeeef0] p-5 sm:p-6" aria-label="Roster and season details">
        <dl className="field-grid mb-6"><div><dt>Roster name</dt><dd>{athlete.first_name} {athlete.last_name}</dd></div><div><dt>Athlete ID</dt><dd>{athlete.athlete_code}</dd></div><div><dt>{mode === "sample" ? "Sample email" : "Roster email"}</dt><dd>{display(athlete.pacific_email)}</dd></div><div><dt>Preferred name</dt><dd>{display(athlete.preferred_name)}</dd></div><div><dt>Roster RENPHO ID</dt><dd>{athlete.renpho_id || "Not added yet"}</dd></div>{!!athlete.renpho_ids?.length && <div><dt>Remembered report IDs</dt><dd><details><summary className="cursor-pointer">{athlete.renpho_ids.length} linked</summary><ul className="mt-2 space-y-1 text-sm">{athlete.renpho_ids.map(reportId => <li key={reportId}>{reportId}</li>)}</ul></details></dd></div>}</dl>
        {seasons.map(s => {
          const fields: [string, string | number | null][] = [["Season jersey", s.jersey_number], ["Primary position", s.primary_position], ["Secondary position", s.secondary_position], ["Player type", s.player_type], ["Bats / throws", `${display(s.bats)} / ${display(s.throws)}`], ["Academic class", s.academic_class], ["Eligibility year", s.eligibility_year], ["Graduation year", s.graduation_year]];
          return <section className="panel season-card" key={s.season}><div className="season-heading"><div><span className="season-marker" aria-hidden="true" /><h2>Season {s.season}</h2></div><span className={`badge capitalize ${s.roster_status === "active" ? "badge-green" : ""}`}>{display(s.roster_status)}</span></div><dl className="field-grid season-fields">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="capitalize">{display(value)}</dd></div>)}</dl></section>;
        })}
      </section>
    </details>}
  </>;
}
