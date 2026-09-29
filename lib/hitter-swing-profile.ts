import { BLAST_MAIN_KEYS, blastFallSummary, type BlastFallSummary } from "@/lib/blast-fall";
import { parseBlastSource } from "@/lib/blast-metrics";
import type { Measurement } from "@/lib/imports/engine";
import type { PlayerMetricCard, PlayerMetricReading, PlayerPerformance } from "@/lib/player-performance";

export type AttackPath = {
  key: "downhill" | "flat" | "rising" | "high_lift";
  label: string;
  name: string;
  description: string;
};
export type BarrelTilt = {
  key: "deep" | "mid" | "shallow" | "up";
  label: string;
  description: string;
};
export type SwingBodyMeasurement<Unit extends "in" | "lb"> = { value: number; unit: Unit; date: string };
export type SwingBodyRank = { value: number; sampleSize: number };
export type HitterSwingProfile = {
  summary: BlastFallSummary | null;
  averageBatSpeed: number | null;
  attackAngle: number | null;
  verticalBatAngle: number | null;
  bodyTiltAngle: number | null;
  path: AttackPath | null;
  tilt: BarrelTilt | null;
  height: SwingBodyMeasurement<"in"> | null;
  weight: SwingBodyMeasurement<"lb"> | null;
  heightRank: SwingBodyRank | null;
  weightRank: SwingBodyRank | null;
};

/** Display geometry only. Never clamp, correct, or overwrite an original reading. */
function geometricAngle(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= -90 && value <= 90 ? value : null;
}

/** Custom PAC descriptions, not published ideal ranges or swing-quality grades. */
export function attackPath(value: number | null): AttackPath | null {
  const angle = geometricAngle(value);
  if (angle === null) return null;
  if (angle < 0) return { key: "downhill", label: "Down through contact", name: "Downhill Path", description: "The recorded average attack angle points below horizontal." };
  if (angle < 10) return { key: "flat", label: "Flat through contact", name: "Flat Path", description: "The recorded average attack angle is horizontal or slightly upward." };
  if (angle < 20) return { key: "rising", label: "Up through contact", name: "Lift Path", description: "The recorded average attack angle points upward." };
  return { key: "high_lift", label: "Steep lift through contact", name: "Steep Path", description: "The recorded average attack angle has a steeper upward direction." };
}

/** Custom PAC descriptions of the signed barrel angle, with no quality ordering. */
export function barrelTilt(value: number | null): BarrelTilt | null {
  const angle = geometricAngle(value);
  if (angle === null) return null;
  if (angle < -40) return { key: "deep", label: "Deep Barrel Tilt", description: "The recorded average barrel angle points farther below horizontal." };
  if (angle < -20) return { key: "mid", label: "Angled Barrel", description: "The recorded average barrel angle points below horizontal." };
  if (angle <= 0) return { key: "shallow", label: "Flat Barrel", description: "The recorded average barrel angle is nearer horizontal or level." };
  return { key: "up", label: "Barrel Up", description: "The recorded average barrel angle points above horizontal." };
}

function positiveReading(reading: PlayerMetricReading | null | undefined) {
  return reading && Number.isFinite(reading.value) && reading.value > 0 ? reading : null;
}

/** Percentiles have already been bound to this exact canonical reading by getPlayerPerformance. */
function bodyRank(card: PlayerMetricCard | undefined): SwingBodyRank | null {
  const rank = card?.percentile, reading = card?.latest;
  return card?.percentileStatus === "available" && reading && positiveReading(reading) && rank &&
    rank.unit === reading.unit && rank.period === reading.period && rank.direction === "neutral" &&
    Number.isSafeInteger(rank.sampleSize) && rank.sampleSize >= 5 && Number.isFinite(rank.value) && rank.value >= 0 && rank.value <= 100
    ? { value: rank.value, sampleSize: rank.sampleSize } : null;
}

/** Use only the authorized athlete's verified Fall averages and canonical body cards. */
export function hitterSwingProfile(readings: readonly Measurement[], performance: PlayerPerformance): HitterSwingProfile {
  const summary = blastFallSummary(readings, [...BLAST_MAIN_KEYS, "blast_body_tilt"]);
  const latestReadings = Object.values(performance).flatMap(cards => cards.flatMap(card => [card.latest, ...(card.sourceCards ?? []).map(source => source.latest)]))
    .filter((reading): reading is PlayerMetricReading => reading !== null);
  const athleteCodes = new Set([
    ...readings.filter(reading => parseBlastSource(reading.source)).map(reading => reading.athlete_code),
    ...latestReadings.map(reading => reading.athleteCode),
  ]);
  // No filtering may turn a mixed-athlete input into an apparently valid rollup.
  const sameAthlete = athleteCodes.size <= 1 && !athleteCodes.has("");
  const average = (key: string) => sameAthlete && summary && !summary.issues.length
    ? summary.metrics.find(metric => metric.key === key)?.average ?? null
    : null;
  const batSpeed = average("avg_bat_speed");
  const averageBatSpeed = batSpeed !== null && Number.isFinite(batSpeed) && batSpeed >= 0 ? batSpeed : null;
  const attackAngle = geometricAngle(average("blast_attack_angle"));
  const verticalBatAngle = geometricAngle(average("blast_vertical_bat_angle"));
  const bodyTiltAngle = geometricAngle(average("blast_body_tilt"));
  const heightReading = sameAthlete ? positiveReading(performance.body.find(card => card.metric.key === "height")?.latest) : null;
  const weightReading = sameAthlete ? positiveReading(performance.body.find(card => card.metric.key === "weight")?.latest) : null;
  const heightValue = heightReading?.unit === "in" ? heightReading.value : heightReading?.unit === "cm" ? heightReading.value / 2.54 : null;
  const weightValue = weightReading?.unit === "lb" ? weightReading.value : weightReading?.unit === "kg" ? weightReading.value * 2.20462262185 : weightReading?.unit === "st" ? weightReading.value * 14 : null;
  return {
    summary, averageBatSpeed, attackAngle, verticalBatAngle, bodyTiltAngle,
    path: attackPath(attackAngle), tilt: barrelTilt(verticalBatAngle),
    height: heightReading && heightValue !== null && Number.isFinite(heightValue) && heightValue > 0 ? { value: heightValue, unit: "in", date: heightReading.measuredAt } : null,
    weight: weightReading && weightValue !== null && Number.isFinite(weightValue) && weightValue > 0 ? { value: weightValue, unit: "lb", date: weightReading.measuredAt } : null,
    heightRank: heightReading && heightValue !== null && Number.isFinite(heightValue) && heightValue > 0 ? bodyRank(performance.body.find(card => card.metric.key === "height")) : null,
    weightRank: weightReading && weightValue !== null && Number.isFinite(weightValue) && weightValue > 0 ? bodyRank(performance.body.find(card => card.metric.key === "weight")) : null,
  };
}
