import { gameDirection, type GameComparison, type GameLeaderboardRow } from "@/lib/game-metrics";
import { qualifiedGameCodes } from "@/lib/game-qualification";

/**
 * Owner request (October 21): game-stat percentiles rank only qualified players: 2 PA (hitting) or
 * 1 IP (pitching) per confirmed Fall Ball week so far, the same minimum as the Qualified leaderboard view.
 * An unqualified player's percentile is withheld and marked Not qualified; everyone else is re-ranked
 * among qualified teammates with the database's midrank convention:
 *   100 × (worse + (ties − 1) / 2) / (n − 1), n ≥ 5, lower-is-better stats reversed.
 * Leaderboard ranks stay inclusive; only percentiles change. Values are never altered.
 */
export function qualifiedGameComparisons(comparisons: readonly GameComparison[], board: readonly GameLeaderboardRow[], athleteId: string, weeks: number): GameComparison[] {
  const own = board.find(row => row.profileId === athleteId)?.code;
  const disciplines = {
    qpa_fall_2026: qualifiedGameCodes(board.filter(row => row.source === "qpa_fall_2026"), "hitting", weeks),
    pitching_fall_2026: qualifiedGameCodes(board.filter(row => row.source === "pitching_fall_2026"), "pitching", weeks),
  } as const;
  return comparisons.map(c => {
    const rule = disciplines[c.source as keyof typeof disciplines];
    // Not on the eligible team boards (or an unknown source): no qualified cohort, so no percentile.
    if (!rule || !own) return { ...c, percentile: null };
    if (!rule.codes.has(own)) return { ...c, percentile: null, qualified: false, qualifiedMinimum: rule.label };
    const group = board.filter(row => row.source === c.source && row.eventId === c.eventId && row.metric === c.metric && rule.codes.has(row.code) && Number.isFinite(row.value));
    const mine = group.filter(row => row.code === own);
    if (mine.length !== 1 || Math.abs(mine[0].value - c.value) > 1e-10 || new Set(group.map(row => row.code)).size !== group.length) return { ...c, percentile: null, qualified: true, qualifiedMinimum: rule.label, sampleSize: group.length };
    const lower = gameDirection(c.source, c.metric) === "lower", n = group.length, v = c.value;
    const worse = group.filter(row => lower ? row.value > v : row.value < v).length, ties = group.filter(row => row.value === v).length;
    return { ...c, qualified: true, qualifiedMinimum: rule.label, sampleSize: n, percentile: n >= 5 ? 100 * (worse + (ties - 1) / 2) / (n - 1) : null };
  });
}
