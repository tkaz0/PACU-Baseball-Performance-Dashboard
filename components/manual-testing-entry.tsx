"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Check, Plus, Search, Trash2 } from "lucide-react";
import { saveManualTesting } from "@/app/(workspace)/testing/entry/actions";
import { prepareManualTesting, type ManualTestingInput, type ManualTestingReview, type ManualTestingRow, type ManualTestingSaveResult } from "@/lib/manual-testing";
import { TESTING_CATEGORIES, isTestingEligible, testingMetrics, type TestingAthlete, type TestingCategory } from "@/lib/testing-checklist";
import { PLAYER_METRICS } from "@/lib/player-performance";
import { formatHeight } from "@/lib/measurement-display";
import { UUID_PATTERN } from "@/lib/types";

type EntryRow = ManualTestingRow & { category: TestingCategory };
function newRow(athlete?: TestingAthlete, key?: string, category: TestingCategory = "physicality"): EntryRow {
  const metric = PLAYER_METRICS.find(item => item.key === key && (!athlete || isTestingEligible(athlete, item.key)))
    ?? testingMetrics(category).find(item => !athlete || isTestingEligible(athlete, item.key))
    ?? PLAYER_METRICS.find(item => item.key === "weight")!;
  const group = TESTING_CATEGORIES.find(item => item.metricKeys.includes(metric.key))!.key;
  return { category: group, metricKey: metric.key, unit: metric.key === "height" ? "ft-in" : metric.units[0], value: "",
    ...(metric.key === "height" ? { feet: "", inches: "" } : {}) };
}
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Review the entry and try again.";
const testDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function ManualTestingEntry({ athletes, today, initialAthleteCode, initialMetricKey, saveAction = saveManualTesting }: {
  athletes: TestingAthlete[]; today: string; initialAthleteCode?: string; initialMetricKey?: string;
  saveAction?: (input: ManualTestingInput, confirmed: boolean) => Promise<ManualTestingSaveResult>;
}) {
  const initialAthlete = athletes.find(athlete => athlete.athleteCode === initialAthleteCode);
  const [athleteCode, setAthleteCode] = useState(initialAthlete?.athleteCode ?? "");
  const [query, setQuery] = useState(initialAthlete?.name ?? ""), [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const [testedOn, setTestedOn] = useState(today), [protocol, setProtocol] = useState("");
  const [rows, setRows] = useState<EntryRow[]>([newRow(initialAthlete, initialMetricKey)]);
  const [review, setReview] = useState<ManualTestingReview | null>(null), [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<ManualTestingSaveResult | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [attempted, setAttempted] = useState(false);
  const submission = useRef<string | null>(null), working = useRef(false), id = useId();
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (review) {
      reviewHeading.current?.focus({ preventScroll: true });
      reviewHeading.current?.scrollIntoView({ block: "nearest" });
    }
  }, [review]);
  const athlete = athletes.find(player => player.athleteCode === athleteCode);
  const matches = query.trim() ? athletes.filter(player => `${player.name} ${player.athleteCode}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];
  const expanded = open && !!query.trim() && !attempted;
  const locked = busy || attempted;
  const categories = TESTING_CATEGORIES.filter(category => testingMetrics(category.key).some(metric => !athlete || isTestingEligible(athlete, metric.key)));

  function invalidate() { setReview(null); setConfirmed(false); setResult(null); setError(""); }
  function selectAthlete(selected: TestingAthlete) {
    if (locked) return;
    invalidate(); setAthleteCode(selected.athleteCode); setQuery(selected.name); setOpen(false); setActive(-1);
    setRows([newRow(selected, initialMetricKey)]);
  }
  function updateRow(index: number, next: EntryRow) {
    if (locked) return;
    invalidate(); setRows(current => current.map((row, position) => position === index ? next : row));
  }
  async function reviewEntry() {
    if (working.current || attempted) return;
    setError(""); setResult(null); setConfirmed(false);
    if (!athlete) { setError("Choose a player from the suggestions."); return; }
    working.current = true; setBusy(true);
    try {
      submission.current ??= crypto.randomUUID();
      const input: ManualTestingInput = { submissionId: submission.current, athleteCode, testedOn, protocol,
        rows: rows.map(row => ({ metricKey: row.metricKey, unit: row.unit, value: row.value,
          ...(row.unit === "ft-in" ? { feet: row.feet, inches: row.inches } : {}) })) };
      setReview(await prepareManualTesting(input, athlete, today));
    } catch (failure) { setReview(null); setError(errorMessage(failure)); }
    finally { working.current = false; setBusy(false); }
  }
  async function saveEntry() {
    if (working.current || !review || !confirmed || result?.status === "saved") return;
    working.current = true; setBusy(true); setAttempted(true); setError("");
    try {
      const response = await saveAction(review.input, true);
      if (response?.status === "saved" && response.athleteId === review.athlete.id && UUID_PATTERN.test(response.receipt?.import_id)
        && Number.isSafeInteger(response.receipt.created) && response.receipt.created >= 0
        && Number.isSafeInteger(response.receipt.unchanged) && response.receipt.unchanged >= 0
        && response.receipt.created + response.receipt.unchanged === review.measurements.length) setResult(response);
      else if (response?.status === "invalid") { setResult(response); setAttempted(false); }
      else setResult({ status: "uncertain", error: "The save could not be confirmed. Check this player's profile, or retry this same reviewed entry." });
    } catch {
      setResult({ status: "uncertain", error: "The save could not be confirmed. Check this player's profile, or retry this same reviewed entry." });
    } finally { working.current = false; setBusy(false); }
  }
  function startAnother() {
    if (working.current || result?.status !== "saved") return;
    submission.current = null; setAttempted(false); invalidate(); setRows([newRow(athlete, rows[0]?.metricKey)]);
  }

  if (!athletes.length) return <section className="panel p-6"><h2 className="font-bold">No Players Available</h2><p className="muted mt-2 mb-0">The current roster needs an eligible player before testing can be entered.</p></section>;

  return <div className="space-y-6">
    <form className="panel space-y-6 p-5 sm:p-7" onSubmit={event => { event.preventDefault(); void reviewEntry(); }}>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
        <div className="relative min-w-0" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); } }}>
          <label htmlFor={`${id}-player`}>Player</label>
          <div className="relative"><Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input id={`${id}-player`} role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? `${id}-players` : undefined}
              aria-activedescendant={expanded && active >= 0 ? `${id}-player-${active}` : undefined} autoComplete="off" maxLength={100}
              className="!pl-9" placeholder="Find a player by name or PAC ID" value={query} disabled={locked}
              onFocus={() => setOpen(true)} onChange={event => { invalidate(); setQuery(event.target.value); setAthleteCode(""); setActive(-1); setOpen(true); }}
              onKeyDown={event => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Escape") { setOpen(false); setActive(-1); }
                if ((event.key === "ArrowDown" || event.key === "ArrowUp") && matches.length) {
                  event.preventDefault(); setOpen(true); setActive(current => event.key === "ArrowDown" ? (current + 1) % matches.length : (current <= 0 ? matches.length : current) - 1);
                }
                if (event.key === "Enter" && expanded) { event.preventDefault(); if (active >= 0 && matches[active]) selectAthlete(matches[active]); }
              }} />
          </div>
          {athlete && <p className="muted mt-2 mb-0 text-xs">{athlete.athleteCode}{athlete.jerseyNumber !== null ? ` · #${athlete.jerseyNumber}` : ""}</p>}
          {expanded && <div className="panel absolute z-40 mt-2 w-full overflow-hidden shadow-lg"><ul id={`${id}-players`} role="listbox" aria-label="Player suggestions" className="m-0 max-h-72 list-none overflow-y-auto p-1">
            {matches.map((player, index) => <li key={player.id} role="presentation"><button id={`${id}-player-${index}`} type="button" role="option" aria-selected={active === index} tabIndex={-1}
              className={`w-full rounded-lg px-3 py-3 text-left ${active === index ? "bg-[var(--surface-raised)]" : ""}`}
              onMouseDown={event => event.preventDefault()} onMouseMove={() => setActive(index)} onClick={() => selectAthlete(player)}>
              <span className="block text-sm font-semibold">{player.name}</span><span className="muted block text-xs">{player.athleteCode}{player.jerseyNumber !== null ? ` · #${player.jerseyNumber}` : ""}</span>
            </button></li>)}
          </ul>{!matches.length && <p className="muted m-0 px-4 py-3 text-sm">No matching players.</p>}</div>}
          <span className="sr-only" role="status">{expanded ? `${matches.length} player suggestions. Use the arrow keys and Enter to select a player.` : ""}</span>
        </div>
        <label>Test Date<input type="date" value={testedOn} min="2026-06-01" max={today < "2026-12-31" ? today : "2026-12-31"} disabled={locked}
          onChange={event => { invalidate(); setTestedOn(event.target.value); }} /></label>
      </div>
      <div><label>Testing Protocol / Device<input value={protocol} maxLength={80} placeholder="Name the protocol or device used" disabled={locked} aria-describedby={`${id}-protocol-help`}
        onChange={event => { invalidate(); setProtocol(event.target.value); }} /></label><p id={`${id}-protocol-help`} className="muted mt-2 mb-0 text-xs">Use the same protocol or device name each time you repeat this test.</p></div>
      <fieldset disabled={locked || !athlete} className="min-w-0 space-y-4">
        <legend className="mb-3 text-base font-bold">Measurements</legend>
        {rows.map((row, index) => {
          const available = testingMetrics(row.category).filter(metric => !athlete || isTestingEligible(athlete, metric.key));
          const metric = PLAYER_METRICS.find(item => item.key === row.metricKey)!;
          return <div key={index} className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3"><h3 className="m-0 text-sm font-bold">Measurement {index + 1}</h3>{rows.length > 1 && <button type="button" className="btn btn-secondary !min-h-8 !px-2 !py-1" aria-label={`Remove measurement ${index + 1}`} onClick={() => { invalidate(); setRows(current => current.filter((_, position) => position !== index)); }}><Trash2 size={14} aria-hidden="true" /></button>}</div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label>Category {index + 1}<select value={row.category} onChange={event => updateRow(index, newRow(athlete, undefined, event.target.value as TestingCategory))}>{categories.map(category => <option key={category.key} value={category.key}>{category.label}</option>)}</select></label>
              <label>Measurement {index + 1}<select value={row.metricKey} onChange={event => updateRow(index, newRow(athlete, event.target.value))}>
                {available.map(option => <option key={option.key} value={option.key} disabled={rows.some((other, position) => position !== index && other.metricKey === option.key)}>{option.label}</option>)}
              </select></label>
              <label>Unit {index + 1}<select value={row.unit} onChange={event => updateRow(index, { category: row.category, metricKey: row.metricKey, unit: event.target.value, value: "", ...(event.target.value === "ft-in" ? { feet: "", inches: "" } : {}) })}>
                {metric.key === "height" && <option value="ft-in">Feet &amp; Inches</option>}{metric.units.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              </select></label>
              {row.unit === "ft-in" ? <div className="grid grid-cols-2 gap-3"><label>Feet {index + 1}<input inputMode="numeric" value={row.feet ?? ""} maxLength={10} onChange={event => updateRow(index, { ...row, feet: event.target.value })} /></label><label>Inches {index + 1}<input inputMode="decimal" value={row.inches ?? ""} maxLength={10} onChange={event => updateRow(index, { ...row, inches: event.target.value })} /></label></div>
                : <label>Value {index + 1}<input inputMode="decimal" value={row.value} maxLength={40} placeholder="Enter result" onChange={event => updateRow(index, { ...row, value: event.target.value })} /></label>}
            </div>
          </div>;
        })}
        <button type="button" className="btn btn-secondary" disabled={rows.length >= PLAYER_METRICS.filter(metric => athlete && isTestingEligible(athlete, metric.key)).length} onClick={() => {
          const next = PLAYER_METRICS.find(metric => athlete && isTestingEligible(athlete, metric.key) && !rows.some(row => row.metricKey === metric.key));
          if (next) { invalidate(); setRows(current => [...current, newRow(athlete, next.key)]); }
        }}><Plus size={16} aria-hidden="true" />Add Measurement</button>
      </fieldset>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {!attempted && <button type="submit" className="btn btn-primary" disabled={busy}>Review Entry</button>}
      {busy && <p className="muted mb-0 text-sm" role="status">{attempted ? "Saving reviewed measurements…" : "Preparing your review…"}</p>}
    </form>

    {review && <section className="panel p-5 sm:p-7" aria-labelledby={`${id}-review`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow text-pacu-red">Review</p><h2 id={`${id}-review`} ref={reviewHeading} tabIndex={-1} className="m-0 text-xl font-bold">{review.athlete.name}</h2><p className="muted mt-2 mb-0 text-sm">{review.athlete.athleteCode} · {testDate(review.input.testedOn)}</p></div><span className="badge">Manual Entry</span></div>
      <dl className="divide-y divide-[var(--line-subtle)]">{review.measurements.map(reading => <div key={reading.id} className="flex items-baseline justify-between gap-4 py-3"><dt className="text-sm">{reading.metric}</dt><dd className="m-0 text-right font-bold">{reading.metric === "Height" ? formatHeight(reading.value, reading.unit) ?? `${reading.value} ${reading.unit}` : `${reading.value} ${reading.unit}`}{reading.metric === "Height" && <span className="muted ml-2 text-xs font-normal">({reading.value} {reading.unit})</span>}</dd></div>)}</dl>
      <p className="muted mt-4 text-sm">Protocol: {review.input.protocol}</p>
      {result?.status !== "saved" && <><label className="my-5 flex items-start gap-3"><input type="checkbox" checked={confirmed} disabled={busy || attempted} onChange={event => setConfirmed(event.target.checked)} /><span>I checked the player, test date, values, and units.</span></label>
        <button type="button" className="btn btn-primary" disabled={!confirmed || busy} onClick={() => { void saveEntry(); }}><Check size={16} aria-hidden="true" />{result?.status === "uncertain" ? "Retry Same Entry" : "Save Measurements"}</button></>}
      {result?.status === "invalid" && <p role="alert" className="notice notice-error mt-4">{result.error}</p>}
      {result?.status === "uncertain" && <div role="alert" className="notice mt-4"><p className="mb-2">{result.error}</p><Link href={`/athletes/${review.athlete.id}`} className="font-semibold" target="_blank" rel="noreferrer">Check Player Profile</Link></div>}
      {result?.status === "saved" && <div className="notice notice-success mt-5" role="status"><p className="mb-3">Measurements saved. {result.receipt.created} new · {result.receipt.unchanged} already recorded.</p><div className="flex flex-wrap gap-3"><Link className="btn btn-primary" href={`/athletes/${result.athleteId}`}>Open Player Profile</Link><button type="button" className="btn btn-secondary" onClick={startAnother}>Enter Another Test</button><Link className="btn btn-secondary" href="/testing">Testing Checklist</Link></div></div>}
    </section>}
  </div>;
}
