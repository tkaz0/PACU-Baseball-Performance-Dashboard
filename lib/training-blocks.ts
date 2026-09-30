import type { Measurement } from "@/lib/imports/engine";
import { BLAST_MAIN_METRICS } from "@/lib/blast-fall";
import { parseBlastSource, validBlastValue } from "@/lib/blast-metrics";
import { classifiedPitchSource, CLASSIFIED_METRICS } from "@/lib/imports/classified-pitch-results";
import { pitchTypeLabel } from "@/lib/imports/pitch-assignments";
import { PLAYER_METRICS, normalizePlayerMetric, validatePlayerMetricValue } from "@/lib/player-performance";

export type TrainingBlockWindow = { start: string; end: string };
export type TrainingBlockPoint = TrainingBlockWindow & { value: number | null; count: number | null; session: number; missing?: true };
export type TrainingBlockSeries = {
  id: string; label: string; metricKey: string; source: string; unit: string;
  category: "Physicality" | "Athletic Testing" | "Practice" | "In-Game";
  method: "weighted" | "maximum" | "fastest" | "latest";
  direction: "higher" | "lower" | "neutral";
  sampleLabel: "swings" | "pitches" | "trials" | "tests";
  points: TrainingBlockPoint[];
};
export type TrainingBlockSummary = {
  value: number | null; average: number | null; samples: number | null; sessions: number;
  firstDate: string | null; lastDate: string | null;
  issue: "empty" | "partial_report" | "overlapping_reports" | "conflict" | "missing_counts" | "missing_results" | null;
};
export type TrainingBlockReadingCount = {
  observationId: string; count: number; value: number; measuredAt: string;
  source: string; metricKey: string; unit: string;
};
type Options = {
  athleteCode: string; showHitting: boolean; showPitching: boolean; today?: string;
  /** A separately verified, own-athlete sample projection, keyed to exact saved observations. */
  readingCounts?: readonly TrainingBlockReadingCount[];
};
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const pacificDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const validCount = (value: number | null | undefined): value is number => value != null && Number.isSafeInteger(value) && value > 0;
const bodyKeys = new Set(["weight", "height", "body_fat_pct", "muscle_mass", "body_score", "grip_strength", "grip_dominant", "grip_non_dominant"]);
const timedKeys = new Set(["home_to_first", "home_to_second", "boxer_t", "steal_start_12ft"]);
const hittingKeys = new Set(["max_exit_velocity", "avg_exit_velocity", "max_bat_speed", "avg_bat_speed", "max_distance"]);
const fieldKeys = new Set(["infield_velocity", "outfield_velocity"]);
const signature = (row: Measurement) => JSON.stringify([row.athlete_code, row.source, row.metric, row.unit, row.value, row.measured_at, row.file_hash, row.source_sheet, row.source_row]);

/** Called after the existing profile authorization. It returns only display data:
 * no athlete identity, observation ID, file hash, filename, or source coordinates.
 * Cumulative game-sheet snapshots and weekly P95 reports cannot enter this view.
 */
