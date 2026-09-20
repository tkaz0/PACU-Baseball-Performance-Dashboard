import type { Measurement } from "@/lib/imports/engine";

export type BlastSummaryKind = "average" | "p95";
export type BlastMetric = { column: number; header: string; key: string; label: string; unit: string; signed?: boolean; description: string };
/** Exact supplied Blast Performance export; positions are original CSV columns. */
export const BLAST_REPORT_METRICS: readonly BlastMetric[] = [
  { column: 2, header: "Swing Count", key: "blast_swing_count", label: "Blast Swing Count", unit: "count", description: "Swings included in this weekly export. The average and 95th-percentile files describe the same swings; their counts are not added together." },
  { column: 3, header: "Bat Speed (MPH)", key: "avg_bat_speed", label: "Average Bat Speed", unit: "mph", description: "Bat speed reported by Blast. Average and 95th-percentile summaries remain separate; the 95th percentile is not a maximum." },
  { column: 4, header: "Peak Hand Speed (MPH)", key: "blast_peak_hand_speed", label: "Peak Hand Speed", unit: "mph", description: "Blast’s peak hand-speed measurement for a swing. This table shows the weekly average or 95th percentile of that measurement, according to the export." },
  { column: 5, header: "Rotational Acceleration (G's)", key: "blast_rotational_acceleration", label: "Rotational Acceleration", unit: "g", description: "Blast’s rotational acceleration measurement in Gs, summarized by the selected report." },
  { column: 6, header: "Power (kW)", key: "blast_power", label: "Swing Power", unit: "kw", description: "Power reported by Blast in kilowatts. The dashboard preserves the vendor’s calculation." },
  { column: 7, header: "On Plane Efficiency (%)", key: "blast_on_plane_efficiency", label: "On-Plane Efficiency", unit: "%", description: "Blast’s on-plane efficiency percentage for the included swings. Average and 95th-percentile reports are shown separately." },
  { column: 8, header: "Attack Angle (°'s)", key: "blast_attack_angle", label: "Attack Angle", unit: "deg", signed: true, description: "Blast’s recorded attack angle, in degrees. The original sign is preserved; a larger angle is not automatically better." },
  { column: 9, header: "Vert. Bat Angle (°'s)", key: "blast_vertical_bat_angle", label: "Vertical Bat Angle", unit: "deg", signed: true, description: "Blast’s vertical bat angle, in degrees. Negative readings are valid and are kept as reported." },
  { column: 10, header: "Time to Contact (s)", key: "blast_time_to_contact", label: "Time to Contact", unit: "s", description: "Blast’s time-to-contact measurement in seconds. The 95th percentile describes the upper end of recorded times, not the fastest time." },
  { column: 11, header: "Commit Time (s)", key: "blast_commit_time", label: "Commit Time", unit: "s", description: "Commit time reported by Blast, in seconds. The dashboard does not infer reaction time from this measurement." },
  { column: 12, header: "Early Connection (°'s)", key: "blast_early_connection", label: "Early Connection", unit: "deg", signed: true, description: "Blast’s early-connection angle in degrees. Shown descriptively without an invented target angle." },
  { column: 13, header: "Hinge Angle at Impact (°'s)", key: "blast_hinge_angle", label: "Hinge Angle at Impact", unit: "deg", signed: true, description: "The hinge angle at impact reported by Blast, in degrees." },
  { column: 14, header: "Connection at Impact (°'s)", key: "blast_connection_impact", label: "Connection at Impact", unit: "deg", signed: true, description: "Blast’s connection-at-impact angle, in degrees. This remains separate from early connection." },
  { column: 15, header: "Body Tilt Angle (°'s)", key: "blast_body_tilt", label: "Body Tilt Angle", unit: "deg", signed: true, description: "Body tilt angle reported by Blast, in degrees. Original signed values are preserved." },
];
export const BLAST_HEADERS = ["first_name", "last_name", ...BLAST_REPORT_METRICS.map(m => m.header)];
export const BLAST_P95 = { ...BLAST_REPORT_METRICS[1], key: "p95_bat_speed", label: "Peak Bat Speed (95th)" };
export const BLAST_ALL_METRICS = [...BLAST_REPORT_METRICS, BLAST_P95];
export const blastMetricFor = (column: number, kind: BlastSummaryKind) => column === 3 && kind === "p95" ? BLAST_P95 : BLAST_REPORT_METRICS.find(m => m.column === column)!;
const validDate = (s: string) => /^2026-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
export function blastSource(kind: BlastSummaryKind, start: string, end: string) {
  if (!["average", "p95"].includes(kind) || !validDate(start) || !validDate(end) || start < "2026-09-01" || end > "2026-12-31" || start > end) throw new Error("Choose a valid Fall 2026 reporting period and report type.");
  return `Blast Motion · ${kind === "average" ? "Average" : "P95"} · ${start}:${end}`;
}
export function parseBlastSource(source: string): { kind: BlastSummaryKind; start: string; end: string } | null {
  const m = /^Blast Motion · (Average|P95) · (\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(source);
  if (!m) return null;
  const kind = m[1] === "Average" ? "average" : "p95";
  try { blastSource(kind, m[2], m[3]); return { kind, start: m[2], end: m[3] }; } catch { return null; }
}
export function validBlastValue(metric: BlastMetric, value: number) {
  return Number.isFinite(value) && (metric.signed || value >= 0) && (metric.unit !== "%" || value <= 100) &&
    (metric.unit !== "s" || value > 0) && (metric.unit !== "count" || (Number.isSafeInteger(value) && value > 0));
}
export function validBlastObservation(key: string, value: number, unit: string, source: string, date: string) {
  const period = parseBlastSource(source), metric = BLAST_ALL_METRICS.find(m => m.key === key);
  return !!period && !!metric && metric.unit === unit && date === period.end && validBlastValue(metric, value) &&
    (key !== "avg_bat_speed" || period.kind === "average") && (key !== "p95_bat_speed" || period.kind === "p95");
}
export const blastUnit = (unit: string) => ({ deg: "°", kw: "kW", g: "G" }[unit] ?? unit);
export const formatBlastValue = (value: number, unit: string) => value.toFixed(unit === "count" ? 0 : unit === "s" ? 3 : 1);
export const blastPeriodLabel = (start: string, end: string) => `${new Date(`${start}T12:00:00Z`).toLocaleDateString("en-US", {month:"short",day:"numeric",timeZone:"UTC"})}–${new Date(`${end}T12:00:00Z`).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric",timeZone:"UTC"})}`;

/** Keep exact report periods and duplicate exports visible; never average summaries. */
export function blastPracticeReports(readings: readonly Measurement[]) {
  const groups = new Map<string, { start: string; end: string; average: Measurement[]; p95: Measurement[] }>();
  for (const row of readings) {
    const period = parseBlastSource(row.source);
    const metric = BLAST_ALL_METRICS.find(m => m.label === row.metric);
    if (!period || !metric || !validBlastObservation(metric.key,row.value,row.unit,row.source,row.measured_at)) continue;
    const key = `${row.athlete_code}:${period.start}:${period.end}`;
    const group = groups.get(key) ?? { start:period.start,end:period.end,average:[],p95:[] };
    group[period.kind].push(row); groups.set(key,group);
  }
  return [...groups.values()].sort((a,b)=>b.end.localeCompare(a.end)||b.start.localeCompare(a.start));
}
