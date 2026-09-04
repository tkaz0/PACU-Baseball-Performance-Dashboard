"use client";
import Link from "next/link";
import { useState } from "react";
import { Activity, ArrowLeft, ArrowRight, ClipboardList, Database, Upload, UsersRound } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { RosterTable } from "@/components/roster-table";
import { useLocalWorkspace } from "@/components/local-workspace";
import { athleteName, display } from "@/lib/types";

export function LocalOverview() {
  const { roster, measurements, batches, ready, mode } = useLocalWorkspace();
  const athletes = [...roster].sort((a, b) => a.last_name.localeCompare(b.last_name));
  const summaries = [
    { label: mode === "sample" ? "Fictional athletes" : "Roster athletes", value: String(athletes.length), detail: mode === "sample" ? "Starter roster · Replace with your roster import" : "Permanent profiles across seasons", icon: UsersRound },
    { label: "Performance measurements", value: measurements.length ? measurements.length.toLocaleString() : "No data yet", detail: "Individual readings linked to athletes", icon: Activity },
    { label: "Import history", value: String(batches.length), detail: "Reviewed batches saved in this browser", icon: ClipboardList },
  ];
  return <>
    <PageHeading section="PACU Baseball Performance" title="Team overview" description={mode === "sample" ? "Explore athlete profiles, then bring in your roster and performance files." : "Your roster and measurements, organized by athlete."}><Link href="/preview/import" className="btn btn-primary"><Upload size={16} />Import data</Link></PageHeading>
    <section className="mb-8 grid gap-5 md:grid-cols-3" aria-label="Workspace summary">{summaries.map(({ label, value, detail, icon: Icon }) => <div className="panel p-6" key={label}><div className="mb-5 flex items-center justify-between"><p className="mb-0 text-sm text-gray-500">{label}</p><Icon size={18} className="text-gray-400" /></div><p className="mb-2 text-2xl font-bold tracking-tight">{ready ? value : "…"}</p><p className="mb-0 text-xs text-gray-500">{detail}</p></div>)}</section>
    <div className="mb-4 flex items-center justify-between gap-4"><h2 className="mb-0 text-lg font-bold">Roster at a glance</h2><Link href="/preview/roster" className="flex items-center gap-2 text-sm font-semibold text-pacu-red">View roster <ArrowRight size={16} /></Link></div>
    <RosterTable athletes={athletes.slice(0, 5)} profileBasePath="/preview/athletes" />
    <section className="mt-7 grid gap-5 lg:grid-cols-2"><div className="panel border-l-4 border-l-pacu-red p-6"><p className="eyebrow mb-2 text-pacu-red">Get started</p><h2 className="mb-3 text-lg font-semibold">From a file to an athlete profile.</h2><ol className="list-inside list-decimal space-y-2 text-sm text-gray-600"><li>Import your roster CSV or Excel sheet.</li><li>Choose a performance file and map its columns.</li><li>Review matches and errors, then save the batch.</li></ol><Link href="/preview/import" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-pacu-red">Open Import Center <ArrowRight size={15} /></Link></div><div className="panel p-6"><Database className="mb-3 text-pacu-red" size={22} /><h2 className="mb-2 text-lg font-semibold">Your browser is your workspace.</h2><p className="muted text-sm">Imports are saved on this device in this browser. Export a backup from Import Center before clearing browser data or switching devices. Team sharing will use the private workspace when sign-in is ready.</p><p className="mb-0 text-xs text-gray-500">CSV · TSV · Excel XLSX · Explicit dates and units · Source row tracking</p></div></section>
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
  return <><PageHeading section={mode === "sample" ? "Fictional athlete directory" : "Athlete directory"} title="Master roster" description={mode === "sample" ? "Ten fictional profiles to explore while your team finishes the roster." : "Open a profile to see season details and imported measurements."}><Link className="btn btn-primary" href="/preview/import">Import roster</Link></PageHeading>
    <form className="panel mb-5 flex flex-wrap items-end gap-4 p-5" onSubmit={event => { event.preventDefault(); setAppliedQuery(query); const search = new URLSearchParams({ q: query, season }); window.history.replaceState(null, "", `/preview/roster?${search}`); }}><label className="min-w-[180px] flex-1">Search athletes<input name="q" placeholder="Name or athlete code" value={query} onChange={event => setQuery(event.target.value)} maxLength={100} /></label><label className="w-44">Season<select name="season" value={season} onChange={event => setSeason(event.target.value)}>{seasons.map(s => <option key={s}>{s}</option>)}</select></label><button className="btn btn-secondary" disabled={!ready}>Apply filters</button><span className="mb-3 text-sm text-gray-500">{athletes.length} {athletes.length === 1 ? "athlete" : "athletes"}</span></form>
    {athletes.length ? <RosterTable athletes={athletes} season={season} profileBasePath="/preview/athletes" /> : <div className="panel p-12 text-center"><h2 className="text-lg font-semibold">No athletes to show</h2><p className="muted mb-0 text-sm">Try another search or import your roster.</p></div>}
  </>;
}