export function buildTrainingBlockSeries(readings: readonly Measurement[], options: Options): TrainingBlockSeries[] {
  const today = options.today ?? pacificDay();
  if (!options.athleteCode || !validDate(today)) return [];
  const cutoff = today < "2026-12-31" ? today : "2026-12-31";
  const own = readings.filter(row => row.athlete_code === options.athleteCode && validDate(row.measured_at) && row.measured_at >= "2026-09-01" && row.measured_at <= cutoff);
  const seen = new Map<string, Measurement>(), conflicts = new Set<string>();
  for (const row of own) {
    const prior = seen.get(row.id);
    if (prior && signature(prior) !== signature(row)) conflicts.add(row.id);
    else seen.set(row.id, row);
  }
  const fullSwingFileDates = new Map<string, Set<string>>();
  for (const row of seen.values()) {
    if (!row.source.startsWith("Full Swing · ")) continue;
    const key = JSON.stringify([row.source, row.file_hash]);
    fullSwingFileDates.set(key, new Set([...(fullSwingFileDates.get(key) ?? []), row.measured_at]));
  }
  for (const row of seen.values()) if ((fullSwingFileDates.get(JSON.stringify([row.source, row.file_hash]))?.size ?? 0) > 1) conflicts.add(row.id);
  const counts = new Map<string, number | null>();
  for (const sample of options.readingCounts ?? []) {
    const reading = seen.get(sample.observationId);
    const normalized = reading && normalizePlayerMetric(reading.metric, reading.unit);
    // Counts and measurements can be read concurrently across a republish.
    // Accept the count only when the numerical/context evidence is identical.
    const matches = reading && normalized && !conflicts.has(reading.id)
      && sample.value === reading.value && sample.measuredAt === reading.measured_at
      && sample.source === reading.source && sample.metricKey === normalized.key && sample.unit === reading.unit;
    counts.set(sample.observationId, counts.has(sample.observationId) || !validCount(sample.count) || !matches ? null : sample.count);
  }
  const sessions = new Map<string, Measurement[]>();
  for (const row of seen.values()) {
    // Exact source, original file, date, and sheet keep independent protocols apart.
    const key = JSON.stringify([row.source, row.file_hash, row.measured_at, row.source_sheet]);
    sessions.set(key, [...(sessions.get(key) ?? []), row]);
  }
  const series = new Map<string, TrainingBlockSeries>();
  const recordedBlastMetrics = BLAST_MAIN_METRICS.filter(metric => own.some(row => parseBlastSource(row.source)?.kind === "average" && row.metric === metric.label && row.unit === metric.unit));
  let sessionNumber = 0;
  for (const rows of sessions.values()) {
    const first = rows[0], session = sessionNumber++;
    const blast = parseBlastSource(first.source), pitch = classifiedPitchSource(first.source);
    const dates: TrainingBlockWindow = { start: blast?.start ?? first.measured_at, end: blast?.end ?? first.measured_at };
    const add = (definition: Omit<TrainingBlockSeries, "id" | "points">, value: number | null, count: number | null, missing = false) => {
      const id = JSON.stringify([definition.metricKey, definition.source, definition.unit]);
      const result = series.get(id) ?? { ...definition, id, points: [] };
      result.points.push({ ...dates, value, count, session, ...(missing ? { missing: true as const } : {}) });
      series.set(id, result);
    };
    const single = (metric: string, unit: string) => {
      const matches = rows.filter(row => row.metric === metric && row.unit === unit);
      return matches.length === 1 && !conflicts.has(matches[0].id) && Number.isFinite(matches[0].value) ? matches[0] : null;
    };
    if (blast) {
      if (!options.showHitting || blast.kind !== "average" || blast.end !== first.measured_at) continue;
      const countRow = single("Blast Swing Count", "count"), count = validCount(countRow?.value) ? countRow.value : null;
      for (const metric of recordedBlastMetrics) {
        const missing = !rows.some(row => row.metric === metric.label && row.unit === metric.unit);
        const value = single(metric.label, metric.unit);
        add({ metricKey: metric.key, label: metric.displayLabel.replace(" (Practice)", ""), source: "Blast Motion · Weekly Average", category: "Practice", unit: metric.unit, method: "weighted", direction: metric.unit === "mph" ? "higher" : "neutral", sampleLabel: "swings" }, value && validBlastValue(metric, value.value) ? value.value : null, count, missing);
      }
      continue;
    }
    if (pitch) {
      if (!options.showPitching) continue;
      for (const metric of CLASSIFIED_METRICS.filter(metric => metric.unit !== "count")) {
        if (!rows.some(row => row.metric === metric.label && row.unit === metric.unit)) continue;
        const value = single(metric.label, metric.unit);
        const countRow = single(metric.unit === "mph" ? "Pitch Type Velocity Readings" : "Pitch Type Spin Readings", "count");
        const maximum = metric.key.includes("max");
        add({ metricKey: metric.key, label: `${pitchTypeLabel(pitch.pitchType)} · ${maximum ? "Max" : "Average"} ${metric.unit === "mph" ? "Velocity" : "Spin"}`, source: first.source, category: pitch.category === "Practice" ? "Practice" : "In-Game", unit: metric.unit, method: maximum ? "maximum" : "weighted", direction: metric.unit === "mph" ? "higher" : "neutral", sampleLabel: "pitches" }, value && value.value >= 0 ? value.value : null, validCount(countRow?.value) ? countRow.value : null);
      }
      continue;
    }
    const fullSwing = /^Full Swing · (Game|Intrasquad|Practice)$/.exec(first.source);
    // These are numerical measurements, never cumulative QPA/Pitching game totals.
    if (!fullSwing && !["RENPHO", "Player Metrics"].includes(first.source) && !/^Manual testing · \S/.test(first.source)) continue;
    const normalized = rows.flatMap(row => {
      const metric = normalizePlayerMetric(row.metric, row.unit);
      return metric ? [{ row, ...metric }] : [];
    });
    const partitions = new Map<string, typeof normalized>();
    for (const item of normalized) {
      if (fullSwing ? !options.showHitting || !hittingKeys.has(item.key) : !bodyKeys.has(item.key) && !(options.showHitting && (timedKeys.has(item.key) || fieldKeys.has(item.key)))) continue;
      const key = JSON.stringify([item.key, item.unit]);
      partitions.set(key, [...(partitions.get(key) ?? []), item]);
    }
    for (const partition of partitions.values()) {
      const { key, unit } = partition[0], metric = PLAYER_METRICS.find(metric => metric.key === key)!;
      const timed = timedKeys.has(key);
      const definition: Omit<TrainingBlockSeries, "id" | "points"> = {
        metricKey: key, label: metric.label, source: first.source, unit,
        category: fullSwing ? fullSwing[1] === "Practice" ? "Practice" : "In-Game" : bodyKeys.has(key) ? "Physicality" : "Athletic Testing",
        method: timed ? "fastest" : fullSwing && key.startsWith("avg_") ? "weighted" : key.startsWith("max_") || fieldKeys.has(key) ? "maximum" : "latest",
        direction: metric.direction, sampleLabel: fullSwing ? "swings" : timed ? "trials" : "tests",
      };
      // Timed rows are independently saved trials. Summary metrics must be unique in a session.
      for (const item of timed ? partition : [partition[0]]) {
        const safe = (timed || partition.length === 1) && !conflicts.has(item.row.id) && validatePlayerMetricValue(key, item.row.value, unit);
        add(definition, safe ? item.row.value : null, fullSwing ? counts.get(item.row.id) ?? null : 1);
      }
    }
  }
  return [...series.values()].map(item => ({ ...item, points: item.points.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.session - b.session) })).sort((a, b) => a.category.localeCompare(b.category) || a.source.localeCompare(b.source) || a.label.localeCompare(b.label));
}

