import { blastFallSummary, type BlastFallSummary } from "@/lib/blast-fall";
import { parseBlastSource } from "@/lib/blast-metrics";
import type { Measurement } from "@/lib/imports/engine";
import type { PlayerMetricReading, PlayerPerformance } from "@/lib/player-performance";

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
export type HitterSwingProfile = {
  summary: BlastFallSummary | null;
  averageBatSpeed: number | null;
  attackAngle: number | null;
  verticalBatAngle: number | null;
  path: AttackPath | null;
  tilt: BarrelTilt | null;
  height: SwingBodyMeasurement<"in"> | null;
  weight: SwingBodyMeasurement<"lb"> | null;
};

/** Display geometry only. Never clamp, correct, or overwrite an original reading. */
function geometricAngle(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= -90 && value <= 90 ? value : null;
}

/** Custom PAC descriptions, not published ideal ranges or swing-quality grades. */
export function attackPath(value: number | null): AttackPath | null {
  const angle = geometricAngle(value);
  if (angle === null) return null;
  if (angle < 0) return { key: "downhill", label: "Descending path", name: "Downhill Swing", description: "The recorded average attack angle points below horizontal." };
  if (angle < 10) return { key: "flat", label: "Flatter path", name: "Flat Driver", description: "The recorded average attack angle is horizontal or slightly upward." };
  if (angle < 20) return { key: "rising", label: "Upward path", name: "Rising Driver", description: "The recorded average attack angle points upward." };
  return { key: "high_lift", label: "Steeper upward path", name: "High-Lift Swing", description: "The recorded average attack angle has a steeper upward direction." };
}

/** Custom PAC descriptions of the signed barrel angle, with no quality ordering. */
export function barrelTilt(value: number | null): BarrelTilt | null {
  const angle = geometricAngle(value);
  if (angle === null) return null;
  if (angle < -40) return { key: "deep", label: "Deep Barrel", description: "The recorded average barrel angle points farther below horizontal." };
  if (angle < -20) return { key: "mid", label: "Mid-Tilt Barrel", description: "The recorded average barrel angle points below horizontal." };
  if (angle <= 0) return { key: "shallow", label: "Shallow Barrel", description: "The recorded average barrel angle is nearer horizontal or level." };
  return { key: "up", label: "Barrel Up", description: "The recorded average barrel angle points above horizontal." };
}

function positiveReading(reading: PlayerMetricReading | null | undefined) {
  return reading && Number.isFinite(reading.value) && reading.value > 0 ? reading : null;
}

/** Use only the authorized athlete's verified Fall averages and canonical body cards. */
export function hitterSwingProfile(readings: readonly Measurement[], performance: PlayerPerformance): HitterSwingProfile {
  const summary = blastFallSummary(readings);
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
  const heightReading = sameAthlete ? positiveReading(performance.body.find(card => card.metric.key === "height")?.latest) : null;
  const weightReading = sameAthlete ? positiveReading(performance.body.find(card => card.metric.key === "weight")?.latest) : null;
  const heightValue = heightReading?.unit === "in" ? heightReading.value : heightReading?.unit === "cm" ? heightReading.value / 2.54 : null;
  const weightValue = weightReading?.unit === "lb" ? weightReading.value : weightReading?.unit === "kg" ? weightReading.value * 2.20462262185 : weightReading?.unit === "st" ? weightReading.value * 14 : null;
  return {
    summary, averageBatSpeed, attackAngle, verticalBatAngle,
    path: attackPath(attackAngle), tilt: barrelTilt(verticalBatAngle),
    height: heightReading && heightValue !== null && Number.isFinite(heightValue) && heightValue > 0 ? { value: heightValue, unit: "in", date: heightReading.measuredAt } : null,
    weight: weightReading && weightValue !== null && Number.isFinite(weightValue) && weightValue > 0 ? { value: weightValue, unit: "lb", date: weightReading.measuredAt } : null,
  };
}
