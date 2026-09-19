"use client";
import { formatSourceNumber } from "@/lib/measurement-display";

import type { PitchAssignmentStore } from "@/components/pitch-assignment-review";
import { FullSwingSessionReview } from "@/components/full-swing-session-review";
import { ImportConfirmation } from "@/components/import-confirmation";
import { buildImportConfirmation, type ReadingsSaved, type ImportConfirmationData } from "@/lib/import-confirmation";
import { useRef, useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, Plus, Trash2 } from "lucide-react";
import styles from "./import-presentation.module.css";
import { FileDropZone } from "@/components/file-drop-zone";
import { readImportFile } from "@/lib/imports/files";
import { selectTable, type DateFormat, type Measurement, type MeasurementMapping, type MeasurementPreview } from "@/lib/imports/engine";
import { FULL_SWING_LABELS, fullSwingMetrics, previewFullSwingSummary, type FullSwingCategory } from "@/lib/imports/full-swing";
import { BLAST_MOTION_METRICS, previewBlastMotionSummary } from "@/lib/imports/blast-motion";
import { looksLikeFullSwingSession, summarizeFullSwingSession, SESSION_METRICS, type FullSwingSession } from "@/lib/imports/full-swing-session";
import { selectRosterSummaries } from "@/lib/imports/roster-selection";
import { StatInfo } from "@/components/stat-info";
import { athleteName, type RosterAthlete } from "@/lib/types";

type MetricMap = { id: number; column: number; key: string; unit: string };
type FileData = Awaited<ReturnType<typeof readImportFile>>;
export type SaveImportAction = (measurements: Measurement[]) => Promise<ReadingsSaved>;
const errorText = (error: unknown) => error instanceof Error ? error.message : "The import could not be completed. Review the file and try again.";

function ColumnSelect({ label, headers, value, onChange }: { label: string; headers: string[]; value: number; onChange: (value: number) => void }) {
  return <label>{label}<select value={value} onChange={event => onChange(Number(event.target.value))}><option value={-1}>Choose a column…</option>{headers.map((header, index) => <option key={index} value={index}>{index + 1}. {header}</option>)}</select></label>;
}