export function LocalAthleteProfile({ id }: { id: string }) {
  const { roster, measurements, ready, mode } = useLocalWorkspace();
  const [metric, setMetric] = useState("");
  const [source, setSource] = useState("");
  const [limit, setLimit] = useState(100);
  const athlete = roster.find(a => a.athlete_code === id);
  if (!ready) return <p role="status">Opening athlete profile…</p>;
  if (!athlete) return <div className="panel p-8"><h1 className="text-2xl font-bold">Profile unavailable</h1><p className="muted">This athlete is not in this browser’s roster. Import the roster or restore your workspace backup.</p><Link href="/preview/roster" className="btn btn-primary">Back to roster</Link></div>;
  const seasons = [...athlete.athlete_seasons].sort((a, b) => b.season.localeCompare(a.season));
  const readings = measurements.filter(m => m.athlete_code === id).sort((a, b) => b.measured_at.localeCompare(a.measured_at) || b.source_row - a.source_row);
  const metricKey = (m: { metric: string; unit: string }) => JSON.stringify([m.metric, m.unit]);
  const metrics = [...new Map(readings.map(m => [metricKey(m), `${m.metric} (${m.unit})`])).entries()];
  const sources = [...new Set(readings.map(m => m.source))].sort();
  const filtered = readings.filter(m => (!metric || metricKey(m) === metric) && (!source || m.source === source));
  return <><Link href="/preview/roster" className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500"><ArrowLeft size={16} />Master roster</Link>
    <section className="panel mb-6 border-t-4 border-t-pacu-red p-7"><p className="eyebrow text-pacu-red">{mode === "sample" ? "Fictional athlete profile" : "Athlete profile"}</p><div className="flex flex-wrap items-center gap-5"><span className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold text-gray-600">{(athlete.preferred_name || athlete.first_name)[0]}{athlete.last_name[0]}</span><div><h1 className="mb-2 text-3xl font-bold tracking-tight">{athleteName(athlete)}</h1><p className="mb-0 font-mono text-sm text-gray-500">{athlete.athlete_code}</p></div></div><dl className="field-grid mt-8"><div><dt>Roster name</dt><dd>{athlete.first_name} {athlete.last_name}</dd></div><div><dt>{mode === "sample" ? "Sample email" : "Roster email"}</dt><dd>{display(athlete.pacific_email)}</dd></div><div><dt>Preferred name</dt><dd>{display(athlete.preferred_name)}</dd></div></dl></section>
    {seasons.map(s => { const fields: [string, string | number | null][] = [["Jersey number", s.jersey_number], ["Primary position", s.primary_position], ["Secondary position", s.secondary_position], ["Player type", s.player_type], ["Bats / throws", `${display(s.bats)} / ${display(s.throws)}`], ["Academic class", s.academic_class], ["Eligibility year", s.eligibility_year], ["Graduation year", s.graduation_year]]; return <section className="panel mb-6 p-7" key={s.season}><div className="mb-6 flex items-center justify-between gap-4"><h2 className="mb-0 text-lg font-bold">Season {s.season}</h2><span className={`badge capitalize ${s.roster_status === "active" ? "badge-green" : ""}`}>{display(s.roster_status)}</span></div><dl className="field-grid">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="capitalize">{display(value)}</dd></div>)}</dl></section>; })}
    <section className="panel p-5 sm:p-7"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Activity className="text-pacu-red" size={19} /><h2 className="mb-0 text-lg font-bold">Performance measurements</h2></div><Link href="/preview/import" className="text-sm font-semibold text-pacu-red">Import measurements</Link></div>
      {!readings.length ? <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 py-9 text-center"><p className="mb-2 font-semibold">No data yet.</p><p className="muted mb-0 text-sm">Import a performance file and match its readings to this athlete.</p></div> : <><div className="mb-5 grid gap-4 sm:grid-cols-3"><div className="rounded-md bg-gray-50 p-4"><p className="mb-1 text-xs text-gray-500">Readings</p><p className="mb-0 text-xl font-bold">{readings.length.toLocaleString()}</p></div><div className="rounded-md bg-gray-50 p-4"><p className="mb-1 text-xs text-gray-500">Latest test date</p><p className="mb-0 text-xl font-bold">{readings[0].measured_at}</p></div><div className="rounded-md bg-gray-50 p-4"><p className="mb-1 text-xs text-gray-500">Sources</p><p className="mb-0 text-xl font-bold">{sources.length}</p></div></div>
        <div className="mb-5 grid gap-4 sm:grid-cols-2"><label>Measurement filter<select value={metric} onChange={e => { setMetric(e.target.value); setLimit(100); }}><option value="">All measurements</option>{metrics.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>Source filter<select value={source} onChange={e => { setSource(e.target.value); setLimit(100); }}><option value="">All sources</option>{sources.map(s => <option key={s}>{s}</option>)}</select></label></div><p className="text-xs text-gray-500">{filtered.length} readings · Values and units exactly as reviewed at import</p>
        <div className="table-wrap"><table><caption className="sr-only">Imported performance readings for {athleteName(athlete)}</caption><thead><tr><th>Date</th><th>Measurement</th><th>Value</th><th>Unit</th><th>Source</th><th>File / row</th></tr></thead><tbody>{filtered.slice(0, limit).map(m => <tr key={m.id}><td className="whitespace-nowrap">{m.measured_at}</td><td>{m.metric}</td><td className="font-semibold">{String(m.value)}</td><td>{m.unit}</td><td>{m.source}</td><td className="max-w-xs break-words text-xs text-gray-500">{m.source_file}{m.source_sheet && m.source_sheet !== "CSV" ? ` · ${m.source_sheet}` : ""} · Row {m.source_row}</td></tr>)}</tbody></table></div>{filtered.length > limit && <button className="btn btn-secondary mt-4" onClick={() => setLimit(limit + 100)}>Show 100 more readings</button>}
      </>}
    </section>
  </>;
}
