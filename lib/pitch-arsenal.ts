import type { Measurement } from "@/lib/imports/engine";
import { classifiedPitchSource } from "@/lib/imports/classified-pitch-results";

export type ArsenalPitch = {
  source: string;
  pitchType: string;
  count: number | null;
  averageVelocity: number | null;
  maxVelocity: number | null;
  velocityReadings: number | null;
  averageSpin: number | null;
  maxSpin: number | null;
  spinReadings: number | null;
};

export type ArsenalReading = Pick<Measurement, "source" | "metric" | "unit" | "value" | "measured_at" | "file_hash">;
export type FallArsenalPitch = ArsenalPitch & {
  category: "Game" | "Intrasquad" | "Practice";
  firstDate: string; lastDate: string; sessionCount: number;
  velocityFirstDate: string | null; velocityLastDate: string | null;
  spinFirstDate: string | null; spinLastDate: string | null;
  velocityAverageFirstDate: string | null; velocityAverageLastDate: string | null;
  spinAverageFirstDate: string | null; spinAverageLastDate: string | null;
  maxVelocityDate: string | null; maxSpinDate: string | null;
  maxVelocityReadings?: number | null; maxSpinReadings?: number | null;
  velocityBasis: "fall" | "latest" | null; spinBasis: "fall" | "latest" | null;
};

const fields = {
  count: ["Pitch Type Count", "count"],
  averageVelocity: ["Pitch Type Average Velocity", "mph"],
  maxVelocity: ["Pitch Type Max Velocity", "mph"],
  velocityReadings: ["Pitch Type Velocity Readings", "count"],
  averageSpin: ["Pitch Type Average Spin", "rpm"],
  maxSpin: ["Pitch Type Max Spin", "rpm"],
  spinReadings: ["Pitch Type Spin Readings", "count"],
} as const;

/** An ambiguous duplicate is omitted from charts instead of choosing a value arbitrarily. */
function uniqueValue(readings: readonly Measurement[], metric: string, unit: string): number | null {
  const values = [...new Set(readings.filter(row => row.metric === metric && row.unit === unit && Number.isFinite(row.value)).map(row => row.value))];
  return values.length === 1 ? values[0] : null;
}

export function arsenalPitches(readings: readonly Measurement[]): ArsenalPitch[] {
  return [...new Set(readings.map(row => row.source))].flatMap(source => {
    const pitch = classifiedPitchSource(source);
    if (!pitch) return [];
    const group = readings.filter(row => row.source === source);
    const values = Object.fromEntries(Object.entries(fields).map(([key, [metric, unit]]) => [key, uniqueValue(group, metric, unit)])) as Record<keyof typeof fields, number | null>;
    return [{ source, pitchType: pitch.pitchType, ...values }];
  }).sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.pitchType.localeCompare(b.pitchType));
}

const validDate = (date: string) => /^2026-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
const currentPacificDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** Caller scopes one athlete first. No raw file identity is returned to the browser.
 * Match the leaderboard's Fall best / complete-count average rules. A latest fallback
 * is used only when its date has one unambiguous observation; import-order ties are
 * deliberately not guessed from the limited numerical projection.
 */
