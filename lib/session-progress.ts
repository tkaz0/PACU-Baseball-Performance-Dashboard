import type { Measurement } from "@/lib/imports/engine";
import { blastPracticeReports } from "@/lib/blast-metrics";
import { BLAST_MAIN_METRICS, blastFallSummary } from "@/lib/blast-fall";
import { classifiedPitchSource } from "@/lib/imports/classified-pitch-results";

export type ProgressPoint = { key: string; date: string; label: string; value: number; count: number | null };
export type ProgressSeries = { key: string; label: string; unit: string; context: "practice" | "in_game"; points: ProgressPoint[] };

/** Weekly Blast averages are session summaries, not raw swings or a Fall P95. */
export function blastProgress(readings: readonly Measurement[]): ProgressSeries[] {
  const audit = blastFallSummary(readings);
  if (audit?.issues.length) return [];
  const reports = blastPracticeReports(readings).filter(report => report.average.length);
  const unique = reports.filter(report => new Set(report.average.map(row => row.file_hash)).size === 1 &&
    new Set(report.average.map(row => `${row.metric}:${row.unit}`)).size === report.average.length);
  return BLAST_MAIN_METRICS.map(metric => ({
    key: metric.key, label: metric.displayLabel.replace(" (Practice)", ""), unit: metric.unit, context: "practice" as const,
    points: unique.flatMap(report => {
      const value = report.average.filter(row => row.metric === metric.label && row.unit === metric.unit);
      const count = report.average.filter(row => row.metric === "Blast Swing Count" && row.unit === "count");
      if (value.length !== 1 || count.length !== 1 || !Number.isSafeInteger(count[0].value) || count[0].value <= 0) return [];
      return [{ key: value[0].id, date: report.end, label: `${report.start.slice(5)}–${report.end.slice(5)}`, value: value[0].value, count: count[0].value }];
    }).sort((a,b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key)),
  })).filter(series => series.points.length);
}

const PITCH_METRICS = [
  { metric: "Pitch Type Average Velocity", label: "Average Velocity", unit: "mph" },
  { metric: "Pitch Type Max Velocity", label: "Maximum Velocity", unit: "mph" },
  { metric: "Pitch Type Average Spin", label: "Average Spin", unit: "rpm" },
  { metric: "Pitch Type Max Spin", label: "Maximum Spin", unit: "rpm" },
] as const;

/** Each reviewed file is one session. Do not add successive files or merge pitch families. */
export function pitchProgress(readings: readonly Measurement[], context: "practice" | "in_game"): ProgressSeries[] {
  const groups = new Map<string, Measurement[]>();
  for (const row of readings) {
    const parsed = classifiedPitchSource(row.source);
    if (!parsed || (parsed.category === "Practice" ? "practice" : "in_game") !== context || row.measured_at < "2026-09-01" || row.measured_at > "2026-12-31") continue;
    const key = JSON.stringify([row.file_hash, row.source, row.measured_at]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const series = new Map<string, ProgressSeries>();
  for (const rows of groups.values()) {
    const pitch = classifiedPitchSource(rows[0].source)!;
    for (const definition of PITCH_METRICS) {
      const values = rows.filter(row => row.metric === definition.metric && row.unit === definition.unit);
      const countMetric = definition.unit === "mph" ? "Pitch Type Velocity Readings" : "Pitch Type Spin Readings";
      const counts = rows.filter(row => row.metric === countMetric && row.unit === "count");
      if (values.length !== 1 || counts.length !== 1 || !Number.isSafeInteger(counts[0].value) || counts[0].value < 1) continue;
      const key = `${pitch.pitchType}:${definition.metric}`;
      const item = series.get(key) ?? { key, label: `${pitch.pitchType} · ${definition.label}`, unit: definition.unit, context, points: [] };
      item.points.push({ key: values[0].id, date: values[0].measured_at, label: values[0].source_file.replace(/\.csv$/i,""), value: values[0].value, count: counts[0].value });
      series.set(key, item);
    }
  }
  return [...series.values()].map(item => ({...item, points:item.points.sort((a,b)=>a.date.localeCompare(b.date)||a.key.localeCompare(b.key))})).sort((a,b)=>a.label.localeCompare(b.label));
}
