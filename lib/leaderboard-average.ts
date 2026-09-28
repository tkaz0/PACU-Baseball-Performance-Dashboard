/** Equal weight per displayed athlete, within the caller's exact leaderboard partition. */
export function leaderboardAverage(values: readonly number[]) {
  const recorded = values.filter(Number.isFinite);
  if (!recorded.length) return null;
  const mean = recorded.reduce((sum, value) => sum + value / recorded.length, 0);
  return Number.isFinite(mean) ? { mean, count: recorded.length } : null;
}