export function trainingBlockWindowError(a: TrainingBlockWindow, b: TrainingBlockWindow): string | null {
  if (![a.start, a.end, b.start, b.end].every(validDate) || a.start > a.end || b.start > b.end) return "Choose a start and end date for each block.";
  if ([a.start, b.start].some(date => date < "2026-09-01") || [a.end, b.end].some(date => date > "2026-12-31")) return "Choose dates within Fall 2026.";
  if (a.end >= b.start) return "Block 2 must start after Block 1 ends.";
  return null;
}

export function summarizeTrainingBlock(series: TrainingBlockSeries, window: TrainingBlockWindow): TrainingBlockSummary {
  const empty: TrainingBlockSummary = { value: null, average: null, samples: null, sessions: 0, firstDate: null, lastDate: null, issue: "empty" };
  if (!validDate(window.start) || !validDate(window.end) || window.start > window.end) return empty;
  const touching = series.points.filter(point => point.start <= window.end && point.end >= window.start);
  if (!touching.length) return empty;
  const points = touching.filter(point => point.start >= window.start && point.end <= window.end);
  const dates = points.flatMap(point => [point.start, point.end]).sort();
  const result = { ...empty, sessions: new Set(points.map(point => point.session)).size, firstDate: dates[0] ?? null, lastDate: dates.at(-1) ?? null };
  if (points.length !== touching.length) return { ...result, issue: "partial_report" };
  if (points.some(point => point.missing)) return { ...result, issue: "missing_results" };
  if (points.some(point => point.value === null || !Number.isFinite(point.value))) return { ...result, issue: "conflict" };
  if (series.source === "Blast Motion · Weekly Average" && points.some((point, index) => points.slice(0, index).some(prior => prior.end >= point.start))) return { ...result, issue: "overlapping_reports" };
  const total = points.every(point => validCount(point.count)) ? points.reduce((sum, point) => sum + point.count!, 0) : null;
  const samples = validCount(total) ? total : null;
  if (series.method === "weighted" && samples === null) return { ...result, issue: "missing_counts" };
  if (series.method === "latest") {
    const lastDate = dates.at(-1), latest = points.filter(point => point.end === lastDate);
    if (latest.length !== 1) return { ...result, issue: "conflict" };
    return { ...result, value: latest[0].value, samples, issue: null };
  }
  const average = series.method === "weighted" ? points.reduce((mean, point) => mean + point.value! * (point.count! / samples!), 0)
    : series.method === "fastest" ? points.reduce((mean, point) => mean + point.value! / points.length, 0) : null;
  const value = series.method === "weighted" ? average : series.method === "fastest" ? Math.min(...points.map(point => point.value!)) : Math.max(...points.map(point => point.value!));
  return Number.isFinite(value) ? { ...result, value, average, samples, issue: null } : { ...result, issue: "conflict" };
}

