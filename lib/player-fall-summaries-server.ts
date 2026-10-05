import "server-only";
import type { requireAccess } from "@/lib/auth";
import { loadLeaderboard } from "@/lib/leaderboard-server";
import { isFullSwingFallSummaryMetric, normalizePlayerMetric, type PlayerFallSummary, type PlayerMetricKey } from "@/lib/player-performance";
import type { LeaderboardSelection } from "@/lib/leaderboards";
import type { Measurement } from "@/lib/imports/engine";

type Access = Awaited<ReturnType<typeof requireAccess>>;

/**
 * Full Swing Fall best / reading-weighted Fall average for one player, read from the same signed-in
 * leaderboard projection the team boards use, so a profile card and its leaderboard always agree.
 * Only this player's value and the board's numeric values (for the team mean and percentile) are kept.
 */
export async function loadPlayerFallSummaries(access: Access, athleteCode: string, measurements: readonly Measurement[]): Promise<PlayerFallSummary[]> {
  // Only the boards this player has saved Fall readings for; one failed board never hides the others.
  const selections = new Map<string, LeaderboardSelection>();
  for (const reading of measurements) {
    const metric = normalizePlayerMetric(reading.metric, reading.unit), source = reading.source.trim().toLowerCase().replace(/\s+/g, " ");
    if (!metric || !isFullSwingFallSummaryMetric(metric.key) || !/^full swing · (game|intrasquad|practice)$/.test(source) || reading.measured_at < "2026-09-01" || reading.measured_at > "2026-12-31") continue;
    selections.set(JSON.stringify([metric.key, source, metric.unit]), { metricKey: metric.key as LeaderboardSelection["metricKey"], source, unit: metric.unit, period: "fall_2026" });
  }
  const boards = await Promise.all([...selections.values()].map(async option => ({ option, rows: await loadLeaderboard(access, option).catch(() => []) })));
  return boards.flatMap(({ option, rows }) => {
    const own = rows.find(row => row.athleteCode === athleteCode);
    if (!own) return [];
    return [{ metricKey: option.metricKey as PlayerMetricKey, source: option.source, unit: option.unit, value: own.value, bestDate: own.measuredAt,
      pooled: own.derived, sampleCount: own.sampleCount ?? null, sampleUnit: own.sampleUnit ?? null, teamValues: rows.map(row => row.value) }];
  });
}
