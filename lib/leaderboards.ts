import { parseBlastSource } from "@/lib/blast-metrics";
import { PITCH_TYPES } from "@/lib/imports/pitch-assignments";
import { TIMED_METRIC_KEYS, isVisibleProfileMetric, isTimedMetric, PLAYER_METRICS, type PlayerMetricDefinition, type PlayerMetricKey, type PlayerPerformancePeriod } from "@/lib/player-performance";

export const PITCH_LEADERBOARD_KEYS = ["classified_avg_velocity", "classified_max_velocity", "classified_avg_spin", "classified_max_spin"] as const;
export type PitchLeaderboardKey = typeof PITCH_LEADERBOARD_KEYS[number];
export const isPitchLeaderboardMetric = (key: string): key is PitchLeaderboardKey => (PITCH_LEADERBOARD_KEYS as readonly string[]).includes(key);
export type LeaderboardSession = "in_game" | "practice";
export const leaderboardSession = (source: string): LeaderboardSession => /^full swing\s*·\s*(game|intrasquad)(?:\s*·|$)/i.test(source.trim()) ? "in_game" : "practice";
export const leaderboardPitchType = (source: string) => { const type = source.split(" · ").at(-1); return PITCH_TYPES.find(pitch => pitch.toLowerCase() === type?.toLowerCase()); };
export type LeaderboardMetricKey = PlayerMetricKey | PitchLeaderboardKey;
export type LeaderboardMetricDefinition = Omit<PlayerMetricDefinition, "key"> & { key: LeaderboardMetricKey };
export const LEADERBOARD_METRICS: readonly LeaderboardMetricDefinition[] = [...PLAYER_METRICS,
  ...PITCH_LEADERBOARD_KEYS.map(key => ({ key, label: `${key.includes("_avg_") ? "Average" : "Max"} ${key.endsWith("spin") ? "Spin" : "Velocity"}`, group: "pitching" as const, units: [key.endsWith("spin") ? "rpm" : "mph"], direction: "neutral" as const })),
];
const pitchAbbreviation: Record<string,string> = { Fastball:"FB", "Four-Seam Fastball":"FB (4-Seam)", "Two-Seam Fastball":"FB (2-Seam)", "Breaking Ball":"BRK", Slider:"SL", Curveball:"CB", Changeup:"CH", Cutter:"CT", Sweeper:"SW", Sinker:"SI", Splitter:"SPL", Knuckleball:"KN", Other:"Other" };
export const pitchLeaderboardLabel = (metric: LeaderboardMetricDefinition, source: string) => `${pitchAbbreviation[leaderboardPitchType(source) ?? ""] ?? "Pitch"} · ${metric.label}`;

export const LEADERBOARD_GROUPS = ["physicality", "hitting", "pitching", "throwing"] as const;
export type LeaderboardGroup = (typeof LEADERBOARD_GROUPS)[number];
export type LeaderboardComparison = { metricKey: LeaderboardMetricKey; source: string; unit: string; period: PlayerPerformancePeriod; athleteCount: number };
export type LeaderboardSelection = Omit<LeaderboardComparison, "athleteCount">;
export type LeaderboardRow = { rank: number; athleteCode: string; name: string; jerseyNumber: number | null; position: string | null; profileId: string | null; value: number; measuredAt: string; source: string; derived: boolean; sampleCount?: number | null; sampleUnit?: "swings" | "pitches" | "trials" | null };
export const leaderboardGroupLabels: Record<LeaderboardGroup, string> = { physicality: "Physicality", hitting: "Hitting", pitching: "Pitching", throwing: "Position Throwing" };
const physicality = new Set(["skeletal_muscle_mass", "body_score", "height", "weight", "grip_strength", "grip_dominant", "grip_non_dominant", "body_fat_pct", "muscle_mass_pct", "muscle_mass", ...TIMED_METRIC_KEYS]);
export function leaderboardGroup(metric: LeaderboardMetricDefinition): LeaderboardGroup {
  return physicality.has(metric.key) ? "physicality" : metric.group === "hitting" ? "hitting" : metric.key === "infield_velocity" || metric.key === "outfield_velocity" ? "throwing" : "pitching";
}
export const leaderboardMetrics = (group: LeaderboardGroup) => LEADERBOARD_METRICS.filter(metric => isVisibleProfileMetric(metric.key) && metric.key !== "skeletal_muscle_mass" && metric.key !== "muscle_mass_pct" && leaderboardGroup(metric) === group && (group !== "pitching" || isPitchLeaderboardMetric(metric.key))).sort((a, b) => {
  const order = ["body_score", "height", "weight", "muscle_mass", "skeletal_muscle_mass", "body_fat_pct", "grip_strength", "grip_dominant", "grip_non_dominant"];
  return (order.indexOf(a.key) < 0 ? 99 : order.indexOf(a.key)) - (order.indexOf(b.key) < 0 ? 99 : order.indexOf(b.key));
});
export const leaderboardSourceLabel = (source: string) => source.split(" · ").map(part => ({ renpho: "RENPHO", "full swing": "Full Swing", blast: "Blast", rapsodo: "Rapsodo", "player metrics": "Player Metrics", game: "Game", intrasquad: "Intrasquad", practice: "Practice", hitting: "Hitting", pitching: "Pitching" })[part] ?? part).join(" · ");
export const leaderboardMetricLabel = (metric: LeaderboardMetricDefinition) => isTimedMetric(metric.key) ? `${metric.label} · Best Time` : ({ max_exit_velocity: "Max Exit Velocity", avg_exit_velocity: "Average Exit Velocity", bat_speed: "Bat Speed (Unspecified)", k_pct: "Strikeout %", bb_pct: "Walk %" } as Partial<Record<LeaderboardMetricKey, string>>)[metric.key] ?? metric.label;

