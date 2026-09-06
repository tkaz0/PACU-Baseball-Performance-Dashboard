"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, FileImage, LoaderCircle } from "lucide-react";
import { useLocalWorkspace } from "@/components/local-workspace";
import { athleteName } from "@/lib/types";
import { findRenphoAthlete, normalizeRenphoId, type MeasurementPreview } from "@/lib/imports/engine";
import { previewRenphoMeasurements } from "@/lib/imports/renpho-preview";
import { readRenphoReport } from "@/lib/imports/renpho-file";
import { FileDropZone } from "@/components/file-drop-zone";
import type { Measurement } from "@/lib/imports/engine";

type LoadedReport = Awaited<ReturnType<typeof readRenphoReport>>;
const message = (error: unknown) => error instanceof Error ? error.message : "The report could not be processed. Try a full-page PNG, JPG, or PDF.";

export function RenphoImport() {
  const workspace = useLocalWorkspace();
  return <RenphoReportForm workspace={workspace} />;
}

type RenphoWorkspace = Pick<ReturnType<typeof useLocalWorkspace>, "roster" | "measurements" | "revision" | "ready" | "error" | "applyRenphoReport">;
export function RenphoReportForm({ workspace, shared }: { workspace: RenphoWorkspace; shared?: {
  loadExisting: (fileHash: string) => Promise<Measurement[]>;
  profileHref: (athleteCode: string) => string;
  receipt: string;
} }) {
  const [report, setReport] = useState<LoadedReport | null>(null);
  const [athleteCode, setAthleteCode] = useState("");
  const [date, setDate] = useState("");
  const [renphoId, setRenphoId] = useState("");
  const [remember, setRemember] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<string[]>([]);
  const [confirmedUnits, setConfirmedUnits] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState<{ data: MeasurementPreview; revision: number } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [sharedExisting, setSharedExisting] = useState<Measurement[]>([]);
  const controller = useRef<AbortController | null>(null);
  const imageUrl = useRef("");
  useEffect(() => () => { controller.current?.abort(); if (imageUrl.current) URL.revokeObjectURL(imageUrl.current); }, []);
  const invalidate = () => { setReviewed(null); setConfirmed(false); setSaved(false); setError(""); };
  let matchingCode: string | null = null;
  let identityError = "";
  try { matchingCode = findRenphoAthlete(workspace.roster, renphoId); }
  catch (error) { identityError = message(error); }
  if (matchingCode && athleteCode && matchingCode !== athleteCode) identityError = "This RENPHO ID is already linked to another player. Check the player and ID before saving.";
  const stale = !!reviewed && reviewed.revision !== workspace.revision;
  const parserErrors = report?.parsed.issues.filter(issue => issue.severity === "error") ?? [];
  const canSave = !!reviewed && reviewed.data.canApply && reviewed.data.candidateMeasurements.length > 0 && confirmed && !stale && !identityError && !busy && workspace.ready && !workspace.error;

  async function chooseFile(file?: File) {
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    invalidate(); setReport(null); setSharedExisting([]); setAthleteCode(""); setDate(""); setRenphoId(""); setRemember(false); setExcluded([]); setConfirmedUnits([]); setValues({});
    if (imageUrl.current) { URL.revokeObjectURL(imageUrl.current); imageUrl.current = ""; }
    if (!file) { setBusy(""); return; }
    setBusy("Opening report…");
    try {
      const loaded = await readRenphoReport(file, progress => { if (!current.signal.aborted) setBusy(progress); }, current.signal);
      if (current.signal.aborted) { URL.revokeObjectURL(loaded.previewUrl); return; }
      imageUrl.current = loaded.previewUrl;
      if (shared) {
        setBusy("Checking saved readings…");
        const existing = await shared.loadExisting(loaded.fileHash);
        if (current.signal.aborted) return;
        setSharedExisting(existing);
      }
      setReport(loaded); setDate(loaded.parsed.reportedDate ?? "");
      const id = loaded.parsed.reportedIdentity?.value ?? "";
      setRenphoId(id); setAthleteCode(findRenphoAthlete(workspace.roster, id) ?? "");
      setValues(Object.fromEntries(loaded.parsed.candidateReadings.map(reading => [reading.key, reading.valueText])));
    } catch (error) { if (!current.signal.aborted) setError(message(error)); }
    finally { if (!current.signal.aborted) setBusy(""); }
  }

  function preview() {
    invalidate();
    if (!report) return;
    try {
      if (identityError) throw new Error(identityError);
      if (!athleteCode || !date) throw new Error("Choose the player and test date first.");
      if (remember && !renphoId.trim()) throw new Error("Enter the report ID before remembering its player.");
      const candidates = report.parsed.candidateReadings.filter(reading => !excluded.includes(reading.key)).map(reading => {
        const text = values[reading.key]?.trim() ?? "";
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || !Number.isFinite(Number(text))) throw new Error(`Check the number for ${reading.label}.`);
        return { ...reading, value: Number(text), valueText: text };
      });
      const data = previewRenphoMeasurements({ parsed: report.parsed, candidates, athleteCode, measuredAt: date, roster: workspace.roster, existing: shared ? sharedExisting : workspace.measurements, fileHash: report.fileHash, fileName: report.fileName, confirmedUnits });
      setReviewed({ data, revision: workspace.revision });
    } catch (error) { setError(message(error)); }
  }

  async function save() {
    if (!canSave || !reviewed || !report) return;
    setBusy("Saving readings…"); setError("");
    try {
      await workspace.applyRenphoReport(reviewed.data.candidateMeasurements, {
        id: crypto.randomUUID(), kind: "measurements", fileName: report.fileName, fileHash: report.fileHash,
        source: "RENPHO", importedAt: new Date().toISOString(), created: reviewed.data.counts.create,
        updated: reviewed.data.counts.update, unchanged: reviewed.data.counts.unchanged,
      }, reviewed.revision, { athleteCode, renphoId: normalizeRenphoId(renphoId), remember });
      if (shared) setSharedExisting(current => {
        const committed = new Map(current.map(reading => [reading.id, reading]));
        for (const reading of reviewed.data.candidateMeasurements) committed.set(reading.id, reading);
        return [...committed.values()];
      });
      setSaved(true); setReviewed(null); setConfirmed(false);
    } catch (error) { setError(message(error)); }
    finally { setBusy(""); }
  }

  return <div className="space-y-6">
    <section className="panel p-5 sm:p-7">
      <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><FileImage size={21} />1. Add a RENPHO report</h2>
      <p className="muted text-sm">Upload the full-page Body Composition Analysis Report as PNG, JPG, or a one-page PDF. Up to 10 MiB. Reading happens in your browser; the report is never uploaded.</p>
      <FileDropZone label="RENPHO Report" description="Drop one report here, or choose a file below." accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" disabled={!workspace.ready || !!workspace.error || !!busy} onFile={file => { void chooseFile(file); }} />
      {busy && <p role="status" className="mt-4 flex items-center gap-2 text-sm"><LoaderCircle className="animate-spin" size={18} />{busy}</p>}
      {error && <p role="alert" className="notice notice-error mt-4">{error}</p>}
      {!report && !busy && <p className="muted mb-0 mt-4 text-xs">The first report may take a minute while the reader loads. Use the complete report export, without cropping or camera perspective.</p>}
    </section>
    {report && <>
      <section className="panel p-5 sm:p-7">
        <h2 className="mb-2 text-lg font-bold">2. Confirm the player</h2>
        <p className="muted text-sm">An exact saved RENPHO ID can select a player. New IDs need your selection. Permanent athlete codes keep all measurements together.</p>
        <fieldset disabled={!!busy} className="grid min-w-0 gap-5 md:grid-cols-2">
          <label>RENPHO report ID<input value={renphoId} maxLength={80} onChange={event => { invalidate(); setRemember(false); const id = event.target.value; setRenphoId(id); try { setAthleteCode(findRenphoAthlete(workspace.roster, id) ?? ""); } catch { setAthleteCode(""); } }} /></label>
          <label>Player for this report<select value={athleteCode} onChange={event => { invalidate(); setAthleteCode(event.target.value); }}><option value="">Choose a player</option>{workspace.roster.map(athlete => <option key={athlete.athlete_code} value={athlete.athlete_code}>{athleteName(athlete)} · {athlete.athlete_code}</option>)}</select></label>
          <label>Report test date<input type="date" value={date} onChange={event => { invalidate(); setDate(event.target.value); }} /></label>
        </fieldset>
        {identityError ? <p role="alert" className="notice notice-error mt-4">{identityError}</p> : shared ? <p className="muted mb-0 mt-4 text-sm">Choose the player from the team roster for each report. Shared RENPHO ID matching will be connected when the roster IDs are available.</p> : matchingCode ? <p className="notice mt-4">Matched to a saved RENPHO ID. Confirm this is the correct player.</p> : <label className="mt-5 flex items-start gap-3"><input type="checkbox" checked={remember} disabled={!!busy || !renphoId.trim() || !athleteCode} onChange={event => { invalidate(); setRemember(event.target.checked); }} /><span>Remember this report ID for the selected player in this browser.</span></label>}
      </section>
      <section className="panel p-5 sm:p-7">
        <h2 className="mb-2 text-lg font-bold">3. Review the readings</h2>
        <p className="muted text-sm">Compare each value with the original. Correct any reading errors or uncheck a measurement to leave it out. Reference ranges, device targets, and body classifications are excluded.</p>
        <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.15fr]">
          <details className="rounded-lg border border-gray-200 p-4" open><summary className="cursor-pointer font-semibold">Original report</summary>
            {/* Local object URL; no optimization server receives the user's report. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={report.previewUrl} alt="Your uploaded RENPHO report for comparison" className="mt-4 h-auto w-full" />
          </details>
          <div className="min-w-0">
            {report.parsed.issues.filter(issue => issue.code === "mass_unit_ocr").map((issue, index) => <p className="notice mb-4 text-sm" key={index}>{issue.message}</p>)}
            {parserErrors.length > 0 && <div role="alert" className="notice notice-error mb-4"><p className="font-semibold">The reader needs a clearer or supported report before saving.</p><ul className="list-disc space-y-2 pl-5">{parserErrors.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul><p className="mb-0 mt-3">You can also use Other measurements with a CSV or XLSX export.</p></div>}
            <div className="table-wrap"><table><caption className="sr-only">Readings extracted from your RENPHO report</caption><thead><tr><th>Use</th><th>Measurement</th><th>Value</th><th>Unit</th></tr></thead><tbody>{report.parsed.candidateReadings.map(reading => <tr key={reading.key}>
              <td><input type="checkbox" aria-label={`Include ${reading.label}`} checked={!excluded.includes(reading.key)} disabled={!!busy} onChange={event => { invalidate(); setExcluded(current => event.target.checked ? current.filter(key => key !== reading.key) : [...current, reading.key]); }} /></td>
              <th scope="row" className="min-w-32">{reading.label}<details className="mt-1 text-xs font-normal text-gray-500"><summary className="cursor-pointer">Read from report</summary><p className="mb-0 mt-2">{reading.sourceText}</p></details></th>
              <td><input aria-label={`${reading.label} value`} className="min-w-20" inputMode="decimal" value={values[reading.key] ?? ""} disabled={!!busy || excluded.includes(reading.key)} onChange={event => { invalidate(); setValues(current => ({ ...current, [reading.key]: event.target.value })); }} /></td>
              <td className="text-sm">{reading.unit}{reading.unitNeedsConfirmation && <label className="mt-2 flex min-w-40 items-start gap-2 text-xs font-normal"><input type="checkbox" checked={confirmedUnits.includes(reading.key)} disabled={!!busy || excluded.includes(reading.key)} onChange={event => { invalidate(); setConfirmedUnits(current => event.target.checked ? [...current, reading.key] : current.filter(key => key !== reading.key)); }} /><span>Confirm {reading.label} unit is {reading.unit}. The small exponent was unreadable; check the original or leave this reading out.</span></label>}</td>
            </tr>)}</tbody></table></div>
            <p className="muted mt-3 text-xs">Mass units come from the report. BMI/SMI use kg/m²; visceral fat is a device index and waist-to-hip is a ratio. Values are not converted.</p>
            <button type="button" className="btn btn-primary mt-3" disabled={!!busy || parserErrors.length > 0 || !athleteCode || !date || !!identityError || !workspace.ready || !!workspace.error} onClick={preview}>Review import</button>
          </div>
        </div>
        {reviewed && <div className="mt-6 border-t border-gray-200 pt-6">
          <p role="status" className="font-semibold">{reviewed.data.candidateMeasurements.length} new readings ready</p>
          {reviewed.data.issues.map((issue, index) => <p role="alert" key={index} className="notice notice-error">{issue.message}</p>)}
          {!reviewed.data.candidateMeasurements.length && reviewed.data.canApply && <p className="notice">These readings are already imported. Nothing new will be saved.</p>}
          {stale && <p role="alert" className="notice">Your workspace changed. Review the import again before saving.</p>}
          <label className="my-5 flex items-start gap-3"><input type="checkbox" checked={confirmed} disabled={!!busy} onChange={event => setConfirmed(event.target.checked)} /><span>I checked the player, test date, units, and selected values against the original report.</span></label>
          <button type="button" className="btn btn-primary" disabled={!canSave} onClick={() => { void save(); }}><Check size={17} />Save RENPHO readings</button>
        </div>}
        {saved && <div role="status" className="notice notice-success mt-5">{shared ? shared.receipt : "Readings saved in this browser."} <Link className="font-semibold" href={shared ? shared.profileHref(athleteCode) : `/preview/athletes/${encodeURIComponent(athleteCode)}`}>Open player profile →</Link></div>}
      </section>
    </>}
  </div>;
}
