"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity, ArrowLeft, ArrowRight, ClipboardList, Database, Upload, UsersRound } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { RosterTable } from "@/components/roster-table";
import { useLocalWorkspace, type ImportBatch } from "@/components/local-workspace";
import type { Measurement } from "@/lib/imports/engine";
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

const RENPHO_HIGHLIGHTS = ["Weight", "Body Fat Percentage", "Skeletal Muscle Mass", "Fat-Free Mass", "Muscle Mass", "Body Water Mass"];

function latestRenphoReport(readings: Measurement[], batches: ImportBatch[]) {
  const importTimes = new Map<string, string>();
  for (const batch of batches) {
    if (batch.kind !== "measurements" || batch.source !== "RENPHO" || !batch.fileHash) continue;
    if (batch.importedAt > (importTimes.get(batch.fileHash) ?? "")) importTimes.set(batch.fileHash, batch.importedAt);
  }
  const reports = new Map<string, { readings: Measurement[]; importedAt: string }>();
  for (const reading of readings) {
    // Only reviewed report imports have this provenance. A source label on an
    // unrelated spreadsheet does not make it a body-composition report.
    if (reading.source !== "RENPHO" || !reading.source_sheet.startsWith("RENPHO report · Page ")) continue;
    const key = JSON.stringify([reading.source, reading.file_hash, reading.measured_at]);
    const report = reports.get(key) ?? { readings: [], importedAt: importTimes.get(reading.file_hash) ?? "" };
    report.readings.push(reading); reports.set(key, report);
  }
  const latest = [...reports.values()].sort((a, b) => b.readings[0].measured_at.localeCompare(a.readings[0].measured_at)
    || b.importedAt.localeCompare(a.importedAt) || a.readings[0].file_hash.localeCompare(b.readings[0].file_hash))[0];
  if (!latest) return null;
  // Every card is an individual saved reading. Units are neither combined nor
  // converted, and missing metrics are never filled from an older report.
  const highlights = latest.readings.filter(reading => RENPHO_HIGHLIGHTS.includes(reading.metric))
    .sort((a, b) => RENPHO_HIGHLIGHTS.indexOf(a.metric) - RENPHO_HIGHLIGHTS.indexOf(b.metric) || a.unit.localeCompare(b.unit) || a.id.localeCompare(b.id)).slice(0, 6);
  return { ...latest, highlights, reference: latest.readings[0] };
}

export function LocalOverview() {
  const { roster, measurements, batches, ready, mode } = useLocalWorkspace();
  const athletes = [...roster].sort((a, b) => a.last_name.localeCompare(b.last_name));
  const latestSeason = [...new Set(roster.flatMap(a => a.athlete_seasons.map(s => s.season)))].sort().reverse()[0];
  const summaries = [
    { label: mode === "sample" ? "Fictional athletes" : "Roster athletes", value: String(athletes.length), detail: mode === "sample" ? "Starter profiles to explore" : "Permanent profiles across seasons", icon: UsersRound },
    { label: "Performance measurements", value: measurements.length ? measurements.length.toLocaleString() : "No data yet", detail: "Individual readings linked to athletes", icon: Activity },
    { label: "Import history", value: String(batches.length), detail: "Reviewed batches saved in this browser", icon: ClipboardList },
  ];
  return <>
    <section className="team-hero">
      <div className="hero-copy">
        <p className="eyebrow">Pacific Baseball <span aria-hidden="true">/</span> Performance</p>
        <h1>Team overview</h1>
        <p className="hero-description">{mode === "sample" ? "Explore the roster. Open a profile. Build your performance workspace." : "Your roster and performance records. Every athlete, in one place."}</p>
        <div className="hero-actions"><Link href="/preview/roster" className="btn btn-white">View roster <ArrowRight size={16} /></Link><Link href="/preview/import" className="hero-link"><Upload size={16} />Import data</Link></div>
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

    <section className="overview-support">
      <div className="panel workspace-playbook">
        <div className="section-heading"><div><p className="eyebrow text-pacu-red">{mode === "sample" ? "Get started" : "Your activity"}</p><h2>{mode === "sample" ? "From file to profile." : "Recent imports"}</h2></div><ClipboardList size={22} className="text-pacu-red" aria-hidden="true" /></div>
        {mode === "sample" ? <ol className="playbook-steps"><li><span>01</span><div><strong>Start with your roster</strong><p>Bring in a CSV or Excel sheet.</p></div></li><li><span>02</span><div><strong>Connect the measurements</strong><p>Choose athlete matches, metrics, and units.</p></div></li><li><span>03</span><div><strong>Review, then save</strong><p>See the readings on each athlete’s profile.</p></div></li></ol> : batches.length ? <ul className="recent-imports">{[...batches].reverse().slice(0, 3).map(batch => <li key={batch.id}><span className="batch-dot" aria-hidden="true" /><div><strong>{batch.fileName}</strong><p>{batch.source} · {batch.importedAt.slice(0, 10)}</p></div><span className="badge">{batch.kind === "roster" ? "Roster" : "Measurements"}</span></li>)}</ul> : <p className="muted text-sm">No imports saved yet. Bring in your next roster or measurement file.</p>}
        <Link href="/preview/import" className="text-link">Open Import Center <ArrowRight size={15} /></Link>
      </div>
      <div className="workspace-backup"><Database size={26} aria-hidden="true" /><p className="eyebrow">Keep your work</p><h2>Your browser.<br />Your workspace.</h2><p>Imports are saved on this device. Export a backup before switching browsers or clearing site data.</p><Link href="/preview/import" className="text-link">Manage your backup <ArrowRight size={15} /></Link><div className="backup-format">CSV <span>·</span> TSV <span>·</span> XLSX</div></div>
    </section>
  </>;
}

