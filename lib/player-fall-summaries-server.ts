import "server-only";
import type { requireAccess } from "@/lib/auth";
import { loadLeaderboard } from "@/lib/leaderboard-server";
import { FULL_SWING_FALL_SUMMARY_KEYS, type PlayerFallSummary, type PlayerMetricKey } from "@/lib/player-performance";

type Access = Awaited<ReturnType<typeof requireAccess>>;
const SOURCES = ["full swing · game", "full swing · intrasquad", "full swing · practice"] as const;

/**
 * Full Swing Fall best / reading-weighted Fall average for one player, read from the same signed-in
 * leaderboard projection the team boards use, so a profile card and its leaderboard always agree.
 * Only this player's value and the board's numeric values (for the team mean and percentile) are kept.
 */
export async function loadPlayerFallSummaries(access: Access, athleteCode: string): Promise<PlayerFallSummary[]> {
  // Query the fixed boards directly (an empty source returns no rows); one failed board never hides the others.
  const selections = FULL_SWING_FALL_SUMMARY_KEYS.flatMap(metricKey => SOURCES.map(source => ({ metricKey, source, unit: metricKey === "max_distance" ? "ft" : "mph", period: "fall_2026" as const })));
  const boards = await Promise.all(selections.map(async option => ({ option, rows: await loadLeaderboard(access, option).catch(() => []) })));
  return boards.flatMap(({ option, rows }) => {
    const own = rows.find(row => row.athleteCode === athleteCode);
    if (!own) return [];
    return [{ metricKey: option.metricKey as PlayerMetricKey, source: option.source, unit: option.unit, value: own.value, bestDate: own.measuredAt,
      pooled: own.derived, sampleCount: own.sampleCount ?? null, sampleUnit: own.sampleUnit ?? null, teamValues: rows.map(row => row.value) }];
  });
}