/** Equal calendar halves of the available Fall range; users can choose their own blocks. */
export function defaultTrainingBlocks(series: readonly TrainingBlockSeries[]): [TrainingBlockWindow, TrainingBlockWindow] {
  const dates = series.flatMap(item => item.points.flatMap(point => [point.start, point.end])).filter(validDate).sort();
  const start = dates[0] ?? "2026-09-01", end = dates.at(-1) ?? "2026-09-02";
  const first = Date.parse(start), last = Math.max(Date.parse(end), first + 86_400_000);
  const iso = (value: number) => new Date(value).toISOString().slice(0, 10);
  const middle = first + Math.floor((last - first) / 86_400_000 / 2) * 86_400_000;
  const periods = series.flatMap(item => item.points);
  // Prefer a split between complete reports, so a weekly Blast file is never
  // arbitrarily divided across the initial windows.
  const splits = [...new Set(dates)].filter(date => date < end && !periods.some(point => point.start <= date && point.end > date));
  const split = splits.sort((a, b) => Math.abs(Date.parse(a) - middle) - Math.abs(Date.parse(b) - middle))[0];
  if (split) return [{ start, end: split }, { start: iso(Date.parse(split) + 86_400_000), end }];
  if (end < "2026-12-31") return [{ start, end }, { start: iso(Date.parse(end) + 86_400_000), end: iso(Date.parse(end) + 86_400_000) }];
  if (start > "2026-09-01") return [{ start: "2026-09-01", end: iso(Date.parse(start) - 86_400_000) }, { start, end }];
  return [{ start, end: iso(middle) }, { start: iso(middle + 86_400_000), end }];
}

export function trainingBlockChange(series: TrainingBlockSeries, a: TrainingBlockSummary, b: TrainingBlockSummary) {
  if (a.value === null || b.value === null) return null;
  const delta = b.value - a.value;
  const tone = delta === 0 || series.direction === "neutral" ? "neutral" : (series.direction === "higher" ? delta > 0 : delta < 0) ? "improved" : "decreased";
  return { delta, percent: a.value === 0 ? null : delta / Math.abs(a.value) * 100, tone } as const;
}