export function LocalRoster({ initialQuery = "", initialSeason = "" }: { initialQuery?: string; initialSeason?: string }) {
  const { roster, ready, mode } = useLocalWorkspace();
  const [query, setQuery] = useState(initialQuery);
  const [appliedQuery, setAppliedQuery] = useState(initialQuery);
  const [requestedSeason, setSeason] = useState(initialSeason);
  const seasons = [...new Set(roster.flatMap(a => a.athlete_seasons.map(s => s.season)))].sort().reverse();
  const season = seasons.includes(requestedSeason) ? requestedSeason : seasons[0] ?? "";
  const athletes = [...roster].filter(a => (!season || a.athlete_seasons.some(s => s.season === season)) && `${a.first_name} ${a.preferred_name ?? ""} ${a.last_name} ${a.athlete_code}`.toLowerCase().includes(appliedQuery.trim().toLowerCase())).sort((a, b) => a.last_name.localeCompare(b.last_name));
  return <>
    <PageHeading section="Pacific Baseball / Athlete directory" title="Master roster" description={mode === "sample" ? "Ten fictional profiles to explore while your team finishes the roster." : "Your team, season by season. Open a profile for roster details and performance records."}><Link className="btn btn-primary" href="/preview/import"><Upload size={16} />Import roster</Link></PageHeading>
    <form className="panel roster-filters" onSubmit={event => { event.preventDefault(); setAppliedQuery(query); const search = new URLSearchParams({ q: query, season }); window.history.replaceState(null, "", `/preview/roster?${search}`); }}>
      <label className="roster-search">Search athletes<input name="q" placeholder="Name or athlete code" value={query} onChange={event => setQuery(event.target.value)} maxLength={100} /></label>
      <label className="roster-season">Season<select name="season" value={season} onChange={event => setSeason(event.target.value)}>{seasons.map(s => <option key={s}>{s}</option>)}</select></label>
      <button className="btn btn-secondary" disabled={!ready}>Apply filters</button><span className="roster-count"><strong>{athletes.length}</strong> {athletes.length === 1 ? "athlete" : "athletes"}</span>
    </form>
    {athletes.length ? <RosterTable athletes={athletes} season={season} profileBasePath="/preview/athletes" /> : <div className="panel empty-state"><UsersRound size={30} aria-hidden="true" /><h2>No athletes to show</h2><p>Try another search or import your roster.</p></div>}
  </>;
}