/** Owner-selected numerical ordering; profile insight directions remain separate. */
export function leaderboardOrder(metric: LeaderboardMetricDefinition): "higher" | "lower" {
  if (metric.key === "height" || metric.key === "muscle_mass_pct") return "higher";
  return metric.key === "body_fat_pct" || metric.direction === "lower" ? "lower" : "higher";
}
export function leaderboardOrderLabel(metric: LeaderboardMetricDefinition): string {
  return metric.key === "height" ? "Tallest First" : leaderboardOrder(metric) === "lower" ? "Lowest First" : "Highest First";
}

/** Source keys are normalized by the reader; the Blast parser accepts its canonical export label. */
function latestBlastPeriodFirst(a: string, b: string): number {
  const parse = (source: string) => parseBlastSource(source.replace(/^blast motion · (average|p95) · /, (_, kind: string) => `Blast Motion · ${kind === "average" ? "Average" : "P95"} · `));
  const first = parse(a), second = parse(b);
  return first && second && first.kind === second.kind
    ? second.end.localeCompare(first.end) || second.start.localeCompare(first.start)
    : 0;
}

/** One honest comparison per metric, without pooling source, unit or testing period. */
export function visibleLeaderboardComparisons(group: LeaderboardGroup, options: readonly LeaderboardComparison[], session?: LeaderboardSession): LeaderboardComparison[] {
  return leaderboardMetrics(group).flatMap(metric => {
    const candidates = options.filter(option => option.metricKey === metric.key && (!session || group === "physicality" || leaderboardSession(option.source) === session) && option.athleteCount > 0 && metric.units.includes(option.unit) && (option.period === "fall_2026" || (metric.group === "body" && option.period === "summer_2026")));
    candidates.sort((a, b) => Number(b.period === "fall_2026") - Number(a.period === "fall_2026")
      || b.athleteCount - a.athleteCount
      || metric.units.indexOf(a.unit) - metric.units.indexOf(b.unit)
      || latestBlastPeriodFirst(a.source, b.source)
      || (a.source < b.source ? -1 : a.source > b.source ? 1 : 0));
    return isPitchLeaderboardMetric(metric.key) ? candidates.filter(option => leaderboardPitchType(option.source)) : candidates[0] ? [candidates[0]] : [];
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

/** Select one recorded pitch before fetching ranked player values. Keep source partitions intact. */
export function selectPitchLeaderboards(options: readonly LeaderboardComparison[], requested?: string) {
  const order = ["Fastball", "Four-Seam Fastball", "Two-Seam Fastball", "Sinker", "Cutter", "Slider", "Sweeper", "Curveball", "Breaking Ball", "Changeup", "Splitter", "Knuckleball", "Other"];
  const pitches = [...new Set(options.filter(o => isPitchLeaderboardMetric(o.metricKey)).flatMap(o => { const type = leaderboardPitchType(o.source); return type ? [type] : []; }))].sort((a,b) => order.indexOf(a)-order.indexOf(b));
  const selectedPitch = pitches.find(pitch => pitch === requested) ?? pitches[0];
  return { pitches, selectedPitch, comparisons: selectedPitch ? options.filter(o => isPitchLeaderboardMetric(o.metricKey) && leaderboardPitchType(o.source) === selectedPitch) : [] };
}
