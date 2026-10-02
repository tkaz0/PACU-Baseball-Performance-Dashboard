"use client";

import { useId, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarRange, Minus } from "lucide-react";
import { StatInfo } from "@/components/stat-info";
import { formatHeight } from "@/lib/measurement-display";
import { pitchSourceLabel } from "@/lib/pitch-display";
import { defaultTrainingBlocks, summarizeTrainingBlock, trainingBlockChange, trainingBlockWindowError, type TrainingBlockSeries, type TrainingBlockSummary, type TrainingBlockWindow } from "@/lib/training-blocks";
import styles from "./training-block-comparison.module.css";

const categories: TrainingBlockSeries["category"][] = ["Practice", "In-Game", "Physicality", "Athletic Testing"];
const day = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const period = (window: TrainingBlockWindow) => window.start === window.end ? day(window.start) : `${day(window.start)} – ${day(window.end)}`;
const unit = (value: string) => ({ deg: "°", rpm: "RPM", points: "pts" }[value] ?? value);
const number = (value: number, series: TrainingBlockSeries) => value.toFixed(series.unit === "s" ? 2 : 1);
const result = (value: number | null, series: TrainingBlockSeries) => value === null ? "—" : series.metricKey === "height" ? formatHeight(value, series.unit) ?? `${number(value, series)}${series.unit === "deg" ? "" : " "}${unit(series.unit)}` : `${number(value, series)} ${unit(series.unit)}`;
const methodLabel = { weighted: "Weighted Average", maximum: "Best Result", fastest: "Best Time", latest: "Latest Test" } as const;
const issues: Record<NonNullable<TrainingBlockSummary["issue"]>, string> = {
  empty: "No results in this block",
  partial_report: "Include the full weekly report dates",
  overlapping_reports: "Overlapping reports need review",
  conflict: "Conflicting readings need review",
  missing_counts: "Average needs recorded sample counts",
  missing_results: "A weekly report is missing this result",
};

function ComparisonBars({ series, a, b }: { series: TrainingBlockSeries; a: TrainingBlockSummary; b: TrainingBlockSummary }) {
  if (a.value === null && b.value === null) return null;
  const values = [a.value, b.value].filter((value): value is number => value !== null);
  const low = Math.min(0, ...values), high = Math.max(0, ...values), span = high - low || 1;
  const x = (value: number) => 20 + (value - low) / span * 280;
  const zero = x(0);
  return <svg viewBox="0 0 320 54" className={styles.bars} role="img" aria-label={`${series.label}. Block 1: ${result(a.value, series)}. Block 2: ${result(b.value, series)}. Bars share a zero baseline.`}>
    <line x1={zero} x2={zero} y1="2" y2="52" stroke="var(--line-strong, var(--line-subtle))" />
    {[a, b].map((summary, index) => summary.value === null ? null : <rect key={index} x={Math.min(zero, x(summary.value))} y={index * 27 + 4} width={Math.max(Math.abs(x(summary.value) - zero), 1)} height="17" rx="4" fill={index ? "var(--text-primary)" : "var(--text-secondary)"} fillOpacity={index ? 0.85 : 0.45} opacity={index ? 1 : .65} />)}
  </svg>;
}

function Summary({ label, series, value }: { label: string; series: TrainingBlockSeries; value: TrainingBlockSummary }) {
  return <div className={styles.summary}>
    <span className={styles.blockLabel}>{label}</span>
    <strong className={styles.value}>{result(value.value, series)}</strong>
    {value.issue ? <span className={styles.missing}>{issues[value.issue]}</span> : <>
      <span className={styles.samples}>{value.samples === null ? "Sample count unavailable" : `${value.samples.toLocaleString()} ${series.sampleLabel}`} · {value.sessions} {value.sessions === 1 ? "session" : "sessions"}</span>
      {series.method === "fastest" && value.average !== null && <span className={styles.samples}>Average {result(value.average, series)}</span>}
      {value.firstDate && value.lastDate && <span className={styles.dates}>{series.method === "latest" ? `Tested ${day(value.lastDate)}` : period({ start: value.firstDate, end: value.lastDate })}</span>}
    </>}
  </div>;
}