export function FullSwingImport({ category, roster, saveAction, assignmentStore, vendor = "Full Swing" }: { assignmentStore?: PitchAssignmentStore; vendor?: "Full Swing" | "Blast Motion"; category: FullSwingCategory; roster: RosterAthlete[]; saveAction: SaveImportAction }) {
  const [file, setFile] = useState<FileData | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [session, setSession] = useState<FullSwingSession | null>(null);
  const [identityKind, setIdentityKind] = useState<MeasurementMapping["identityKind"]>("name");
  const [identityColumn, setIdentityColumn] = useState(-1);
  const [excluded, setExcluded] = useState<string[]>([]);
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
  const [receipt, setReceipt] = useState<ImportConfirmationData | null>(null);
  const blast = vendor === "Blast Motion";
  const definitions = blast ? BLAST_MOTION_METRICS : fullSwingMetrics(category);
  let table: ReturnType<typeof selectTable> | null = null;
  let tableError = "";
  if (file) { try { table = session?.table ?? selectTable(file.sheets[0].matrix, headerRow); } catch (error) { tableError = errorText(error); } }
  let selection: ReturnType<typeof selectRosterSummaries> | null = null;
  let selectionError = "";
  if (table && identityColumn >= 0) {
    try { selection = selectRosterSummaries(table, { identityKind, identityColumn, identityOverrides: overrides }, roster, excluded, session?.players.map(player => player.identity)); }
    catch (error) { selectionError = errorText(error); }
  }
  const invalidate = () => { setReviewed(null); setConfirmed(false); setError(""); setReceipt(null); };
  async function chooseFile(next?: File) {
    const version = ++request.current;
    invalidate(); setFile(null); setSession(null); setHeaderRow(0); setIdentityColumn(-1); setOverrides({}); setExcluded([]); setDateColumn(-1); setSummaryConfirmed(false);
    setMetrics([{ id: nextId.current++, column: -1, key: "", unit: "" }]);
    if (!next) return;
    setBusy(true);
    try {
      if (!next.name.toLowerCase().endsWith(".csv")) throw new Error(`Choose a ${vendor} CSV or a reviewed PACU summary CSV.`);
      const loaded = await readImportFile(next);
      if (version === request.current) {
        if (!blast && looksLikeFullSwingSession(loaded.sheets[0].matrix[0].map(cell => cell.trim()))) {
          const original = selectTable(loaded.sheets[0].matrix, 0);
          if (category !== "game" && category !== "intrasquad" && category !== "practice") throw new Error("Choose Games / Intrasquad for a Live at Bat session containing hitters and pitchers.");
          const parsed = summarizeFullSwingSession(original);
          setSession(parsed); setIdentityKind("name"); setIdentityColumn(0); setDateMode("column"); setDateColumn(1); setDateFormat("ISO");
          setMetrics(SESSION_METRICS.map((m, i) => ({ id: nextId.current++, column: i + 2, key: m.key, unit: m.unit })));
        }
        setFile(loaded);
      }
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
      if (selectionError) throw new Error(selectionError);
      if (!selection?.table.rows.length) throw new Error("No rostered player readings are selected. Match an export name to a roster player before importing.");
      const input = { table: selection.table, mapping, roster, file: { fileName: file.fileName, fileHash: file.fileHash, sheetName: session ? "CSV · Full Swing session summaries v1" : file.sheets[0].name }, category, summaryConfirmed };
      setReviewed(blast ? previewBlastMotionSummary(input) : previewFullSwingSummary(input));
    } catch (error) { setError(errorText(error)); }
  }
  async function save() {
    if (!reviewed?.canApply || !confirmed || busy) return;
    setBusy(true); setError("");
    try {
      const skipped = metrics.flatMap(metric => {
        const count = selection?.table.rows.filter(row => !row[metric.column]?.trim()).length ?? 0;
        return count ? [{ label: definitions.find(item => item.key === metric.key)!.label, reason: `${count} blank ${count === 1 ? "cell was" : "cells were"} skipped.` }] : [];
      });
      if (selection?.skipped.length) skipped.push({ label: "Excluded players", reason: `${selection.skipped.length} unmatched or excluded export names were not imported.` });
      const result = await saveAction(reviewed.candidateMeasurements);
      setReceipt(buildImportConfirmation(reviewed.candidateMeasurements, roster, result, skipped));
      setReviewed(null); setConfirmed(false);
    }
    catch (error) { setError(errorText(error)); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <section className={`panel p-5 sm:p-7 ${styles.uploadPanel}`}>
      <h2 className={styles.stepTitle}><span className={styles.stepNumber}>1.</span>{" "}Add {FULL_SWING_LABELS[category]} Data</h2>
      <p className={styles.sectionLead}>{!blast && (category === "game" || category === "intrasquad" || category === "practice") ? "Full Swing Live at Bat export or player session summaries." : "One player’s session summary per row."}</p>
      <FileDropZone label={`${vendor} CSV · ${FULL_SWING_LABELS[category]}`} description="Drop a CSV here, or choose a file." accept=".csv,text/csv" disabled={busy || !roster.length} onFile={next => { void chooseFile(next); }} />
      <details className={styles.help}><summary>CSV Requirements &amp; Template</summary><div className="mt-3 space-y-3"><p className="muted mb-0 text-sm">Use session summaries, up to 2 MiB and 500 readings. {!blast && (category === "game" || category === "intrasquad" || category === "practice") ? "The reviewed Field / Live at Bat layout is supported after confirming mph and feet. Upload each complete session once; do not upload overlapping or edited copies." : blast ? "Individual-swing Blast exports are not supported yet." : "Full Swing Live at Bat exports belong in Games / Intrasquad."}</p><p className="muted mb-0 text-sm"><a className="font-semibold underline" href={blast ? "/templates/pacu-blast-motion-summary.csv" : `/templates/pacu-${category === "practice" ? "intrasquad" : category}-summary.csv`} download>Download the PACU summary template</a>. This blank template is provided by PACU; it is not a {vendor} export format.</p></div></details>
      {blast && <p className="muted mt-3 mb-0 text-sm">Import maximum and average bat speed from session summaries. Your first Blast export will help us verify the format; individual-swing CSVs are not supported yet.</p>}
      {busy && <p role="status" className={styles.progress}><LoaderCircle className="animate-spin" size={18} aria-hidden="true" />{file ? "Saving reviewed readings…" : "Reading CSV…"}</p>}
    </section>
    {file && <fieldset disabled={busy} className="min-w-0 space-y-6">
      <section className="panel p-5 sm:p-7">
        <h2 className={styles.stepTitle}><span className={styles.stepNumber}>2.</span>{" "}Match Players and Columns</h2>
        <p className={`${styles.sectionLead} break-words`}>{file.fileName}</p>
        {session && <div className="notice mb-5"><p className="font-semibold">Live at Bat · {session.date}</p><p>Source file: {session.eventCount} pitches · {session.pitcherCount} {session.pitcherCount === 1 ? "pitcher" : "pitchers"} · {session.batterCount} {session.batterCount === 1 ? "batter" : "batters"}. Summaries use only recorded values; nulls are skipped.</p><p className="mb-0 text-sm">The export has no pitch labels or outcomes. Review pitch assignments below to add velocity and spin by type; strike, K, and BB percentages remain unavailable. Potential exit speed is not measured exit velocity.</p></div>}
        {!session && <details className="mb-5 rounded-lg border border-[var(--line-subtle)] p-4"><summary className="cursor-pointer text-sm font-semibold">File Layout</summary><label className="mt-4 max-w-xs">Header row<select value={headerRow} onChange={event => { invalidate(); setHeaderRow(Number(event.target.value)); setIdentityColumn(-1); setDateColumn(-1); setOverrides({}); setExcluded([]); setMetrics([{ id: nextId.current++, column: -1, key: "", unit: "" }]); }}>{file.sheets[0].matrix.slice(0, 20).map((_, index) => <option value={index} key={index}>Row {index + 1}</option>)}</select></label></details>}
        {tableError && <p role="alert" className="notice notice-error">{tableError}</p>}
        {table && <>
          {!session && <div className="grid gap-5 md:grid-cols-2">
            <label>Player identifier<select value={identityKind} onChange={event => { invalidate(); setIdentityKind(event.target.value as MeasurementMapping["identityKind"]); setOverrides({}); setExcluded([]); }}><option value="name">Player name</option><option value="code">PAC athlete ID</option><option value="email">Pacific email</option></select></label>
            <ColumnSelect label="Player column" headers={table.headers} value={identityColumn} onChange={value => { invalidate(); setIdentityColumn(value); setOverrides({}); setExcluded([]); }} />
            <label>Test or game date<select value={dateMode} onChange={event => { invalidate(); setDateMode(event.target.value as "fixed" | "column"); }}><option value="fixed">One date for this file</option><option value="column">Read dates from a column</option></select></label>
            {dateMode === "fixed" ? <label>Date<input type="date" min="2026-09-01" max="2026-12-31" value={date} onChange={event => { invalidate(); setDate(event.target.value); }} /></label> : <><ColumnSelect label="Date column" headers={table.headers} value={dateColumn} onChange={value => { invalidate(); setDateColumn(value); }} /><label>Date format<select value={dateFormat} onChange={event => { invalidate(); setDateFormat(event.target.value as DateFormat); }}><option value="ISO">YYYY-MM-DD</option><option value="MDY">MM/DD/YYYY</option><option value="DMY">DD/MM/YYYY</option></select></label></>}
          </div>}
          {selectionError && <p role="alert" className="notice notice-error">{selectionError}</p>}
          {selection && <div className="my-5 rounded-lg border border-[var(--line-subtle)] p-4">
            <p className="m-0 font-semibold">{selection.includedIdentities.length} matched · {selection.skipped.length} skipped</p>
            <p className="muted mb-0 mt-2 text-sm">Choose No player / Skip for walk-ons or anyone you do not want included. Only matched roster players receive stats. Unmatched names are skipped automatically; they will not block the import. Recorded results against excluded opponents still count.</p>
            <details open className="mt-3"><summary className="cursor-pointer font-semibold">Player Matches · Include or Skip</summary><div className="mt-4 grid max-h-96 gap-4 overflow-y-auto md:grid-cols-2">{selection.players.map(player => <label key={player.identity} className="break-words">{player.identity || "Unnamed export player"}<span className="muted block text-xs">{player.included ? `Matched: ${athleteName(player.athlete!)}` : `Skipped · ${player.reason}`}</span><select value={excluded.includes(player.identity) ? "__exclude__" : overrides[player.identity] ?? ""} onChange={event => {
              invalidate(); const value = event.target.value;
              setExcluded(current => value === "__exclude__" ? [...current.filter(name => name !== player.identity), player.identity] : current.filter(name => name !== player.identity));
              setOverrides(current => { const next = { ...current }; if (value && value !== "__exclude__") next[player.identity] = value; else delete next[player.identity]; return next; });
            }}><option value="">Auto-match; skip if unmatched</option><option value="__exclude__">No player / Skip these stats</option>{roster.map(athlete => <option key={athlete.id} value={athlete.athlete_code}>{athleteName(athlete)} · {athlete.athlete_code}</option>)}</select></label>)}</div></details>
          </div>}
          {session ? <FullSwingSessionReview key={file.fileHash} session={session} resultContext={{ fileName: file.fileName, fileHash: file.fileHash, date: session.date, category: category === "game" ? "game" : category === "practice" ? "practice" : "intrasquad", matches: (selection?.players ?? []).filter(player => player.included).map(player => ({ identity: player.identity, athleteCode: player.athlete!.athlete_code })) }} saveResults={saveAction} includedIdentities={selection?.includedIdentities ?? []} fileHash={file.fileHash} assignmentStore={assignmentStore} /> : selection && <details className="mb-6 rounded-lg border border-[var(--line-subtle)] p-4"><summary className="cursor-pointer text-sm font-semibold">View Matched Summaries · {selection.table.rows.length} Rows</summary><div className="table-wrap mt-4 max-h-[32rem] overflow-auto"><table><thead><tr><th>Row</th>{table.headers.map((header, index) => <th key={index}>{header}</th>)}</tr></thead><tbody>{selection.table.rows.map((row, index) => <tr key={index}><td>{selection!.table.rowNumbers[index]}</td>{row.map((cell, column) => <td key={column}>{cell && !blast && metrics.some(metric => metric.column === column) && Number.isFinite(Number(cell)) ? formatSourceNumber(Number(cell), "Full Swing") : cell || "—"}</td>)}</tr>)}</tbody></table></div></details>}
          {session && <details className="mt-5"><summary className="cursor-pointer font-semibold">Measurement Sample Sizes</summary><div className="table-wrap mt-3"><table><thead><tr><th>Export Player</th><th>Role</th><th>Measurement</th><th>Recorded Readings</th><th>CSV Rows</th></tr></thead><tbody>{session.samples.filter(sample => selection?.includedIdentities.includes(sample.identity)).map((sample, i) => <tr key={i}><td>{sample.identity}</td><td>{sample.role}</td><td>{sample.metric}</td><td>{sample.count}</td><td className="max-w-64 break-words text-xs">{sample.sourceRows.join(", ")}</td></tr>)}</tbody></table></div></details>}
          <h3 className="mb-2 mt-7 font-bold">Measurements</h3>
          <p className="muted text-sm">{session ? "Calculated from this session in mph and feet." : "Match each column to a measurement and its original unit."}</p>
          <details className="mb-4 text-sm"><summary className="muted cursor-pointer font-medium">Measurement Help</summary><p className="muted mb-0 mt-3">Percentages use 0–100. Keep maximum and average readings separate. {definitions.some(item => item.key === "avg_fastball_spin") && "Average fastball spin must include only fastballs. "}{session ? "Maximums and arithmetic averages are calculated separately for each player from recorded events." : "Use values already calculated in the source file."}</p></details>
          {session ? <div className="grid gap-2 sm:grid-cols-2">{SESSION_METRICS.map(metric => <div key={metric.key} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line-subtle)] px-4 py-3 text-sm"><span className="font-semibold">{metric.label}</span><span className="muted">{metric.unit}</span></div>)}</div> : <fieldset><div className="space-y-4">{metrics.map((metric, index) => <div key={metric.id} className="grid items-end gap-3 rounded-lg border border-[var(--line-subtle)] p-4 md:grid-cols-[1fr_1fr_120px_44px]">
            <ColumnSelect label={`Data column ${index + 1}`} headers={table.headers} value={metric.column} onChange={value => { invalidate(); setMetrics(current => current.map(item => item.id === metric.id ? { ...item, column: value } : item)); }} />
            <label>Measurement<select value={metric.key} onChange={event => { invalidate(); setMetrics(current => current.map(item => item.id === metric.id ? { ...item, key: event.target.value, unit: "" } : item)); }}><option value="">Choose a measurement…</option>{definitions.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
            <label>Unit<select value={metric.unit} onChange={event => { invalidate(); setMetrics(current => current.map(item => item.id === metric.id ? { ...item, unit: event.target.value } : item)); }}><option value="">Choose…</option>{(definitions.find(item => item.key === metric.key)?.units ?? []).map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label>
            <button type="button" className="btn btn-secondary mb-px" aria-label={`Remove data column ${index + 1}`} disabled={metrics.length === 1} onClick={() => { invalidate(); setMetrics(current => current.filter(item => item.id !== metric.id)); }}><Trash2 size={16} /></button>
          </div>)}</div>
          <button type="button" className="btn btn-secondary mt-4" disabled={metrics.length >= definitions.length} onClick={() => { invalidate(); setMetrics(current => [...current, { id: nextId.current++, column: -1, key: "", unit: "" }]); }}><Plus size={16} />Add Measurement</button></fieldset>}
          <label className="my-6 flex items-start gap-3"><input type="checkbox" checked={summaryConfirmed} onChange={event => { invalidate(); setSummaryConfirmed(event.target.checked); }} /><span>{session ? "I confirm this export uses mph for speeds and feet for distance. I reviewed the calculated player summaries and have not already imported this session from another export." : "Each row contains one player’s reviewed session summaries. I am not labeling individual swings or pitches as an average or maximum."}</span></label>
          <button type="button" className="btn btn-primary" onClick={review}>Review Import</button>
        </>}
      </section>
      {reviewed && <section className="panel p-5 sm:p-7">
        <h2 className={styles.stepTitle}><span className={styles.stepNumber}>3.</span>{" "}Review and Save</h2>
        <p className={styles.sectionLead}>{reviewed.candidateMeasurements.length} {reviewed.candidateMeasurements.length === 1 ? "reading" : "readings"} · {vendor} · {FULL_SWING_LABELS[category]} · Fall 2026</p>
        {!!selection?.skipped.length && <p className="notice text-sm">{selection.skipped.length} unmatched or excluded export names will be skipped. Only the readings below will be saved.</p>}
        {!!reviewed.issues.length && <div role="alert" className="notice notice-error"><p className="font-semibold">Fix these rows before saving.</p><ul className="mb-0 list-disc pl-5">{reviewed.issues.slice(0, 30).map((issue, index) => <li key={index}>Row {issue.row}: {issue.message}</li>)}</ul>{reviewed.issues.length > 30 && <p>{reviewed.issues.length - 30} additional issues remain.</p>}</div>}
        <div className="table-wrap"><table><caption className="sr-only">All reviewed readings</caption><thead><tr><th>Player</th><th>Date</th><th>Measurement</th><th>Value</th><th>Source Row</th></tr></thead><tbody>{reviewed.candidateMeasurements.map(row => <tr key={row.id}><td><Link className="font-semibold underline underline-offset-2" prefetch={false} href={`/athletes/${roster.find(athlete => athlete.athlete_code === row.athlete_code)!.id}`}>{athleteName(roster.find(athlete => athlete.athlete_code === row.athlete_code)!)}</Link><span className="muted block text-xs">{row.athlete_code}</span></td><td className="whitespace-nowrap">{row.measured_at}</td><td>{row.metric}<StatInfo metric={row.metric} /></td><td className="whitespace-nowrap">{formatSourceNumber(row.value, row.source)} {row.unit}</td><td>{row.source_row}</td></tr>)}</tbody></table></div>
        <label className="my-5 flex items-start gap-3"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I checked every player match, date, measurement, and unit. Save these readings to the team’s private profiles.</span></label>
        <button type="button" className="btn btn-primary" disabled={!reviewed.canApply || !reviewed.candidateMeasurements.length || !confirmed} onClick={() => { void save(); }}><Check size={17} />Save to Player Profiles</button>
      </section>}
    </fieldset>}
    {error && <p role="alert" className="notice notice-error">{error}</p>}
    {receipt && <ImportConfirmation receipt={receipt} />}
  </div>;
}