export function LocalAthleteProfile({ id }: { id: string }) {
  const { roster, measurements, batches, ready, mode } = useLocalWorkspace();
  const [metric, setMetric] = useState("");
  const [source, setSource] = useState("");
  const [limit, setLimit] = useState(100);
  const athlete = roster.find(a => a.athlete_code === id);
  if (!ready) return <p role="status">Opening athlete profile…</p>;
  if (!athlete) return <div className="panel empty-state"><UsersRound size={30} aria-hidden="true" /><h1 className="page-title">Profile unavailable</h1><p>This athlete is not in this browser’s roster. Import the roster or restore your workspace backup.</p><Link href="/preview/roster" className="btn btn-primary">Back to roster</Link></div>;
  const seasons = [...athlete.athlete_seasons].sort((a, b) => b.season.localeCompare(a.season));
  const latestSeason = seasons[0];
  const readings = measurements.filter(m => m.athlete_code === id).sort((a, b) => b.measured_at.localeCompare(a.measured_at) || b.source_row - a.source_row);
  const metricKey = (m: { metric: string; unit: string }) => JSON.stringify([m.metric, m.unit]);
  const metrics = [...new Map(readings.map(m => [metricKey(m), `${m.metric} (${m.unit})`])).entries()];
  const sources = [...new Set(readings.map(m => m.source))].sort();
  const filtered = readings.filter(m => (!metric || metricKey(m) === metric) && (!source || m.source === source));
  const latestReport = latestRenphoReport(readings, batches);
  return <>
    <Link href="/preview/roster" className="profile-back"><ArrowLeft size={15} />Master roster</Link>
    <section className="athlete-hero">
      <div className="athlete-identity"><p className="eyebrow">Pacific Baseball <span aria-hidden="true">/</span> {mode === "sample" ? "Fictional athlete profile" : "Athlete profile"}</p><h1>{athleteName(athlete)}</h1><div className="athlete-meta"><span className="athlete-code">{athlete.athlete_code}</span>{latestSeason?.primary_position && <span>{display(latestSeason.primary_position)}</span>}{latestSeason?.academic_class && <span className="capitalize">{display(latestSeason.academic_class)}</span>}</div></div>
      <div className="athlete-jersey" aria-label={`Latest jersey number: ${display(latestSeason?.jersey_number)}`}><span>{latestSeason ? `Season ${latestSeason.season}` : "Pacific Baseball"}</span><strong>{display(latestSeason?.jersey_number)}</strong><span>Jersey number</span></div>
      <BaseballDiamond />
    </section>
    <nav className="profile-section-nav" aria-label="Athlete profile sections"><a href="#performance">Performance <span>{readings.length} readings</span></a><a href="#season-details">Roster &amp; seasons <ArrowRight size={14} aria-hidden="true" /></a></nav>

    <section id="performance" className="panel measurement-panel">
      <div className="section-heading"><div><p className="eyebrow text-pacu-red">Athlete record</p><h2>Performance measurements</h2></div><Link href="/preview/import" className="text-link">Import measurements <ArrowRight size={15} /></Link></div>
      {latestReport && <section className="renpho-summary" aria-label="Latest RENPHO report">
        <div className="report-summary-heading"><div><p className="eyebrow">Latest RENPHO report</p><h3>Body composition</h3><p>Test date <time dateTime={latestReport.reference.measured_at}>{latestReport.reference.measured_at}</time> · {latestReport.readings.length} saved readings</p></div><span className="report-source-badge">RENPHO</span></div>
        <p className="report-summary-file">{latestReport.reference.source_file}</p>
        {latestReport.highlights.length > 0 && <div className="report-metric-grid">{latestReport.highlights.map(reading => <article className="report-metric-card" key={reading.id} aria-label={`${reading.metric} (${reading.unit})`}><h4>{reading.metric}</h4><p className="report-metric-value"><strong>{String(reading.value)}</strong><span>{reading.unit}</span></p><p className="report-metric-context">{reading.source} · <time dateTime={reading.measured_at}>{reading.measured_at}</time></p></article>)}</div>}
        <a className="text-link" href="#performance-history" onClick={() => { setMetric(""); setSource(""); setLimit(100); }}>See full measurement history <ArrowRight size={15} /></a>
      </section>}
      {!readings.length ? <div className="measurement-empty"><span className="empty-diamond"><Activity size={26} aria-hidden="true" /></span><div><p className="font-semibold">No data yet.</p><p className="muted text-sm">Import a performance file and match its readings to this athlete.</p></div><Link href="/preview/import" className="btn btn-secondary">Add measurements <ArrowRight size={15} /></Link></div> : <>
        <h3 id="performance-history" className="measurement-history-title">Measurement history</h3>
        <div className="reading-summary"><div><span>Readings</span><strong>{readings.length.toLocaleString()}</strong></div><div><span>Latest test date</span><strong>{readings[0].measured_at}</strong></div><div><span>Sources</span><strong>{sources.length}</strong></div></div>
        <div className="measurement-filters"><label>Measurement filter<select value={metric} onChange={e => { setMetric(e.target.value); setLimit(100); }}><option value="">All measurements</option>{metrics.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>Source filter<select value={source} onChange={e => { setSource(e.target.value); setLimit(100); }}><option value="">All sources</option>{sources.map(s => <option key={s}>{s}</option>)}</select></label></div><p className="text-xs text-gray-500">{filtered.length} readings · Values and units exactly as reviewed at import</p>
        <div className="table-wrap"><table><caption className="sr-only">Imported performance readings for {athleteName(athlete)}</caption><thead><tr><th>Date</th><th>Measurement</th><th>Value</th><th>Unit</th><th>Source</th><th>File / row</th></tr></thead><tbody>{filtered.slice(0, limit).map(m => <tr key={m.id}><td className="whitespace-nowrap">{m.measured_at}</td><td>{m.metric}</td><td className="font-semibold">{String(m.value)}</td><td>{m.unit}</td><td>{m.source}</td><td className="max-w-xs break-words text-xs text-gray-500">{m.source_file}{m.source_sheet && m.source_sheet !== "CSV" ? ` · ${m.source_sheet}` : ""} · Row {m.source_row}</td></tr>)}</tbody></table></div>{filtered.length > limit && <button className="btn btn-secondary mt-4" onClick={() => setLimit(limit + 100)}>Show 100 more readings</button>}
      </>}
    </section>
    <section id="season-details" aria-label="Roster and season details">
    <section className="panel athlete-details roster-detail-panel"><dl className="field-grid"><div><dt>Roster name</dt><dd>{athlete.first_name} {athlete.last_name}</dd></div><div><dt>{mode === "sample" ? "Sample email" : "Roster email"}</dt><dd>{display(athlete.pacific_email)}</dd></div><div><dt>Preferred name</dt><dd>{display(athlete.preferred_name)}</dd></div><div><dt>Roster RENPHO ID</dt><dd>{athlete.renpho_id || "Not added yet"}</dd></div>{!!athlete.renpho_ids?.length && <div><dt>Remembered report IDs</dt><dd><details><summary className="cursor-pointer">{athlete.renpho_ids.length} linked</summary><ul className="mt-2 space-y-1 text-sm">{athlete.renpho_ids.map(id => <li key={id}>{id}</li>)}</ul></details></dd></div>}</dl></section>

    {seasons.map(s => {
      const fields: [string, string | number | null][] = [["Jersey number", s.jersey_number], ["Primary position", s.primary_position], ["Secondary position", s.secondary_position], ["Player type", s.player_type], ["Bats / throws", `${display(s.bats)} / ${display(s.throws)}`], ["Academic class", s.academic_class], ["Eligibility year", s.eligibility_year], ["Graduation year", s.graduation_year]];
      return <section className="panel season-card" key={s.season}><div className="season-heading"><div><span className="season-marker" aria-hidden="true" /><h2>Season {s.season}</h2></div><span className={`badge capitalize ${s.roster_status === "active" ? "badge-green" : ""}`}>{display(s.roster_status)}</span></div><dl className="field-grid season-fields">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="capitalize">{display(value)}</dd></div>)}</dl></section>;
    })}

    </section>
  </>;
}
