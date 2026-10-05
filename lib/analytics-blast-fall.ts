import { blastFallSummary } from "@/lib/blast-fall";
import { BLAST_FALL_SOURCE, BLAST_REPORT_METRICS, parseBlastSource } from "@/lib/blast-metrics";
import type { Measurement } from "@/lib/imports/engine";
import type { AnalyticsReading } from "@/lib/analytics";

/** Staff-scoped projection; file identities/counts never leave the server. */
export function analyticsBlastFallReadings(readings: readonly AnalyticsReading[], measurements: readonly Measurement[], today: string): AnalyticsReading[] {
  const output = readings.filter(row => !parseBlastSource(row.source));
  const eligible = measurements.filter(row => { const period = parseBlastSource(row.source); return period?.kind === "average" && period.end <= today; });
  const keys = BLAST_REPORT_METRICS.filter(metric => metric.unit !== "count").map(metric => metric.key);
  for (const athleteId of new Set(eligible.map(row => row.athlete_code))) {
    const own = eligible.filter(row => row.athlete_code === athleteId);
    const summary = blastFallSummary(own, keys);
    if (!summary?.lastDate || summary.totalSwings === null) continue;
    for (const metric of summary.metrics) {
      if (metric.average === null) continue;
      const definition = BLAST_REPORT_METRICS.find(row => row.key === metric.key)!;
      const template = readings.filter(row => row.athleteId === athleteId && row.metric === metric.key && row.unit === metric.unit && parseBlastSource(row.source)?.kind === "average" && row.date <= today).sort((a,b) => b.importedAt.localeCompare(a.importedAt))[0];
      if (!template) continue;
      output.push({ ...template, id: `blast-fall:${athleteId}:${metric.key}:${metric.unit}`, label: definition.label, source: BLAST_FALL_SOURCE, date: summary.lastDate, value: metric.average, basis: "fall-average" });
    }
  }
  return output;
}