function MetricComparison({ series, windows }: { series: TrainingBlockSeries; windows: [TrainingBlockWindow, TrainingBlockWindow] }) {
  const a = summarizeTrainingBlock(series, windows[0]), b = summarizeTrainingBlock(series, windows[1]);
  const change = trainingBlockChange(series, a, b);
  const DeltaIcon = change?.delta ? change.delta > 0 ? ArrowUpRight : ArrowDownRight : Minus;
  return <article className={styles.card}>
    <div className={styles.cardHeading}><h4>{series.label}<StatInfo metric={series.metricKey} label={series.label} source={series.source === "Blast Motion · Weekly Average" ? "blast_fall" : series.source} unit={series.unit} period="fall_2026"/></h4><span className={styles.method}>{methodLabel[series.method]}</span></div>
    <ComparisonBars series={series} a={a} b={b}/>
    <div className={styles.results}><Summary label="Block 1" series={series} value={a}/><Summary label="Block 2" series={series} value={b}/></div>
    <div className={styles.change} data-tone={change?.tone ?? "neutral"}>
      <DeltaIcon size={16} aria-hidden="true"/>
      {change ? <><strong>{change.delta > 0 ? "+" : change.delta < 0 ? "−" : ""}{number(Math.abs(change.delta), series)}{series.unit === "deg" ? "" : " "}{unit(series.unit)}</strong><span>{change.delta === 0 ? "No change" : change.tone === "improved" ? "Improved" : change.tone === "decreased" ? series.direction === "lower" ? "Slower" : "Lower" : "Change"}</span></> : <span>Two complete blocks show the change</span>}
    </div>
  </article>;
}

/** Expects the existing authorized profile's numerical display projection. */
export function TrainingBlockComparison({ series }: { series: TrainingBlockSeries[] }) {
  const id = useId();
  const available = categories.filter(category => series.some(item => item.category === category));
  const [category, setCategory] = useState(available[0] ?? "Practice");
  const [source, setSource] = useState("");
  const [windows, setWindows] = useState<[TrainingBlockWindow, TrainingBlockWindow]>(() => defaultTrainingBlocks(series));
  const [expanded, setExpanded] = useState(false);
  const selectedCategory = available.includes(category) ? category : available[0];
  const sources = [...new Set(series.filter(item => item.category === selectedCategory).map(item => item.source))];
  const selectedSource = sources.includes(source) ? source : sources[0];
  const selected = series.filter(item => item.category === selectedCategory && item.source === selectedSource);
  const error = trainingBlockWindowError(...windows);
  if (!series.length) return null;
  const editWindow = (index: 0 | 1, key: keyof TrainingBlockWindow, value: string) => setWindows(current => current.map((window, position) => position === index ? { ...window, [key]: value } : window) as [TrainingBlockWindow, TrainingBlockWindow]);
  return <section className={styles.section} aria-labelledby={`${id}-title`}>
    <header className={styles.header}><div><span className={styles.eyebrow}><CalendarRange size={15} aria-hidden="true"/> Fall Development</span><h2 id={`${id}-title`}>Compare Training Blocks</h2><p>How results changed between two parts of the fall.</p></div><span className={styles.legend}><i aria-hidden="true"/>Block 1 <i aria-hidden="true"/>Block 2</span></header>
    <div className={styles.windows}>{windows.map((window, index) => <fieldset key={index} className={styles.window}><legend>Block {index + 1}</legend><label htmlFor={`${id}-${index}-from`}>From<input type="date" id={`${id}-${index}-from`} value={window.start} min="2026-09-01" max="2026-12-31" onChange={event => editWindow(index as 0 | 1, "start", event.target.value)} /></label><label htmlFor={`${id}-${index}-to`}>Through<input type="date" id={`${id}-${index}-to`} value={window.end} min="2026-09-01" max="2026-12-31" onChange={event => editWindow(index as 0 | 1, "end", event.target.value)} /></label></fieldset>)}</div>
    <div className={styles.controls}><label htmlFor={`${id}-category`}>Category<select id={`${id}-category`} value={selectedCategory} onChange={event => { setCategory(event.target.value as TrainingBlockSeries["category"]); setExpanded(false); }}>{available.map(item => <option key={item}>{item}</option>)}</select></label><label htmlFor={`${id}-source`}>Results<select id={`${id}-source`} value={selectedSource} onChange={event => { setSource(event.target.value); setExpanded(false); }}>{sources.map(item => <option key={item} value={item}>{pitchSourceLabel(item)}</option>)}</select></label></div>
    {error ? <p className={styles.error} role="status">{error}</p> : <div className={styles.grid}>{(expanded ? selected : selected.slice(0, 4)).map(item => <MetricComparison key={item.id} series={item} windows={windows}/>)}</div>}
    {!error && selected.length > 4 && <button type="button" className={styles.expand} onClick={() => setExpanded(value => !value)}>{expanded ? "Show Main Results" : `Show All ${selected.length} Results`}</button>}
    <details className={styles.help}><summary>How this comparison works</summary><p>Each card compares the same measurement, device, and setting. Session averages use their recorded swing or pitch counts. Best results use the highest reading; timed tests use the fastest trial and show the average below. Physicality uses the latest test in each block.</p><p>Weekly Blast reports must fit entirely inside a block. Missing counts, overlapping reports, and conflicting readings stay flagged. Weekly 95th percentiles and cumulative game-sheet totals are not combined into blocks. Changes describe these recorded samples; they do not prove that a drill or adjustment caused the result.</p></details>
  </section>;
}
