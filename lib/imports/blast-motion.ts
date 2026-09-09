import { previewMeasurements, type FileContext, type ImportTable, type MeasurementMapping, type MeasurementPreview } from "@/lib/imports/engine";
import { prepareReviewedPerformanceRows } from "@/lib/performance-import";
import { PLAYER_METRICS } from "@/lib/player-performance";
import type { RosterAthlete } from "@/lib/types";

export const BLAST_MOTION_METRICS = PLAYER_METRICS.filter(metric => ["max_bat_speed", "avg_bat_speed"].includes(metric.key));

/** Explicit summary columns, independent of vendor header spelling. No guessed raw-swing aggregation. */
export function previewBlastMotionSummary(input: {
  table: ImportTable; mapping: MeasurementMapping; roster: RosterAthlete[];
  file: FileContext; summaryConfirmed: boolean;
}): MeasurementPreview {
  if (!input.summaryConfirmed) throw new Error("Confirm that each row contains one player's session summaries. Individual swings must be summarized before using this importer.");
  if (!input.file.fileName.toLowerCase().endsWith(".csv")) throw new Error("Choose a Blast Motion CSV.");
  const mapped = new Set<string>();
  for (const metric of input.mapping.metrics) {
    const definition = BLAST_MOTION_METRICS.find(item => item.label === metric.label);
    if (!definition || !definition.units.includes(metric.unit)) throw new Error("Choose Max Bat Speed or Average Bat Speed and the original speed unit.");
    if (mapped.has(definition.key)) throw new Error("Map each Blast measurement only once.");
    mapped.add(definition.key);
  }
  const preview = previewMeasurements(input.table, { ...input.mapping, source: "Blast Motion · Hitting" }, input.roster, [], input.file);
  if (preview.candidateMeasurements.length > 500) throw new Error("Review at most 500 readings in one import. Split the CSV into smaller batches.");
  const seen = new Set<string>();
  for (const row of preview.candidateMeasurements) {
    if (row.measured_at < "2026-09-01" || row.measured_at > "2026-12-31") throw new Error("Use Fall 2026 test dates, September 1 through December 31.");
    const key = JSON.stringify([row.athlete_code, row.measured_at, row.metric]);
    if (seen.has(key)) throw new Error("Multiple summaries have the same player, date, and measurement. Review sessions before importing. Individual swings cannot be labeled as session averages or maximums.");
    seen.add(key);
    if (row.metric === "Average Bat Speed") {
      const maximum = preview.candidateMeasurements.find(item => item.athlete_code === row.athlete_code && item.measured_at === row.measured_at && item.metric === "Max Bat Speed" && item.unit === row.unit);
      if (maximum && row.value > maximum.value) throw new Error("Average Bat Speed cannot exceed Max Bat Speed for the same session. Check the columns.");
    }
  }
  if (preview.canApply) prepareReviewedPerformanceRows(preview.candidateMeasurements);
  return preview;
}
