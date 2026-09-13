import type { Measurement } from "@/lib/imports/engine";
import type { PlayerMetricCard, PlayerMetricReading } from "@/lib/player-performance";

export type MeasurementChange = {
  percent: number | null; previousValue: number; previousDate: string;
  difference: number; unit: string; tone: "green" | "red" | "neutral";
};
type ComparableReading = { athlete: string; metric: string; source: string; unit: string; date: string; value: number };
const key = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
// Display directions only. These do not change descriptive body percentiles or imply health targets.
const direction = (metric: string) => ["musclemass", "bodyscore", "renphobodyscore"].includes(key(metric)) ? 1
  : ["bodyfatpct", "bodyfatpercentage", "bodyfatpercent"].includes(key(metric)) ? -1 : 0;

/** Previous distinct date, exact athlete/source/metric/unit; never compare upload order or blend units. */
export function measurementChange(current: ComparableReading, history: readonly ComparableReading[]): MeasurementChange | null {
  if (!validDate(current.date) || !Number.isFinite(current.value) || current.value < 0) return null;
  const comparable = history.filter(r => r.athlete === current.athlete && r.metric === current.metric && r.source === current.source && r.unit === current.unit && validDate(r.date) && r.date <= current.date);
  // Multiple disagreeing readings on one day cannot establish an unambiguous test comparison.
  const sameDay = comparable.filter(r => r.date === current.date);
  if (sameDay.some(r => !Number.isFinite(r.value) || r.value !== current.value)) return null;
  const previousDate = comparable.filter(r => r.date < current.date).map(r => r.date).sort().at(-1);
  if (!previousDate) return null;
  const previous = comparable.filter(r => r.date === previousDate);
  const previousValue = previous[0].value;
  if (!Number.isFinite(previousValue) || previousValue < 0 || previous.some(r => r.value !== previousValue)) return null;
  const difference = current.value - previousValue;
  const relative = previousValue > 0 ? difference / previousValue * 100 : null;
  const percent = relative !== null && Number.isFinite(relative) ? relative : null;
  const preferred = difference * direction(current.metric);
  return { percent, previousValue, previousDate, difference, unit: current.unit,
    tone: percent === null || difference === 0 || preferred === 0 ? "neutral" : preferred > 0 ? "green" : "red" };
}
const reportReading = (r: Measurement) => r.source === "RENPHO" && /^RENPHO report · Page [1-9][0-9]*$/.test(r.source_sheet) && /^[a-f0-9]{64}$/.test(r.file_hash);
const raw = (r: Measurement): ComparableReading => ({ athlete: r.athlete_code, metric: r.metric, source: r.source, unit: r.unit, date: r.measured_at, value: r.value });
export function renphoMeasurementChange(current: Measurement, chartableHistory: readonly Measurement[]): MeasurementChange | null {
  return reportReading(current) ? measurementChange(raw(current), chartableHistory.filter(reportReading).map(raw)) : null;
}
const player = (r: PlayerMetricReading): ComparableReading => ({ athlete: r.athleteCode, metric: r.metricKey, source: r.source, unit: r.unit, date: r.measuredAt, value: r.value });
export function playerRenphoChange(card: PlayerMetricCard): MeasurementChange | null {
  const isReport = (r: PlayerMetricReading) => !r.derived && r.source === "RENPHO" && r.provenance.length === 1 && reportReading(r.provenance[0]);
  return card.latest && card.metric.group === "body" && isReport(card.latest)
    ? measurementChange(player(card.latest), card.history.filter(isReport).map(player)) : null;
}
export function formatMeasurementChange(change: MeasurementChange): string {
  if (change.percent === null) return "No % comparison";
  if (change.percent === 0) return "0.0%";
  const magnitude = Math.abs(change.percent);
  return `${change.percent > 0 ? "+" : "−"}${magnitude < .1 ? "<0.1" : magnitude.toFixed(1)}%`;
}
