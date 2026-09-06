import { PLAYER_METRICS, type PlayerMetricDefinition, type PlayerMetricKey, type PlayerPerformancePeriod } from "@/lib/player-performance";

export const LEADERBOARD_GROUPS = ["physicality", "hitting", "throwing"] as const;
export type LeaderboardGroup = (typeof LEADERBOARD_GROUPS)[number];
export type LeaderboardComparison = { metricKey: PlayerMetricKey; source: string; unit: string; period: PlayerPerformancePeriod; athleteCount: number };
export type LeaderboardSelection = Omit<LeaderboardComparison, "athleteCount">;
export type LeaderboardRow = { rank: number; athleteCode: string; name: string; jerseyNumber: number | null; position: string | null; profileId: string | null; value: number; measuredAt: string; source: string; derived: boolean };
export const leaderboardGroupLabels: Record<LeaderboardGroup, string> = { physicality: "Physicality", hitting: "Hitting", throwing: "Throwing" };
const physicality = new Set(["height", "weight", "grip_strength", "body_fat_pct", "muscle_mass_pct", "home_to_first", "home_to_second", "steal_break", "boxer_t"]);
export function leaderboardGroup(metric: PlayerMetricDefinition): LeaderboardGroup {
  return physicality.has(metric.key) ? "physicality" : metric.group === "hitting" ? "hitting" : "throwing";
}
export const leaderboardMetrics = (group: LeaderboardGroup) => PLAYER_METRICS.filter(metric => leaderboardGroup(metric) === group);
export const leaderboardSourceLabel = (source: string) => ({ renpho: "RENPHO", "full swing": "Full Swing", blast: "Blast", rapsodo: "Rapsodo", "player metrics": "Player Metrics" })[source] ?? source;
export const leaderboardMetricLabel = (metric: PlayerMetricDefinition) => ({ max_exit_velocity: "Max Exit Velocity", avg_exit_velocity: "Average Exit Velocity", bat_speed: "Bat Speed (Unspecified)", k_pct: "Strikeout %", bb_pct: "Walk %" } as Partial<Record<PlayerMetricKey, string>>)[metric.key] ?? metric.label;

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
