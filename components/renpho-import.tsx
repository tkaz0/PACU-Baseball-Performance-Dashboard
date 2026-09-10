"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import styles from "./import-presentation.module.css";
import { useLocalWorkspace } from "@/components/local-workspace";
import { athleteName } from "@/lib/types";
import { findRenphoAthlete, normalizeRenphoId, type MeasurementPreview } from "@/lib/imports/engine";
import { previewRenphoMeasurements, renphoReviewIssues } from "@/lib/imports/renpho-preview";
import { withReviewedRenphoBodyScore } from "@/lib/imports/renpho";
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
  matchPlayer: (reportId: string) => Promise<string | null>;
  profileHref: (athleteCode: string) => string;
  receipt: string;
} }) {
  const [report, setReport] = useState<LoadedReport | null>(null);
  const [athleteCode, setAthleteCode] = useState("");
  const [date, setDate] = useState("");
  const [renphoId, setRenphoId] = useState("");
  const [remember, setRemember] = useState(false);
  const [manualBodyScore, setManualBodyScore] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<string[]>([]);
  const [confirmedUnits, setConfirmedUnits] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState<{ data: MeasurementPreview; revision: number } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [sharedExisting, setSharedExisting] = useState<Measurement[]>([]);
  const [sharedMatch, setSharedMatch] = useState<{ id: string; code: string | null } | null>(null);
  const [matchError, setMatchError] = useState("");
  const [matching, setMatching] = useState(false);
  const matchRequest = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const imageUrl = useRef("");
  useEffect(() => () => { controller.current?.abort(); if (imageUrl.current) URL.revokeObjectURL(imageUrl.current); }, []);
  const invalidate = () => { setReviewed(null); setConfirmed(false); setSaved(false); setError(""); };
  let matchingCode: string | null = null;
  let identityError = "";
  try { matchingCode = shared ? (sharedMatch?.id === normalizeRenphoId(renphoId) ? sharedMatch.code : null) : findRenphoAthlete(workspace.roster, renphoId); }
  catch (error) { identityError = message(error); }
  if (shared && matchError) identityError = matchError;
  const matchPending = !!shared && !!renphoId.trim() && sharedMatch?.id !== normalizeRenphoId(renphoId);
  if (matchingCode && athleteCode && matchingCode !== athleteCode) identityError = "This RENPHO ID is already linked to another player. Check the player and ID before saving.";
  const stale = !!reviewed && reviewed.revision !== workspace.revision;
  const reportIssues = report ? renphoReviewIssues(report.parsed, report.parsed.candidateReadings.filter(reading => !excluded.includes(reading.key))) : { blocking: [], omitted: [] };
  const parserErrors = reportIssues.blocking;
  const omittedMetrics = [...new Set(reportIssues.omitted.map(issue => issue.metric!))];
  const canSave = !!reviewed && reviewed.data.canApply && reviewed.data.candidateMeasurements.length > 0 && confirmed && !stale && !identityError && !busy && !matching && !matchPending && workspace.ready && !workspace.error;

  async function matchSharedPlayer(id: string) {
    if (!shared) return;
    const request = ++matchRequest.current;
    const normalized = normalizeRenphoId(id);
    setMatchError(""); setMatching(true);
    try {
      const code = normalized ? await shared.matchPlayer(normalized) : null;
      if (request !== matchRequest.current) return;
      if (code && !workspace.roster.some(athlete => athlete.athlete_code === code)) throw new Error("This ID belongs to a player outside the loaded roster. Refresh before importing.");
      setSharedMatch({ id: normalized, code }); setAthleteCode(code ?? "");
    } catch (error) {
      if (request === matchRequest.current) { setSharedMatch(null); setAthleteCode(""); setMatchError(message(error)); }
    } finally { if (request === matchRequest.current) setMatching(false); }
  }

  async function chooseFile(file?: File) {
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    invalidate(); setManualBodyScore(""); setReport(null); setSharedExisting([]); setAthleteCode(""); setDate(""); setRenphoId(""); setRemember(false); setExcluded([]); setConfirmedUnits([]); setValues({});
    matchRequest.current++; setSharedMatch(null); setMatchError(""); setMatching(false);
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
      setRenphoId(id);
      if (shared) await matchSharedPlayer(id);
      else setAthleteCode(findRenphoAthlete(workspace.roster, id) ?? "");
      setValues(Object.fromEntries(loaded.parsed.candidateReadings.map(reading => [reading.key, reading.valueText])));
    } catch (error) { if (!current.signal.aborted) setError(message(error)); }
    finally { if (!current.signal.aborted) setBusy(""); }
  }

  function preview() {
    invalidate();
    if (!report) return;
    try {
      if (identityError) throw new Error(identityError);
      if (matching || matchPending) throw new Error("Check the RENPHO ID to finish matching this report.");
      if (!athleteCode || !date) throw new Error("Choose the player and test date first.");
      if (remember && !renphoId.trim()) throw new Error("Enter the report ID before remembering its player.");
      const parsed = withReviewedRenphoBodyScore(report.parsed, manualBodyScore);
      const candidates = parsed.candidateReadings.filter(reading => !excluded.includes(reading.key)).map(reading => {
        const text = reading.unitEvidence === "manual-report" ? reading.valueText : values[reading.key]?.trim() ?? "";
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || !Number.isFinite(Number(text))) throw new Error(`Check the number for ${reading.label}.`);
        return { ...reading, value: Number(text), valueText: text };
      });
      const data = previewRenphoMeasurements({ parsed, candidates, athleteCode, measuredAt: date, roster: workspace.roster, existing: shared ? sharedExisting : workspace.measurements, fileHash: report.fileHash, fileName: report.fileName, confirmedUnits });
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
    <section className={`panel p-5 sm:p-7 ${styles.uploadPanel}`}>
      <h2 className={styles.stepTitle}><span className={styles.stepNumber}>1.</span>{" "}Add a RENPHO Report</h2>
      <FileDropZone label="RENPHO Report" description="Drop one full-page PNG, JPG, or single-page PDF here." accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" disabled={!workspace.ready || !!workspace.error || !!busy} onFile={file => { void chooseFile(file); }} />
      {busy && <p role="status" className={styles.progress}><LoaderCircle className="animate-spin" size={18} />{busy}</p>}
      {error && <p role="alert" className="notice notice-error mt-4">{error}</p>}
      <details className={styles.help}><summary>Report Requirements</summary><div className="mt-3 space-y-3"><p className="muted mb-0 text-sm">Use the full-page Body Composition Analysis Report, up to 10 MiB. Keep the export uncropped and straight.</p><p className="muted mb-0 text-sm">The first report may take a minute to read. The image stays in your browser; only readings you review and approve are saved.</p></div></details>
    </section>
    {report && <>
      <section className="panel p-5 sm:p-7">
        <h2 className={styles.stepTitle}><span className={styles.stepNumber}>2.</span>{" "}Confirm the Player</h2>
        <p className={styles.sectionLead}>{shared ? "The report ID selects the player. Check the name and printed test date." : "Select the player and check the printed test date."}</p>
        <fieldset disabled={!!busy} className="grid min-w-0 gap-5 md:grid-cols-2">
          <label>RENPHO report ID<input value={renphoId} maxLength={80} onBlur={() => { if (shared && matchPending) void matchSharedPlayer(renphoId); }} onChange={event => { invalidate(); setRemember(false); const id = event.target.value; setRenphoId(id); if (shared) { matchRequest.current++; setSharedMatch(null); setMatchError(""); setMatching(false); setAthleteCode(""); } else { try { setAthleteCode(findRenphoAthlete(workspace.roster, id) ?? ""); } catch { setAthleteCode(""); } } }} /></label>
          <label>Player for this report<select value={athleteCode} disabled={matching || (shared && (!!matchingCode || matchPending))} onChange={event => { invalidate(); setAthleteCode(event.target.value); }}><option value="">Choose a player</option>{workspace.roster.map(athlete => <option key={athlete.athlete_code} value={athlete.athlete_code}>{athleteName(athlete)} · {athlete.athlete_code}</option>)}</select></label>
          <label>Report test date<input type="date" value={date} onChange={event => { invalidate(); setDate(event.target.value); }} /></label>
        </fieldset>
        {shared && (matching ? <p role="status" className="muted mt-4 text-sm">Finding the player…</p> : matchingCode ? <p role="status" className="notice notice-success mt-4">Matched: <Link href={shared.profileHref(matchingCode)} className="font-semibold underline underline-offset-2" prefetch={false}>{athleteName(workspace.roster.find(athlete => athlete.athlete_code === matchingCode)!)}</Link>. Confirm this is the correct player.</p> : matchPending ? <button type="button" className="btn btn-secondary mt-4" disabled={!!busy} onClick={() => { invalidate(); void matchSharedPlayer(renphoId); }}>Check RENPHO ID</button> : <p className="notice mt-4">No roster ID match yet. Choose the player for this report.</p>)}
        {identityError ? <p role="alert" className="notice notice-error mt-4">{identityError}</p> : !shared && (matchingCode ? <p className="notice mt-4">Matched to a saved RENPHO ID. Confirm this is the correct player.</p> : <label className="mt-5 flex items-start gap-3"><input type="checkbox" checked={remember} disabled={!!busy || !renphoId.trim() || !athleteCode} onChange={event => { invalidate(); setRemember(event.target.checked); }} /><span>Remember this report ID for the selected player in this browser.</span></label>)}
      </section>
      <section className="panel p-5 sm:p-7">
        <h2 className={styles.stepTitle}><span className={styles.stepNumber}>3.</span>{" "}Review the Readings</h2>
        <p className={styles.sectionLead}>Check each value against the original. Correct a reading or uncheck it to leave it out.</p>
        <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.15fr]">
          <details className={styles.sourceReport} open><summary>Original Report</summary>
            {/* Local object URL; no optimization server receives the user's report. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={report.previewUrl} alt="Your uploaded RENPHO report for comparison" className="mt-4 h-auto w-full" />
          </details>
          <div className="min-w-0">
            {report.parsed.issues.filter(issue => ["mass_unit_ocr", "smi_unit_ocr", "percentage_ocr_reread", "height_unreadable", "height_ambiguous", "body_score_unreadable"].includes(issue.code)).map((issue, index) => <p className="notice mb-4 text-sm" key={index}>{issue.message}</p>)}
            {omittedMetrics.length > 0 && <p role="status" className="notice mb-4 text-sm"><strong>Left out: {omittedMetrics.join(", ")}.</strong>{" "}These readings could not be read clearly. You can still review and save the selected readings below.</p>}
            {parserErrors.length > 0 && <div role="alert" className="notice notice-error mb-4">
              <p className="font-semibold">Some report details could not be read.</p>
              <ul className="list-disc space-y-2 pl-5">{parserErrors.map((issue, index) => <li key={index}>{issue.metric && <strong>{issue.metric}: </strong>}{issue.message}</li>)}</ul>
              <p className="mb-0 mt-3">{report.parsed.recognizedLayout ? "Uncheck an affected reading to leave it out. If the error remains, upload a fresh full-page report." : "Upload a fresh full-page PNG, JPG, or PDF so the report layout, ID, date and units can be checked."}</p>
            </div>}
            <div className="table-wrap"><table><caption className="sr-only">Readings extracted from your RENPHO report</caption><thead><tr><th>Use</th><th>Measurement</th><th>Value</th><th>Unit</th></tr></thead><tbody>{report.parsed.candidateReadings.map(reading => <tr key={reading.key}>
              <td><input type="checkbox" aria-label={`Include ${reading.label}`} checked={!excluded.includes(reading.key)} disabled={!!busy} onChange={event => { invalidate(); setExcluded(current => event.target.checked ? current.filter(key => key !== reading.key) : [...current, reading.key]); }} /></td>
              <th scope="row" className="min-w-32">{reading.label}<details className="mt-1 text-xs font-normal text-gray-500"><summary className="cursor-pointer">Read from report</summary><p className="mb-0 mt-2">{reading.sourceText}</p></details></th>
              <td><input aria-label={`${reading.label} value`} className="min-w-20" inputMode="decimal" value={values[reading.key] ?? ""} disabled={!!busy || excluded.includes(reading.key)} onChange={event => { invalidate(); setValues(current => ({ ...current, [reading.key]: event.target.value })); }} /></td>
              <td className="text-sm">{reading.unit}{reading.unitNeedsConfirmation && <label className="mt-2 flex min-w-40 items-start gap-2 text-xs font-normal"><input type="checkbox" checked={confirmedUnits.includes(reading.key)} disabled={!!busy || excluded.includes(reading.key)} onChange={event => { invalidate(); setConfirmedUnits(current => event.target.checked ? [...current, reading.key] : current.filter(key => key !== reading.key)); }} /><span>Confirm {reading.label} unit is {reading.unit}. The small exponent was unreadable; check the original or leave this reading out.</span></label>}</td>
            </tr>)}</tbody></table></div>
            {report.parsed.recognizedLayout && !report.parsed.candidateReadings.some(reading => reading.key === "body_score") && <label className="mt-4 block text-sm">Body Score — Top Right of Report <span className="muted">(optional)</span><input inputMode="decimal" placeholder="Enter the printed score" value={manualBodyScore} disabled={!!busy} onChange={event => { invalidate(); setManualBodyScore(event.target.value); }} /><span className="muted text-xs">Points on the report’s /100 scale. Leave blank to save the other readings.</span></label>}
            <details className="mt-3 text-sm"><summary className="muted cursor-pointer font-medium">About These Readings</summary><p className="muted mb-0 mt-3 text-xs">Units stay as printed. BMI/SMI use kg/m²; visceral fat is a device index and waist-to-hip is a ratio. Reference ranges, device targets, and body classifications are excluded.</p></details>
            <button type="button" className="btn btn-primary mt-3" disabled={!!busy || matching || matchPending || parserErrors.length > 0 || !athleteCode || !date || !!identityError || !workspace.ready || !!workspace.error} onClick={preview}>Review import</button>
          </div>
        </div>
        {reviewed && <div className={styles.saveReview}>
          <p role="status" className="font-semibold">{reviewed.data.candidateMeasurements.length} new readings ready</p>
          {omittedMetrics.length > 0 && <p className="muted text-sm">Not included: {omittedMetrics.join(", ")}.</p>}
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
