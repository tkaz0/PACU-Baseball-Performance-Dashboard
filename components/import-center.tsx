"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Download, FileSpreadsheet, HardDrive, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { useLocalWorkspace } from "@/components/local-workspace";
import { readImportFile } from "@/lib/imports/files";
import {
  ROSTER_FIELDS, previewMeasurements, previewRoster, selectTable, suggestRosterMapping,
  type DateFormat, type ImportCounts, type Measurement, type MeasurementMapping,
  type MeasurementPreview, type RosterField, type RosterMapping, type RosterPreview,
} from "@/lib/imports/engine";
import { athleteName } from "@/lib/types";
import { RenphoImport } from "@/components/renpho-import";

type LoadedFile = Awaited<ReturnType<typeof readImportFile>>;
type ImportKind = "roster" | "measurements";
type MetricInput = { id: string; column: number; label: string; unit: string };
type PreviewContext = { revision: number; fileName: string; fileHash: string; sheetName: string; source: string; season?: string; generatedWithoutEmail?: number };
type ReviewedImport = PreviewContext & (
  { kind: "roster"; data: RosterPreview } |
  { kind: "measurements"; data: MeasurementPreview }
);

const SOURCES = ["RENPHO", "Blast", "Rapsodo", "Full Swing", "Player Metrics", "Other"];
const FIELD_LABELS: Record<RosterField, string> = {
  athlete_code: "Permanent athlete code", first_name: "First name", preferred_name: "Preferred name",
  last_name: "Last name", pacific_email: "Email", jersey_number: "Jersey number",
  primary_position: "Primary position", secondary_position: "Secondary position", player_type: "Player type",
  bats: "Bats", throws: "Throws", academic_class: "Academic class", eligibility_year: "Eligibility year",
  graduation_year: "Graduation year", roster_status: "Roster status", profile_photo_url: "Profile photo URL", renpho_id: "RENPHO ID",
};
const message = (error: unknown) => error instanceof Error ? error.message : "This action could not be completed. Please try again.";
const cellText = (value: string | number | null) => value === null || value === "" ? "—" : String(value);

function ColumnSelect({ label, headers, value, onChange, optional = false }: {
  label: string; headers: string[]; value: number; onChange: (value: number) => void; optional?: boolean;
}) {
  return (
    <label>{label}
      <select value={value} onChange={event => onChange(Number(event.target.value))}>
        <option value={-1}>{optional ? "Not mapped · leave blank" : "Choose a source column"}</option>
        {headers.map((header, index) => <option key={index} value={index}>{index + 1}. {header}</option>)}
      </select>
    </label>
  );
}

function PreviewCounts({ counts }: { counts: ImportCounts }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {(["create", "update", "unchanged", "reject"] as const).map(status => (
        <div className="rounded-lg border border-gray-200 p-4" key={status}>
          <p className="mb-1 text-xs capitalize text-gray-500">{status}</p>
          <p className={`mb-0 text-2xl font-bold ${status === "reject" && counts.reject ? "text-pacu-red" : ""}`}>{counts[status]}</p>
        </div>
      ))}
    </div>
  );
}

