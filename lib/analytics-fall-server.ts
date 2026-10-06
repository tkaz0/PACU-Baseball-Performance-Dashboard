import "server-only";
import type { requireAccess } from "@/lib/auth";
import { variableKey, type AnalyticsPlayer, type AnalyticsReading } from "@/lib/analytics";
import { loadLeaderboards } from "@/lib/leaderboard-server";
import { LEADERBOARD_METRICS, type LeaderboardComparison, type LeaderboardRow } from "@/lib/leaderboards";
import { pacificTestingDate } from "@/lib/testing-checklist";

const fallMetrics = new Set([
  "max_exit_velocity", "avg_exit_velocity", "max_bat_speed", "avg_bat_speed", "max_distance",
  "max_pitch_velocity", "avg_pitch_velocity", "infield_velocity", "outfield_velocity",
  "classified_avg_velocity", "classified_max_velocity", "classified_avg_spin", "classified_max_spin",
]);
const sourceKey = (source: string) => source.trim().toLowerCase().replace(/\s+/g, " ");

/** Reuse the validated leaderboard calculation, including likely-foul exclusions and
 * metric-specific counts. Never average file averages or substitute a max for an average.
 * Only numerical results for the already-authorized roster leave this server reader.
 */
export async function loadAnalyticsFallReadings(
  access: Awaited<ReturnType<typeof requireAccess>>,
  players: readonly Pick<AnalyticsPlayer, "id" | "code">[],
  readings: readonly AnalyticsReading[],
): Promise<AnalyticsReading[]> {
  const today = pacificTestingDate();
  const candidates = readings.filter(row => fallMetrics.has(row.metric) &&
    /^full swing · (?:game|intrasquad|practice)(?: · .+)?$/.test(sourceKey(row.source)) &&
    row.date >= "2026-09-01" && row.date <= "2026-12-31" && row.date <= today);
  const comparisons = new Map<string, LeaderboardComparison>();
  const templates = new Map<string, AnalyticsReading>();
  for (const row of candidates) {
    const metric = LEADERBOARD_METRICS.find(metric => metric.key === row.metric && metric.units.includes(row.unit));
    if (!metric) throw new Error("Analytics Fall metric could not be verified.");
    const key = variableKey(row);
    comparisons.set(key, { metricKey: metric.key, source: sourceKey(row.source), unit: row.unit, period: "fall_2026", athleteCount: 1 });
    const templateKey = JSON.stringify([row.athleteId, key]), old = templates.get(templateKey);
    if (!old || row.importedAt > old.importedAt) templates.set(templateKey, row);
  }
  // Four in flight, drained on failure. A failed board must not quietly resurrect
  // the old single-session values in an apparently successful Analytics page.
  const selections = [...comparisons.values()], results = await loadLeaderboards(access, selections);
  if (results.some(result => result instanceof Error)) throw new Error("Analytics Fall leaderboards could not be loaded.");
  const panels = selections.map((comparison, index) => ({ comparison, rows: results[index] as LeaderboardRow[] }));
  const ids = new Map(players.map(player => [player.code, player.id]));
  const summaries: AnalyticsReading[] = [];
  for (const { comparison, rows } of panels) {
    const key = JSON.stringify([comparison.metricKey, comparison.unit, comparison.source]);
    for (const result of rows) {
      const athleteId = ids.get(result.athleteCode);
      const template = athleteId ? templates.get(JSON.stringify([athleteId, key])) : undefined;
      if (!template || result.measuredAt > today) continue;
      summaries.push({ ...template, id: JSON.stringify(["analytics-fall", athleteId, key]),
        value: result.value, date: result.measuredAt,
        basis: comparison.metricKey.startsWith("avg_") || comparison.metricKey.startsWith("classified_avg_")
          ? result.derived ? "fall-average" : "latest-session" : "fall-best" });
    }
  }
  return [...readings.filter(row => !(row.date >= "2026-09-01" && row.date <= "2026-12-31" && comparisons.has(variableKey(row)))), ...summaries];
}
