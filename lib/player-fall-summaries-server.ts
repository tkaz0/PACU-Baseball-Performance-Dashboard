import "server-only";
import type { requireAccess } from "@/lib/auth";
import { loadLeaderboard, loadLeaderboardComparisons } from "@/lib/leaderboard-server";
import { isFullSwingFallSummaryMetric, type PlayerFallSummary, type PlayerMetricKey } from "@/lib/player-performance";

type Access = Awaited<ReturnType<typeof requireAccess>>;

/**
 * Full Swing Fall best / reading-weighted Fall average for one player, read from the same signed-in
 * leaderboard projection the team boards use, so a profile card and its leaderboard always agree.
 * Only this player's value and the board's numeric values (for the team mean and percentile) are kept.
 */
export async function loadPlayerFallSummaries(access: Access, athleteCode: string): Promise<PlayerFallSummary[]> {
  const options = (await loadLeaderboardComparisons(access)).filter(option => option.period === "fall_2026"
    && isFullSwingFallSummaryMetric(option.metricKey) && /^full swing · (game|intrasquad|practice)$/.test(option.source));
  const boards = await Promise.all(options.map(async option => ({ option, rows: await loadLeaderboard(access, option) })));
  return boards.flatMap(({ option, rows }) => {
    const own = rows.find(row => row.athleteCode === athleteCode);
    if (!own) return [];
    return [{ metricKey: option.metricKey as PlayerMetricKey, source: option.source, unit: option.unit, value: own.value, bestDate: own.measuredAt,
      pooled: own.derived, sampleCount: own.sampleCount ?? null, sampleUnit: own.sampleUnit ?? null, teamValues: rows.map(row => row.value) }];
  });
}
