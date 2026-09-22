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
