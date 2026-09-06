"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, Plus, Trash2 } from "lucide-react";
import { FileDropZone } from "@/components/file-drop-zone";
import { readImportFile } from "@/lib/imports/files";
import { selectTable, type DateFormat, type Measurement, type MeasurementMapping, type MeasurementPreview } from "@/lib/imports/engine";
import { FULL_SWING_LABELS, fullSwingMetrics, previewFullSwingSummary, type FullSwingCategory } from "@/lib/imports/full-swing";
import { athleteName, type RosterAthlete } from "@/lib/types";

type MetricMap = { id: number; column: number; key: string; unit: string };
type FileData = Awaited<ReturnType<typeof readImportFile>>;
export type SaveImportAction = (measurements: Measurement[]) => Promise<string>;
const errorText = (error: unknown) => error instanceof Error ? error.message : "The import could not be completed. Review the file and try again.";

function ColumnSelect({ label, headers, value, onChange }: { label: string; headers: string[]; value: number; onChange: (value: number) => void }) {
  return <label>{label}<select value={value} onChange={event => onChange(Number(event.target.value))}><option value={-1}>Choose a column…</option>{headers.map((header, index) => <option key={index} value={index}>{index + 1}. {header}</option>)}</select></label>;
}

export function FullSwingImport({ category, roster, saveAction }: { category: FullSwingCategory; roster: RosterAthlete[]; saveAction: SaveImportAction }) {
  const [file, setFile] = useState<FileData | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [identityKind, setIdentityKind] = useState<MeasurementMapping["identityKind"]>("name");
  const [identityColumn, setIdentityColumn] = useState(-1);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [dateMode, setDateMode] = useState<"fixed" | "column">("fixed");
  const [date, setDate] = useState("");
  const [dateColumn, setDateColumn] = useState(-1);
  const [dateFormat, setDateFormat] = useState<DateFormat>("ISO");
  const [metrics, setMetrics] = useState<MetricMap[]>([{ id: 0, column: -1, key: "", unit: "" }]);
  const nextId = useRef(1);
  const request = useRef(0);
  const [summaryConfirmed, setSummaryConfirmed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reviewed, setReviewed] = useState<MeasurementPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const definitions = fullSwingMetrics(category);
  let table: ReturnType<typeof selectTable> | null = null;
  let tableError = "";
  if (file) { try { table = selectTable(file.sheets[0].matrix, headerRow); } catch (error) { tableError = errorText(error); } }
  const identities = table && identityColumn >= 0 ? [...new Set(table.rows.map(row => row[identityColumn]).filter(Boolean))] : [];
  const invalidate = () => { setReviewed(null); setConfirmed(false); setError(""); setReceipt(""); };
  async function chooseFile(next?: File) {
    const version = ++request.current;
    invalidate(); setFile(null); setHeaderRow(0); setIdentityColumn(-1); setOverrides({}); setDateColumn(-1); setSummaryConfirmed(false);
    setMetrics([{ id: nextId.current++, column: -1, key: "", unit: "" }]);
    if (!next) return;
    setBusy(true);
    try {
      if (!next.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a Full Swing CSV or a reviewed PACU summary CSV.");
      const loaded = await readImportFile(next);
      if (version === request.current) setFile(loaded);
    } catch (error) { if (version === request.current) setError(errorText(error)); }
    finally { if (version === request.current) setBusy(false); }
  }
  function review() {
    invalidate();
    if (!table || !file) return;
    try {
      const mapping: MeasurementMapping = {
        identityKind, identityColumn, identityOverrides: overrides,
        ...(dateMode === "fixed" ? { fixedDate: date } : { dateColumn }), dateFormat: dateMode === "fixed" ? "ISO" : dateFormat,
        source: "", metrics: metrics.map(metric => ({ column: metric.column, label: definitions.find(item => item.key === metric.key)?.label ?? "", unit: metric.unit })),
      };
      setReviewed(previewFullSwingSummary({ table, mapping, roster, file: { fileName: file.fileName, fileHash: file.fileHash, sheetName: file.sheets[0].name }, category, summaryConfirmed }));
    } catch (error) { setError(errorText(error)); }
  }
  async function save() {
    if (!reviewed?.canApply || !confirmed || busy) return;
    setBusy(true); setError("");
    try { setReceipt(await saveAction(reviewed.candidateMeasurements)); setReviewed(null); setConfirmed(false); }
    catch (error) { setError(errorText(error)); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <section className="panel p-5 sm:p-7">
      <h2 className="mb-2 text-lg font-bold">1. Add {FULL_SWING_LABELS[category]} Data</h2>
      <p className="muted text-sm">Review the columns before saving. This importer accepts one player’s session summary per row. Individual swing or pitch files will need setup once the first Full Swing export is available.</p>
      <FileDropZone label={`Full Swing CSV · ${FULL_SWING_LABELS[category]}`} description="Drop a CSV here, or choose a file. Up to 2 MiB; 500 readings per import." accept=".csv,text/csv" disabled={busy || !roster.length} onFile={next => { void chooseFile(next); }} />
      <p className="muted mb-0 mt-4 text-xs">No file yet? <a className="font-semibold underline" href={`/templates/pacu-${category}-summary.csv`} download>Download the PACU summary template</a>. It is our template, not a Full Swing export format.</p>
      {busy && <p role="status" className="mt-4 text-sm">{file ? "Saving reviewed readings…" : "Reading CSV…"}</p>}
    </section>
    {file && <fieldset disabled={busy} className="min-w-0 space-y-6">
      <section className="panel p-5 sm:p-7">
        <h2 className="mb-2 text-lg font-bold">2. Match Players and Columns</h2>
        <p className="muted break-words text-sm">{file.fileName}</p>
        <label className="mb-5 max-w-xs">Header row<select value={headerRow} onChange={event => { invalidate(); setHeaderRow(Number(event.target.value)); setIdentityColumn(-1); setDateColumn(-1); setOverrides({}); setMetrics([{ id: nextId.current++, column: -1, key: "", unit: "" }]); }}>{file.sheets[0].matrix.slice(0, 20).map((_, index) => <option value={index} key={index}>Row {index + 1}</option>)}</select></label>
        {tableError && <p role="alert" className="notice notice-error">{tableError}</p>}
        {table && <>
          <details className="mb-6 rounded-lg border border-gray-200 p-4"><summary className="cursor-pointer font-semibold">Source Preview · {table.rows.length} Rows</summary><div className="table-wrap mt-4"><table><thead><tr><th>Row</th>{table.headers.map((header, index) => <th key={index}>{header}</th>)}</tr></thead><tbody>{table.rows.slice(0, 10).map((row, index) => <tr key={index}><td>{table!.rowNumbers[index]}</td>{row.map((cell, column) => <td key={column}>{cell || "—"}</td>)}</tr>)}</tbody></table></div><p className="muted mb-0 mt-3 text-xs">First 10 rows shown. All rows are validated before saving.</p></details>
          <div className="grid gap-5 md:grid-cols-2">
            <label>Player identifier<select value={identityKind} onChange={event => { invalidate(); setIdentityKind(event.target.value as MeasurementMapping["identityKind"]); setOverrides({}); }}><option value="name">Player name</option><option value="code">PAC athlete ID</option><option value="email">Pacific email</option></select></label>
            <ColumnSelect label="Player column" headers={table.headers} value={identityColumn} onChange={value => { invalidate(); setIdentityColumn(value); setOverrides({}); }} />
            <label>Test or game date<select value={dateMode} onChange={event => { invalidate(); setDateMode(event.target.value as "fixed" | "column"); }}><option value="fixed">One date for this file</option><option value="column">Read dates from a column</option></select></label>
            {dateMode === "fixed" ? <label>Date<input type="date" min="2026-09-01" max="2026-12-31" value={date} onChange={event => { invalidate(); setDate(event.target.value); }} /></label> : <><ColumnSelect label="Date column" headers={table.headers} value={dateColumn} onChange={value => { invalidate(); setDateColumn(value); }} /><label>Date format<select value={dateFormat} onChange={event => { invalidate(); setDateFormat(event.target.value as DateFormat); }}><option value="ISO">YYYY-MM-DD</option><option value="MDY">MM/DD/YYYY</option><option value="DMY">DD/MM/YYYY</option></select></label></>}
          </div>
          {!!identities.length && <details className="mt-5 rounded-lg border border-gray-200 p-4"><summary className="cursor-pointer font-semibold">Match Export Names to the Roster</summary><p className="muted mt-3 text-sm">Exact unique matches are suggested during review. Select a player here when an export uses a different name or ID.</p><div className="grid max-h-96 gap-4 overflow-y-auto md:grid-cols-2">{identities.map(identity => <label key={identity} className="break-words">{identity}<select value={overrides[identity] ?? ""} onChange={event => { invalidate(); setOverrides(current => { const next = { ...current }; if (event.target.value) next[identity] = event.target.value; else delete next[identity]; return next; }); }}><option value="">Use an exact unique match</option>{roster.map(athlete => <option key={athlete.id} value={athlete.athlete_code}>{athleteName(athlete)} · {athlete.athlete_code}</option>)}</select></label>)}</div></details>}
          <h3 className="mb-3 mt-7 font-bold">Profile Measurements</h3>
          <p className="muted text-sm">Choose the meaning and original unit of each column. Percentages use 0–100, not decimal fractions. Average fastball spin must already exclude other pitch types.</p>
          <div className="space-y-4">{metrics.map((metric, index) => <div key={metric.id} className="grid items-end gap-3 rounded-lg border border-gray-200 p-4 md:grid-cols-[1fr_1fr_120px_44px]">
            <ColumnSelect label={`Data column ${index + 1}`} headers={table.headers} value={metric.column} onChange={value => { invalidate(); setMetrics(current => current.map(item => item.id === metric.id ? { ...item, column: value } : item)); }} />
            <label>Profile metric<select value={metric.key} onChange={event => { invalidate(); setMetrics(current => current.map(item => item.id === metric.id ? { ...item, key: event.target.value, unit: "" } : item)); }}><option value="">Choose a metric…</option>{definitions.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
            <label>Unit<select value={metric.unit} onChange={event => { invalidate(); setMetrics(current => current.map(item => item.id === metric.id ? { ...item, unit: event.target.value } : item)); }}><option value="">Choose…</option>{(definitions.find(item => item.key === metric.key)?.units ?? []).map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label>
            <button type="button" className="btn btn-secondary mb-px" aria-label={`Remove data column ${index + 1}`} disabled={metrics.length === 1} onClick={() => { invalidate(); setMetrics(current => current.filter(item => item.id !== metric.id)); }}><Trash2 size={16} /></button>
          </div>)}</div>
          <button type="button" className="btn btn-secondary mt-4" disabled={metrics.length >= definitions.length} onClick={() => { invalidate(); setMetrics(current => [...current, { id: nextId.current++, column: -1, key: "", unit: "" }]); }}><Plus size={16} />Add Measurement</button>
          <label className="my-6 flex items-start gap-3"><input type="checkbox" checked={summaryConfirmed} onChange={event => { invalidate(); setSummaryConfirmed(event.target.checked); }} /><span>Each row contains one player’s reviewed session summaries. I am not labeling individual swings or pitches as an average or maximum.</span></label>
          <button type="button" className="btn btn-primary" onClick={review}>Review Import</button>
        </>}
      </section>
      {reviewed && <section className="panel p-5 sm:p-7">
        <h2 className="mb-2 text-lg font-bold">3. Review and Save</h2>
        <p className="muted text-sm">{reviewed.candidateMeasurements.length} readings · Full Swing · {FULL_SWING_LABELS[category]} · Fall 2026</p>
        {!!reviewed.issues.length && <div role="alert" className="notice notice-error"><p className="font-semibold">Fix these rows before saving.</p><ul className="mb-0 list-disc pl-5">{reviewed.issues.slice(0, 30).map((issue, index) => <li key={index}>Row {issue.row}: {issue.message}</li>)}</ul>{reviewed.issues.length > 30 && <p>{reviewed.issues.length - 30} additional issues remain.</p>}</div>}
        <div className="table-wrap"><table><caption className="sr-only">All reviewed readings</caption><thead><tr><th>Player</th><th>Date</th><th>Measurement</th><th>Value</th><th>Source Row</th></tr></thead><tbody>{reviewed.candidateMeasurements.map(row => <tr key={row.id}><td>{athleteName(roster.find(athlete => athlete.athlete_code === row.athlete_code)!)}<span className="muted block text-xs">{row.athlete_code}</span></td><td className="whitespace-nowrap">{row.measured_at}</td><td>{row.metric}</td><td className="whitespace-nowrap">{row.value} {row.unit}</td><td>{row.source_row}</td></tr>)}</tbody></table></div>
        <label className="my-5 flex items-start gap-3"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I checked every player match, date, measurement, and unit. Save these readings to the team’s private profiles.</span></label>
        <button type="button" className="btn btn-primary" disabled={!reviewed.canApply || !reviewed.candidateMeasurements.length || !confirmed} onClick={() => { void save(); }}><Check size={17} />Save to Player Profiles</button>
      </section>}
    </fieldset>}
    {error && <p role="alert" className="notice notice-error">{error}</p>}
    {receipt && <p role="status" className="notice notice-success">{receipt} <Link href="/roster" className="font-semibold underline">Open Team Profiles</Link></p>}
  </div>;
}
