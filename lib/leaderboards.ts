import { PLAYER_METRICS, type PlayerMetricDefinition, type PlayerMetricKey, type PlayerPerformancePeriod } from "@/lib/player-performance";

export type LeaderboardMetricKey = PlayerMetricKey;
export type LeaderboardMetricDefinition = Omit<PlayerMetricDefinition, "key"> & { key: LeaderboardMetricKey };
export const LEADERBOARD_METRICS: readonly LeaderboardMetricDefinition[] = PLAYER_METRICS;

export const LEADERBOARD_GROUPS = ["physicality", "hitting", "throwing"] as const;
export type LeaderboardGroup = (typeof LEADERBOARD_GROUPS)[number];
export type LeaderboardComparison = { metricKey: LeaderboardMetricKey; source: string; unit: string; period: PlayerPerformancePeriod; athleteCount: number };
export type LeaderboardSelection = Omit<LeaderboardComparison, "athleteCount">;
export type LeaderboardRow = { rank: number; athleteCode: string; name: string; jerseyNumber: number | null; position: string | null; profileId: string | null; value: number; measuredAt: string; source: string; derived: boolean };
export const leaderboardGroupLabels: Record<LeaderboardGroup, string> = { physicality: "Physicality", hitting: "Hitting", throwing: "Throwing" };
const physicality = new Set(["body_score", "height", "weight", "grip_strength", "body_fat_pct", "muscle_mass_pct", "muscle_mass", "home_to_first", "home_to_second", "steal_break", "boxer_t"]);
export function leaderboardGroup(metric: LeaderboardMetricDefinition): LeaderboardGroup {
  return physicality.has(metric.key) ? "physicality" : metric.group === "hitting" ? "hitting" : "throwing";
}
export const leaderboardMetrics = (group: LeaderboardGroup) => LEADERBOARD_METRICS.filter(metric => metric.key !== "muscle_mass_pct" && leaderboardGroup(metric) === group).sort((a, b) => {
  const order = ["body_score", "height", "weight", "muscle_mass", "body_fat_pct", "grip_strength"];
  return (order.indexOf(a.key) < 0 ? 99 : order.indexOf(a.key)) - (order.indexOf(b.key) < 0 ? 99 : order.indexOf(b.key));
});
export const leaderboardSourceLabel = (source: string) => ({ renpho: "RENPHO", "full swing": "Full Swing", blast: "Blast", rapsodo: "Rapsodo", "player metrics": "Player Metrics" })[source] ?? source;
export const leaderboardMetricLabel = (metric: LeaderboardMetricDefinition) => ({ max_exit_velocity: "Max Exit Velocity", avg_exit_velocity: "Average Exit Velocity", bat_speed: "Bat Speed (Unspecified)", k_pct: "Strikeout %", bb_pct: "Walk %" } as Partial<Record<LeaderboardMetricKey, string>>)[metric.key] ?? metric.label;

/** Owner-selected numerical ordering; profile insight directions remain separate. */
export function leaderboardOrder(metric: LeaderboardMetricDefinition): "higher" | "lower" {
  if (metric.key === "height" || metric.key === "muscle_mass_pct") return "higher";
  return metric.key === "body_fat_pct" || metric.direction === "lower" ? "lower" : "higher";
}
export function leaderboardOrderLabel(metric: LeaderboardMetricDefinition): string {
  return metric.key === "height" ? "Tallest First" : leaderboardOrder(metric) === "lower" ? "Lowest First" : "Highest First";
}

/** One honest comparison per metric, without pooling source, unit or testing period. */
export function visibleLeaderboardComparisons(group: LeaderboardGroup, options: readonly LeaderboardComparison[]): LeaderboardComparison[] {
  return leaderboardMetrics(group).flatMap(metric => {
    const candidates = options.filter(option => option.metricKey === metric.key && option.athleteCount > 0 && metric.units.includes(option.unit) && (option.period === "fall_2026" || (metric.group === "body" && option.period === "summer_2026")));
    candidates.sort((a, b) => Number(b.period === "fall_2026") - Number(a.period === "fall_2026")
      || b.athleteCount - a.athleteCount
      || metric.units.indexOf(a.unit) - metric.units.indexOf(b.unit)
      || (a.source < b.source ? -1 : a.source > b.source ? 1 : 0));
    return candidates[0] ? [candidates[0]] : [];
  });
}
export function leaderboardTestDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
export function leaderboardComparisonMatches(a: LeaderboardSelection, b: LeaderboardSelection): boolean {
  return a.metricKey === b.metricKey && a.source === b.source && a.unit === b.unit && a.period === b.period;
}
export function initialLeaderboardSelection(group: LeaderboardGroup, options: readonly LeaderboardComparison[], query: Record<string, string | string[] | undefined>): LeaderboardSelection {
  const metrics = leaderboardMetrics(group);
  const requestedMetric = metrics.find(metric => metric.key === query.metric);
  const period = query.period === "summer_2026" ? "summer_2026" : "fall_2026";
  const metric = requestedMetric ?? metrics.find(metric => options.some(option => option.metricKey === metric.key && option.period === period)) ?? metrics[0];
  const permittedPeriod = metric.group === "body" ? period : "fall_2026";
  const candidates = options.filter(option => option.metricKey === metric.key && option.period === permittedPeriod);
  const unit = metric.units.includes(typeof query.unit === "string" ? query.unit : "") ? query.unit as string : candidates[0]?.unit ?? metric.units[0];
  const source = candidates.find(option => option.unit === unit && option.source === query.source)?.source ?? candidates.find(option => option.unit === unit)?.source ?? "";
  return { metricKey: metric.key, period: permittedPeriod, unit, source };
}