export function fallArsenalPitches(readings: readonly ArsenalReading[], today = currentPacificDay()): FallArsenalPitch[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !Number.isFinite(Date.parse(today)) || new Date(today).toISOString().slice(0, 10) !== today) return [];
  const cutoff = today < "2026-12-31" ? today : "2026-12-31";
  const valid = readings.filter(row => classifiedPitchSource(row.source) && validDate(row.measured_at) && row.measured_at >= "2026-09-01" && row.measured_at <= cutoff && /^[a-f0-9]{64}$/.test(row.file_hash)
    && Object.values(fields).some(([metric, unit]) => row.metric === metric && row.unit === unit));
  return [...new Set(valid.map(row => row.source))].flatMap(source => {
    const pitch = classifiedPitchSource(source)!;
    const rows = valid.filter(row => row.source === source);
    const sessions = [...new Set(rows.map(row => row.file_hash))].map(hash => rows.filter(row => row.file_hash === hash));
    if (sessions.some(session => new Set(session.map(row => row.measured_at)).size !== 1)) return [];
    const read = (session: readonly ArsenalReading[], field: keyof typeof fields) => {
      const [metric, unit] = fields[field], matches = session.filter(row => row.metric === metric && row.unit === unit);
      return matches.length === 1 && Number.isFinite(matches[0].value) && matches[0].value >= 0 ? matches[0].value : null;
    };
    const has = (session: readonly ArsenalReading[], field: keyof typeof fields) => session.some(row => row.metric === fields[field][0] && row.unit === fields[field][1]);
    function family(averageKey: "averageVelocity" | "averageSpin", maxKey: "maxVelocity" | "maxSpin", countKey: "velocityReadings" | "spinReadings") {
      const values = sessions.map(session => {
        const maximumRows = session.filter(row => row.metric === fields[maxKey][0] && row.unit === fields[maxKey][1]);
        const validMaxima = maximumRows.filter(row => Number.isFinite(row.value) && row.value >= 0).map(row => row.value);
        return { date: session[0].measured_at, average: read(session, averageKey), maximum: validMaxima.length ? Math.max(...validMaxima) : null,
          uniqueMaximum: maximumRows.length === 1 && validMaxima.length === 1, count: read(session, countKey), hasAverage: has(session, averageKey), hasMaximum: maximumRows.length > 0 };
      });
      const averageSessions = values.filter(value => value.hasAverage);
      const complete = averageSessions.length > 0 && averageSessions.every(value => value.average !== null && value.count !== null && Number.isSafeInteger(value.count) && value.count > 0);
      const total = complete ? averageSessions.reduce((sum, value) => sum + value.count!, 0) : null;
      const weighted = total !== null && Number.isSafeInteger(total) && total > 0;
      const latestDate = averageSessions.map(value => value.date).sort().at(-1);
      const latest = averageSessions.filter(value => value.date === latestDate);
      const fallback = latest.length === 1 && latest[0].average !== null ? latest[0] : null;
      const basis: FallArsenalPitch["velocityBasis"] = weighted ? "fall" : fallback ? "latest" : null;
      const average = weighted ? averageSessions.reduce((sum, value) => sum + value.average! * (value.count! / total!), 0) : fallback?.average ?? null;
      const count = weighted ? total : fallback?.count !== null && fallback?.count !== undefined && Number.isSafeInteger(fallback.count) && fallback.count > 0 ? fallback.count : null;
      const maxima = values.filter(value => value.maximum !== null).sort((a, b) => b.maximum! - a.maximum! || b.date.localeCompare(a.date));
      // A max can come from a different set of sessions than the average. Never
      // reuse the mean's denominator or drop an ambiguous session from its n.
      const maximumSessions = values.filter(value => value.hasMaximum);
      const maximumTotal = maximumSessions.length > 0 && maximumSessions.every(value => value.uniqueMaximum && value.count !== null && Number.isSafeInteger(value.count) && value.count > 0)
        ? maximumSessions.reduce((sum, value) => sum + value.count!, 0) : null;
      const dates = values.filter(value => value.hasAverage || value.hasMaximum).map(value => value.date).sort();
      const averageDates = (weighted ? averageSessions : fallback ? [fallback] : []).map(value => value.date).sort();
      return { average, maximum: maxima[0]?.maximum ?? null, count, maximumCount: maximumTotal !== null && Number.isSafeInteger(maximumTotal) ? maximumTotal : null, basis, firstDate: dates[0] ?? null, lastDate: dates.at(-1) ?? null,
        averageFirstDate: averageDates[0] ?? null, averageLastDate: averageDates.at(-1) ?? null, maxDate: maxima[0]?.date ?? null };
    }
    const velocity = family("averageVelocity", "maxVelocity", "velocityReadings"), spin = family("averageSpin", "maxSpin", "spinReadings");
    const counts = sessions.map(session => read(session, "count"));
    const sum = counts.every(count => count !== null && Number.isSafeInteger(count) && count >= 0) ? counts.reduce<number>((total, count) => total + count!, 0) : null;
    const dates = sessions.map(session => session[0].measured_at).sort();
    return [{ source, pitchType: pitch.pitchType, category: pitch.category as FallArsenalPitch["category"], firstDate: dates[0], lastDate: dates.at(-1)!, sessionCount: sessions.length,
      count: sum !== null && Number.isSafeInteger(sum) ? sum : null,
      averageVelocity: velocity.average, maxVelocity: velocity.maximum, velocityReadings: velocity.count, velocityBasis: velocity.basis,
      averageSpin: spin.average, maxSpin: spin.maximum, spinReadings: spin.count, spinBasis: spin.basis,
      velocityFirstDate: velocity.firstDate, velocityLastDate: velocity.lastDate, spinFirstDate: spin.firstDate, spinLastDate: spin.lastDate,
      velocityAverageFirstDate: velocity.averageFirstDate, velocityAverageLastDate: velocity.averageLastDate, spinAverageFirstDate: spin.averageFirstDate, spinAverageLastDate: spin.averageLastDate,
      maxVelocityDate: velocity.maxDate, maxSpinDate: spin.maxDate,
      maxVelocityReadings: velocity.maximumCount, maxSpinReadings: spin.maximumCount,
    } satisfies FallArsenalPitch];
  }).sort((a, b) => a.category.localeCompare(b.category) || (b.count ?? 0) - (a.count ?? 0) || a.pitchType.localeCompare(b.pitchType));
}