function RowPreview({ preview, limit, onShowMore }: {
  preview: ReviewedImport; limit: number; onShowMore: () => void;
}) {
  const measurementsByRow = new Map<number, Measurement[]>();
  if (preview.kind === "measurements") {
    for (const measurement of preview.data.candidateMeasurements) {
      const values = measurementsByRow.get(measurement.source_row) ?? [];
      values.push(measurement);
      measurementsByRow.set(measurement.source_row, values);
    }
  }
  return (
    <>
      <div className="table-wrap rounded-lg border border-gray-200">
        <table>
          <caption className="sr-only">Import row validation and proposed changes</caption>
          <thead><tr><th>Source row</th><th>Athlete code</th><th>Match</th><th>Result</th><th>Changes or issues</th></tr></thead>
          <tbody>{preview.data.rows.slice(0, limit).map(row => {
            const observations = measurementsByRow.get(row.row) ?? [];
            return (
              <tr key={row.row}>
                <td>{row.row}</td><td className="font-mono text-xs">{row.athlete_code || "—"}</td>
                <td><span className="capitalize">{row.matchMethod}</span>{row.requiresNameReview && <span className="mt-1 block text-xs text-pacu-red">Review name match</span>}</td>
                <td><span className={`badge capitalize ${row.status === "reject" ? "badge-red" : row.status === "create" ? "badge-green" : ""}`}>{row.status}</span></td>
                <td className="min-w-[280px]">
                  {row.issues.length ? <ul className="m-0 list-disc space-y-1 pl-4 text-pacu-red">{row.issues.map((issue, index) => <li key={index}>{issue.field}: {issue.message}</li>)}</ul> : row.changes.length ? (
                    <details><summary className="cursor-pointer font-semibold">{row.changes.length} field changes</summary><dl className="mt-3 space-y-2">{row.changes.map(change => <div key={change.field}><dt className="text-xs text-gray-500">{change.field}</dt><dd className="m-0 break-all">{cellText(change.before)} → {cellText(change.after)}</dd></div>)}</dl></details>
                  ) : observations.length ? (
                    <details><summary className="cursor-pointer font-semibold">{observations.length} measurements to add</summary><ul className="mt-3 list-disc space-y-2 pl-4">{observations.map(item => <li key={item.id}><span className="text-xs text-gray-500">{item.measured_at}</span><br />{item.metric}: <strong>{item.value} {item.unit}</strong></li>)}</ul></details>
                  ) : "No new values"}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      {preview.data.rows.length > limit && <button type="button" className="btn btn-secondary mt-4" onClick={onShowMore}>Show more rows ({Math.min(limit, preview.data.rows.length)} of {preview.data.rows.length})</button>}
    </>
  );
}

export function ImportCenter() {
  const workspace = useLocalWorkspace();
  const [kind, setKind] = useState<ImportKind>("roster");
  const [reportView, setReportView] = useState(false);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [rosterMapping, setRosterMapping] = useState<RosterMapping>({});
  const [season, setSeason] = useState("2026");
  const [source, setSource] = useState("");
  const [otherSource, setOtherSource] = useState("");
  const [identityKind, setIdentityKind] = useState<MeasurementMapping["identityKind"]>("code");
  const [identityColumn, setIdentityColumn] = useState(-1);
  const [identityOverrides, setIdentityOverrides] = useState<Record<string, string>>({});
  const [identitySearch, setIdentitySearch] = useState("");
  const [identityLimit, setIdentityLimit] = useState(50);
  const [dateMode, setDateMode] = useState<"column" | "fixed">("column");
  const [dateColumn, setDateColumn] = useState(-1);
  const [dateFormat, setDateFormat] = useState<DateFormat>("ISO");
  const [fixedDate, setFixedDate] = useState("");
  const [metrics, setMetrics] = useState<MetricInput[]>([{ id: "initial", column: -1, label: "", unit: "" }]);
  const [reviewed, setReviewed] = useState<ReviewedImport | null>(null);
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [applyConfirmed, setApplyConfirmed] = useState(false);
  const [rowLimit, setRowLimit] = useState(50);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [batchToRemove, setBatchToRemove] = useState<string | null>(null);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [exportSeason, setExportSeason] = useState("2026");
  const readSequence = useRef(0);

  const sheet = file?.sheets[sheetIndex];
  const selected = useMemo(() => {
    if (!sheet) return { table: null, error: null };
    try { return { table: selectTable(sheet.matrix, headerIndex), error: null }; }
    catch (error) { return { table: null, error: message(error) }; }
  }, [sheet, headerIndex]);
  const table = selected.table;
  const identities = useMemo(() => {
    if (!table || identityColumn < 0) return [];
    return [...new Set(table.rows.map(row => (row[identityColumn] ?? "").trim()).filter(Boolean))]
      .filter(value => value.toLowerCase().includes(identitySearch.toLowerCase())).sort();
  }, [table, identityColumn, identitySearch]);
  const stale = reviewed !== null && reviewed.revision !== workspace.revision;
  const exportSeasons = [...new Set(workspace.roster.flatMap(athlete => athlete.athlete_seasons.map(item => item.season)))].sort().reverse();
  const nameMatches = reviewed?.kind === "measurements" ? reviewed.data.nameMatches : 0;
  const canApply = Boolean(workspace.ready && reviewed?.data.canApply && !stale && !busy && applyConfirmed && (!nameMatches || nameConfirmed));

  function invalidate() {
    setReviewed(null); setNameConfirmed(false); setApplyConfirmed(false); setError(null); setSuccess(null);
  }

  function changeSelection(nextFile: LoadedFile, nextSheet: number, nextHeader: number) {
    invalidate(); setSheetIndex(nextSheet); setHeaderIndex(nextHeader);
    setIdentityColumn(-1); setIdentityOverrides({}); setIdentitySearch(""); setIdentityLimit(50); setDateColumn(-1);
    setMetrics([{ id: "initial", column: -1, label: "", unit: "" }]);
    try { setRosterMapping(suggestRosterMapping(selectTable(nextFile.sheets[nextSheet].matrix, nextHeader).headers)); }
    catch { setRosterMapping({}); }
  }

  async function chooseFile(nextFile: File | undefined) {
    if (!nextFile) return;
    const request = ++readSequence.current;
    invalidate(); setFile(null); setBusy("Reading spreadsheet…");
    try {
      const parsed = await readImportFile(nextFile);
      if (request !== readSequence.current) return;
      if (!parsed.sheets.length) throw new Error("No readable sheets were found in this file.");
      setFile(parsed); changeSelection(parsed, 0, 0);
    } catch (error) { if (request === readSequence.current) setError(message(error)); }
    finally { if (request === readSequence.current) setBusy(null); }
  }

  function generatePreview() {
    setError(null); setSuccess(null); setReviewed(null); setNameConfirmed(false); setApplyConfirmed(false); setRowLimit(50);
    if (!table || !file || !sheet) { setError("Choose a readable file, sheet, and header row first."); return; }
    try {
      if (kind === "roster") {
        if (workspace.batches.some(batch => batch.kind === "roster" && batch.fileHash === file.fileHash && batch.sheetName === sheet.name && batch.season === season.trim())) {
          throw new Error("This roster file and sheet were already imported for this season. For changes, use an updated file containing the permanent athlete codes from your roster export.");
        }
        const data = previewRoster(table, rosterMapping, season.trim(), workspace.mode === "sample" ? [] : workspace.roster);
        const generatedWithoutEmail = data.rows.filter(row => {
          if (row.matchMethod !== "new" || row.status !== "create") return false;
          const raw = table.rows[table.rowNumbers.indexOf(row.row)];
          return raw && !(raw[rosterMapping.athlete_code ?? -1] ?? "").trim() && !(raw[rosterMapping.pacific_email ?? -1] ?? "").trim();
        }).length;
        setReviewed({ kind, data, revision: workspace.revision, fileName: file.fileName, fileHash: file.fileHash, sheetName: sheet.name, season: season.trim(), generatedWithoutEmail, source: "Master roster" });
      } else {
        const sourceLabel = source === "Other" ? otherSource.trim() : source;
        const mapping: MeasurementMapping = {
          identityKind, identityColumn, identityOverrides,
          ...(dateMode === "column" ? { dateColumn } : { fixedDate }),
          dateFormat: dateMode === "fixed" ? "ISO" : dateFormat,
          source: sourceLabel, metrics: metrics.map(({ column, label, unit }) => ({ column, label, unit })),
        };
        const data = previewMeasurements(table, mapping, workspace.roster, workspace.measurements, {
          fileName: file.fileName, fileHash: file.fileHash, sheetName: sheet.name,
        });
        setReviewed({ kind, data, revision: workspace.revision, fileName: file.fileName, fileHash: file.fileHash, sheetName: sheet.name, source: sourceLabel });
      }
    } catch (error) { setError(message(error)); }
  }

  async function applyImport() {
    if (!reviewed || !canApply) return;
    setBusy("Saving import…"); setError(null); setSuccess(null);
    const batch = {
      id: crypto.randomUUID(), kind: reviewed.kind, fileName: reviewed.fileName, source: reviewed.source,
      importedAt: new Date().toISOString(), created: reviewed.data.counts.create,
      updated: reviewed.data.counts.update, unchanged: reviewed.data.counts.unchanged,
      fileHash: reviewed.fileHash, sheetName: reviewed.sheetName, ...(reviewed.season ? { season: reviewed.season } : {}),
    };
    try {
      if (reviewed.kind === "roster") await workspace.applyRoster(reviewed.data.candidateRoster, batch, reviewed.revision);
      else await workspace.applyMeasurements(reviewed.data.candidateMeasurements, batch, reviewed.revision);
      setSuccess(`${reviewed.fileName} was saved in this browser.`);
      setReviewed(null); setApplyConfirmed(false); setNameConfirmed(false);
    } catch (error) { setError(message(error)); }
    finally { setBusy(null); }
  }

  async function removeBatch(id: string) {
    setBusy("Removing measurement batch…"); setError(null); setSuccess(null);
    try { await workspace.removeBatch(id); setBatchToRemove(null); setSuccess("Measurement batch removed from this browser."); }
    catch (error) { setError(message(error)); }
    finally { setBusy(null); }
  }

  async function restoreBackup() {
    if (!backupFile || !restoreConfirmed) return;
    setBusy("Restoring backup…"); setError(null); setSuccess(null);
    try {
      if (backupFile.size > 30 * 1024 * 1024) throw new Error("Backup is too large (30 MB maximum).");
      await workspace.restoreBackup(await backupFile.text());
      setReviewed(null); setRestoreConfirmed(false); setBackupFile(null);
      setSuccess("Backup restored in this browser.");
    } catch (error) { setError(message(error)); }
    finally { setBusy(null); }
  }

  async function resetWorkspace() {
    if (!resetConfirmed) return;
    setBusy("Resetting workspace…"); setError(null); setSuccess(null);
    try {
      await workspace.resetWorkspace(); setReviewed(null); setResetConfirmed(false);
      setSuccess("This browser workspace has been reset to the fictional sample roster.");
    } catch (error) { setError(message(error)); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <div className="panel flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-pacu-red p-5">
        <div><p className="mb-1 flex items-center gap-2 font-semibold"><HardDrive size={18} />Saved in this browser</p><p className="muted mb-0 text-sm">Your imports stay on this device. Export a backup to transfer them to another browser.</p></div>
        <button type="button" className="btn btn-secondary" disabled={!workspace.ready || Boolean(busy)} onClick={() => { try { workspace.exportBackup(); } catch (error) { setError(message(error)); } }}><Download size={16} />Export backup</button>
      </div>
      {!workspace.ready && <p role="status" className="notice">Opening your browser workspace…</p>}
      {(error || workspace.error) && <p role="alert" className="notice notice-error">{error || workspace.error}</p>}
      {success && <div role="status" className="notice notice-success flex flex-wrap items-center justify-between gap-3"><span>{success}</span><Link href="/preview" className="font-semibold">Open dashboard →</Link></div>}
      {busy && <p role="status" className="muted text-sm">{busy}</p>}

      <div className="grid gap-3 sm:grid-cols-3" aria-label="Choose an import format">
        <button type="button" className={`btn ${!reportView && kind === "roster" ? "btn-primary" : "btn-secondary"}`} onClick={() => { invalidate(); setKind("roster"); setReportView(false); }}>Roster spreadsheet</button>
        <button type="button" className={`btn ${reportView ? "btn-primary" : "btn-secondary"}`} onClick={() => { invalidate(); setReportView(true); }}>RENPHO report</button>
        <button type="button" className={`btn ${!reportView && kind === "measurements" ? "btn-primary" : "btn-secondary"}`} onClick={() => { invalidate(); setKind("measurements"); setReportView(false); }}>Other measurements</button>
      </div>
      {reportView ? <RenphoImport /> : <>
      <section className="panel p-5 sm:p-7">
        <h2 className="mb-1 text-lg font-bold">1. Choose your file</h2>
        <p className="muted mb-6 text-sm">CSV, TSV, or XLSX · up to 2 MiB · choose the sheet and header row yourself.</p>
        <p className="muted mb-6 text-sm">Calculated cells are not imported; export values only or map raw measurements.</p>
        <fieldset disabled={!workspace.ready || Boolean(busy)} className="min-w-0 space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <label>Import type<select value={kind} onChange={event => { invalidate(); setKind(event.target.value as ImportKind); }}><option value="roster">Master roster</option><option value="measurements">Measurements</option></select></label>
            <label>Spreadsheet file<input type="file" accept=".csv,.tsv,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event => { void chooseFile(event.target.files?.[0]); }} /></label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm"><a href="/templates/local-roster.csv" download className="font-semibold text-pacu-red">Download roster template</a><a href="/templates/measurements.csv" download className="font-semibold text-pacu-red">Download measurement template</a></div>
          {file && sheet && <>
            <div className="grid gap-5 md:grid-cols-2">
              <label>Sheet<select value={sheetIndex} onChange={event => changeSelection(file, Number(event.target.value), 0)}>{file.sheets.map((item, index) => <option key={index} value={index}>{item.name}</option>)}</select></label>
              <label>Header row<input type="number" min={1} max={sheet.matrix.length} value={headerIndex + 1} onChange={event => changeSelection(file, sheetIndex, Math.max(0, Number(event.target.value) - 1))} /></label>
            </div>
            <div className="table-wrap rounded-lg border border-gray-200"><table><caption className="px-5 py-3 text-left text-xs text-gray-500">Raw sample · selected header row and up to five following rows</caption><tbody>{sheet.matrix.slice(headerIndex, headerIndex + 6).map((row, index) => <tr key={index} className={index === 0 ? "bg-gray-50 font-semibold" : ""}><th scope="row">Row {headerIndex + index + 1}</th>{row.map((cell, column) => <td key={column} className="max-w-xs break-words">{cell || "—"}</td>)}</tr>)}</tbody></table></div>
            {selected.error && <p role="alert" className="notice notice-error">{selected.error}</p>}
          </>}
        </fieldset>
      </section>

      {table && <section className="panel p-5 sm:p-7">
        <h2 className="mb-1 text-lg font-bold">2. Map your columns</h2>
        <p className="muted mb-6 text-sm">{table.rows.length} source rows · {kind === "roster" ? "Review the suggested roster mapping. Unmapped optional fields stay blank." : "Choose what each column means. Vendor choices are source labels; no vendor-specific presets have been verified."}</p>
        <fieldset disabled={!workspace.ready || Boolean(busy)} className="min-w-0 space-y-6">
          {kind === "roster" ? <>
            {workspace.mode === "sample" && <p className="notice">Your first roster import replaces the fictional sample roster in this browser.</p>}
            <label className="max-w-xs">Season<input value={season} maxLength={7} placeholder="2026 or 2026-27" onChange={event => { invalidate(); setSeason(event.target.value); }} /></label>
            <p className="muted text-sm">New athletes need first and last names. Keep existing permanent codes when available; new athletes without codes receive the next PAC ID in this roster. Blank cells preserve existing values. Matching by email is shown in the preview.</p>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{ROSTER_FIELDS.map(field => <ColumnSelect key={field} label={FIELD_LABELS[field]} headers={table.headers} value={rosterMapping[field] ?? -1} optional onChange={column => { invalidate(); setRosterMapping(current => { const next = { ...current }; if (column < 0) delete next[field]; else next[field] = column; return next; }); }} />)}</div>
          </> : <>
            <div className="grid gap-5 md:grid-cols-2">
              <label>Measurement source<select value={source} onChange={event => { invalidate(); setSource(event.target.value); }}><option value="">Choose a source</option>{SOURCES.map(item => <option key={item}>{item}</option>)}</select></label>
              {source === "Other" && <label>Source name<input value={otherSource} maxLength={120} placeholder="Name this measurement source" onChange={event => { invalidate(); setOtherSource(event.target.value); }} /></label>}
              <label>Match athletes by<select value={identityKind} onChange={event => { invalidate(); setIdentityOverrides({}); setIdentityKind(event.target.value as MeasurementMapping["identityKind"]); }}><option value="code">Permanent athlete code</option><option value="email">Roster email</option><option value="name">Full roster name · review required</option></select></label>
              <ColumnSelect label="Athlete identity column" headers={table.headers} value={identityColumn} onChange={column => { invalidate(); setIdentityColumn(column); setIdentityOverrides({}); }} />
            </div>
            {identityKind === "name" && <p className="notice">Use the full first and last roster name. Review all name matches before saving; ambiguous names need an explicit athlete selection below.</p>}
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <label>Measurement date<select value={dateMode} onChange={event => { invalidate(); setDateMode(event.target.value as "column" | "fixed"); }}><option value="column">Read from a column</option><option value="fixed">Use one date for every row</option></select></label>
              {dateMode === "column" ? <><ColumnSelect label="Date column" headers={table.headers} value={dateColumn} onChange={column => { invalidate(); setDateColumn(column); }} /><label>Date format<select value={dateFormat} onChange={event => { invalidate(); setDateFormat(event.target.value as DateFormat); }}><option value="ISO">YYYY-MM-DD (ISO)</option><option value="MDY">MM/DD/YYYY</option><option value="DMY">DD/MM/YYYY</option></select></label></> : <label>Fixed measurement date<input type="date" value={fixedDate} onChange={event => { invalidate(); setFixedDate(event.target.value); }} /></label>}
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Measurement columns</h3><p className="muted mb-4 text-sm">Map each numeric column with an explicit name and unit. Empty measurement cells are skipped. Put units here, not inside numeric cells.</p>
              <div className="space-y-4">{metrics.map((metric, index) => <div key={metric.id} className="grid items-end gap-4 rounded-lg border border-gray-200 p-4 md:grid-cols-[1.2fr_1fr_0.7fr_auto]">
                <ColumnSelect label={`Metric ${index + 1} column`} headers={table.headers} value={metric.column} onChange={column => { invalidate(); setMetrics(current => current.map(item => item.id === metric.id ? { ...item, column } : item)); }} />
                <label>Measurement name<input value={metric.label} maxLength={120} placeholder="Enter the metric name" onChange={event => { invalidate(); setMetrics(current => current.map(item => item.id === metric.id ? { ...item, label: event.target.value } : item)); }} /></label>
                <label>Unit<input value={metric.unit} maxLength={60} placeholder="e.g. kg or seconds" onChange={event => { invalidate(); setMetrics(current => current.map(item => item.id === metric.id ? { ...item, unit: event.target.value } : item)); }} /></label>
                <button type="button" className="btn btn-secondary" aria-label={`Remove metric ${index + 1}`} disabled={metrics.length === 1} onClick={() => { invalidate(); setMetrics(current => current.filter(item => item.id !== metric.id)); }}><Trash2 size={16} /></button>
              </div>)}</div>
              <button type="button" className="btn btn-secondary mt-4" disabled={metrics.length >= table.headers.length} onClick={() => { invalidate(); setMetrics(current => [...current, { id: crypto.randomUUID(), column: -1, label: "", unit: "" }]); }}><Plus size={16} />Add measurement column</button>
            </div>
            {identityColumn >= 0 && <details className="rounded-lg border border-gray-200 p-5"><summary className="cursor-pointer font-semibold">Review or override athlete matches</summary><p className="muted mt-3 text-sm">An explicit selection applies to every source row with that identity. Only choose a roster athlete after verifying who the source identity represents.</p><label className="mb-4 max-w-md">Find source identity<input value={identitySearch} onChange={event => { setIdentitySearch(event.target.value); setIdentityLimit(50); }} placeholder="Search identities in the file" /></label><div className="space-y-4">{identities.slice(0, identityLimit).map(identity => <label key={identity} className="grid items-center gap-3 break-words sm:grid-cols-2"><span>{identity}</span><select aria-label={`Match ${identity} to athlete`} value={identityOverrides[identity] ?? ""} onChange={event => { invalidate(); setIdentityOverrides(current => { const next = { ...current }; if (event.target.value) next[identity] = event.target.value; else delete next[identity]; return next; }); }}><option value="">Use automatic match</option>{workspace.roster.map(athlete => <option key={athlete.athlete_code} value={athlete.athlete_code}>{athlete.athlete_code} · {athleteName(athlete)}</option>)}</select></label>)}</div>{identities.length > identityLimit && <button type="button" className="btn btn-secondary mt-4" onClick={() => setIdentityLimit(current => current + 50)}>Show more identities</button>}{!identities.length && <p className="muted mb-0 text-sm">No matching source identities.</p>}</details>}
          </>}
          <button type="button" className="btn btn-primary" onClick={generatePreview}><FileSpreadsheet size={17} />Validate and preview <ArrowRight size={16} /></button>
        </fieldset>
      </section>}

      {reviewed && <section className="panel p-5 sm:p-7">
        <h2 className="mb-1 text-lg font-bold">3. Review and save</h2><p className="muted mb-5 text-sm">{reviewed.fileName} · {reviewed.source} · counts below are source rows.{reviewed.kind === "measurements" && ` ${reviewed.data.candidateMeasurements.length} new measurement values are ready for review.`}</p>
        <PreviewCounts counts={reviewed.data.counts} />
        {Boolean(reviewed.generatedWithoutEmail) && <p className="notice mb-5">{reviewed.generatedWithoutEmail} new athletes have no source code or email. Their generated permanent codes appear below. Export the roster after saving and include those codes in future updates; names alone will create new athletes.</p>}
        {stale && <p role="alert" className="notice mb-5">Your workspace changed after this preview. Select Validate and preview again before saving.</p>}
        {reviewed.kind === "measurements" && reviewed.data.issues.filter(issue => issue.row === 0).map((issue, index) => <p role="alert" className="notice notice-error mb-5" key={index}>{issue.message}</p>)}
        <RowPreview preview={reviewed} limit={rowLimit} onShowMore={() => setRowLimit(current => current + 50)} />
        {!reviewed.data.canApply && <p role="alert" className="notice notice-error mt-5">Resolve the rejected rows or import issues, then generate a new preview. No rows from this file have been saved.</p>}
        {nameMatches > 0 && <label className="mt-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"><input type="checkbox" checked={nameConfirmed} onChange={event => setNameConfirmed(event.target.checked)} /><span>I reviewed all {nameMatches} source rows matched by athlete name and confirmed each athlete.</span></label>}
        <label className="my-5 flex items-start gap-3"><input type="checkbox" checked={applyConfirmed} onChange={event => setApplyConfirmed(event.target.checked)} /><span>I reviewed the rows and approve saving this import in this browser.</span></label>
        <button type="button" className="btn btn-primary" disabled={!canApply} onClick={() => { void applyImport(); }}><Check size={17} />Apply reviewed import</button>
      </section>}

      </>}
      <section className="panel p-5 sm:p-7">
        <h2 className="mb-1 text-lg font-bold">Import history</h2><p className="muted mb-5 text-sm">Saved batches in this browser. Removing a measurement batch removes its measurement values; roster imports remain in the history.</p>
        {!workspace.batches.length ? <p className="muted mb-0 text-sm">No imports saved yet.</p> : <div className="table-wrap"><table><thead><tr><th>File / source</th><th>Imported (UTC)</th><th>Created / updated / unchanged</th><th>Action</th></tr></thead><tbody>{[...workspace.batches].reverse().map(batch => <tr key={batch.id}><td><p className="mb-1 break-all font-semibold">{batch.fileName}</p><p className="muted mb-0 text-xs">{batch.source} · {batch.kind}</p></td><td className="whitespace-nowrap text-xs">{batch.importedAt.slice(0, 19).replace("T", " ")}</td><td>{batch.created} / {batch.updated} / {batch.unchanged}</td><td>{batch.kind === "measurements" && (batchToRemove === batch.id ? <div className="min-w-[200px]"><p className="mb-2 text-xs">Remove this batch and its measurements?</p><div className="flex flex-wrap gap-2"><button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => { void removeBatch(batch.id); }}>Confirm removal</button><button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => setBatchToRemove(null)}>Cancel</button></div></div> : <button type="button" className="btn btn-secondary" disabled={!workspace.ready || Boolean(busy)} onClick={() => setBatchToRemove(batch.id)}><Trash2 size={15} />Remove batch</button>)}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="panel p-5 sm:p-7">
        <h2 className="mb-1 text-lg font-bold">Transfer or reset this workspace</h2><p className="muted mb-5 text-sm">Download an export above, then restore that JSON backup in another browser. Keep your backup somewhere you control.</p>
        <div className="mb-7 flex flex-wrap items-end gap-4"><label className="min-w-40">Export season<select value={exportSeasons.includes(exportSeason) ? exportSeason : (exportSeasons[0] ?? "")} onChange={event => setExportSeason(event.target.value)}>{exportSeasons.map(item => <option key={item}>{item}</option>)}</select></label><button type="button" className="btn btn-secondary" disabled={!workspace.ready || Boolean(busy) || !exportSeasons.length} onClick={() => { try { workspace.exportRoster(exportSeasons.includes(exportSeason) ? exportSeason : exportSeasons[0]); } catch (error) { setError(message(error)); } }}><Download size={16} />Export roster with athlete codes</button></div>
        <fieldset disabled={!workspace.ready || Boolean(busy)} className="min-w-0 grid gap-7 lg:grid-cols-2">
          <div className="space-y-4"><label>Restore workspace JSON backup<input type="file" accept=".json,application/json" onChange={event => { setBackupFile(event.target.files?.[0] ?? null); setRestoreConfirmed(false); }} /></label><label className="flex items-start gap-3"><input type="checkbox" checked={restoreConfirmed} onChange={event => setRestoreConfirmed(event.target.checked)} /><span>Replace this browser&apos;s roster, measurements, and import history with this backup.</span></label><button type="button" className="btn btn-secondary" disabled={!backupFile || !restoreConfirmed} onClick={() => { void restoreBackup(); }}><Upload size={16} />Restore backup</button></div>
          <div className="space-y-4 rounded-lg bg-gray-50 p-5"><h3 className="font-semibold">Return to fictional sample data</h3><p className="muted text-sm">Export a backup first if you want to keep your current data.</p><label className="flex items-start gap-3"><input type="checkbox" checked={resetConfirmed} onChange={event => setResetConfirmed(event.target.checked)} /><span>Clear the saved roster, measurements, and import history from this browser.</span></label><button type="button" className="btn btn-secondary" disabled={!resetConfirmed} onClick={() => { void resetWorkspace(); }}><RotateCcw size={16} />Reset browser workspace</button></div>
        </fieldset>
      </section>
    </div>
  );
}
