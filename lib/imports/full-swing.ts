import { previewMeasurements, type FileContext, type ImportTable, type MeasurementMapping, type MeasurementPreview } from "@/lib/imports/engine";
import { prepareReviewedPerformanceRows } from "@/lib/performance-import";
import { PLAYER_METRICS, type PlayerMetricDefinition } from "@/lib/player-performance";
import type { RosterAthlete } from "@/lib/types";

export type FullSwingCategory = "hitting" | "pitching" | "game" | "intrasquad";
export const FULL_SWING_LABELS: Record<FullSwingCategory, string> = {
  hitting: "Hitting", pitching: "Pitching", game: "Game", intrasquad: "Intrasquad",
};
const hittingKeys = ["max_exit_velocity", "avg_exit_velocity", "bat_speed", "max_bat_speed", "avg_bat_speed", "smash_factor", "max_distance"];
const pitchingKeys = ["max_pitch_velocity", "avg_pitch_velocity", "avg_fastball_spin", "strike_pct", "k_pct", "bb_pct"];
export function fullSwingMetrics(category: FullSwingCategory): PlayerMetricDefinition[] {
  const keys = category === "hitting" ? hittingKeys : category === "pitching" ? pitchingKeys : [...hittingKeys, ...pitchingKeys];
  return PLAYER_METRICS.filter(metric => keys.includes(metric.key));
}

/** Explicitly reviewed summary columns only; this is not a guessed vendor export schema. */
export function previewFullSwingSummary(input: {
  table: ImportTable; mapping: MeasurementMapping; roster: RosterAthlete[];
  file: FileContext; category: FullSwingCategory; summaryConfirmed: boolean;
}): MeasurementPreview {
  if (!Object.hasOwn(FULL_SWING_LABELS, input.category)) throw new Error("Choose Hitting, Pitching, Game, or Intrasquad.");
  if (!input.summaryConfirmed) throw new Error("Confirm that each row contains one player's session summaries. Individual swings or pitches need a separate adapter.");
  if (!input.file.fileName.toLowerCase().endsWith(".csv")) throw new Error("Choose a CSV file for Full Swing.");
  const allowed = fullSwingMetrics(input.category);
  const metricKeys = new Set<string>();
  for (const mapped of input.mapping.metrics) {
    const definition = allowed.find(metric => metric.label === mapped.label);
    if (!definition || !definition.units.includes(mapped.unit)) throw new Error("Choose a listed profile metric and its original unit.");
    if (metricKeys.has(definition.key)) throw new Error("Map each profile metric only once.");
    metricKeys.add(definition.key);
  }
  const preview = previewMeasurements(input.table, {
    ...input.mapping, source: `Full Swing · ${FULL_SWING_LABELS[input.category]}`,
  }, input.roster, [], input.file);
  if (preview.candidateMeasurements.length > 500) throw new Error("Review at most 500 readings in one import. Split this CSV into smaller batches.");
  const seen = new Set<string>();
  for (const row of preview.candidateMeasurements) {
    if (row.measured_at < "2026-09-01" || row.measured_at > "2026-12-31") throw new Error("Use Fall 2026 test dates, September 1 through December 31.");
    const key = JSON.stringify([row.athlete_code, row.measured_at, row.metric]);
    if (seen.has(key)) throw new Error("More than one summary appears for the same player, date, and metric. Review the sessions before importing; individual swings and pitches cannot be labeled as a maximum or average.");
    seen.add(key);
  }
  for (const [averageLabel, maximumLabel] of [["Average EV", "Max EV"], ["Average Bat Speed", "Max Bat Speed"], ["Average Velocity", "Max Velocity"]]) {
    for (const row of preview.candidateMeasurements.filter(item => item.metric === averageLabel)) {
      const maximum = preview.candidateMeasurements.find(item => item.athlete_code === row.athlete_code && item.measured_at === row.measured_at && item.metric === maximumLabel && item.unit === row.unit);
      if (maximum && row.value > maximum.value) throw new Error(`${averageLabel} cannot exceed ${maximumLabel} for the same player and session. Check those columns.`);
    }
  }
  if (preview.canApply) prepareReviewedPerformanceRows(preview.candidateMeasurements);
  return preview;
}
