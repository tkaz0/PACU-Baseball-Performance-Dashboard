import type { AthleteSeason } from "@/lib/types";
import { TIMED_METRIC_KEYS, isVisibleProfileMetric, normalizePlayerMetric, type PlayerMetricCard, type PlayerPerformance } from "@/lib/player-performance";
export const PHYSICALITY_PRIMARY = ["weight", "height", "grip_strength", "grip_dominant", "grip_non_dominant"] as const;
export const HITTING_PRIMARY = ["max_exit_velocity", "avg_exit_velocity", "max_bat_speed", "avg_bat_speed", "smash_factor", "max_distance"] as const;
export const SPEED_AGILITY = TIMED_METRIC_KEYS;
export const PITCHING_PRIMARY = ["max_pitch_velocity", "avg_pitch_velocity", "strike_pct", "avg_fastball_spin", "k_pct", "bb_pct"] as const;
const infield = new Set(["1B", "2B", "3B", "SS", "IF"]), outfield = new Set(["LF", "CF", "RF", "OF"]);
const ordered = (cards: PlayerMetricCard[], keys: readonly string[]) => keys.flatMap(key => cards.filter(card => card.metric.key === key));
function testingRole(season?: AthleteSeason | null) {
  const positions = [season?.primary_position, season?.secondary_position].filter((p): p is string => typeof p === "string").map(p => p.trim().toUpperCase());
  const playerType = season?.player_type?.trim().toLowerCase();
  const pitches = playerType === "pitcher" || playerType === "two_way" || positions.includes("P");
  return { positions, pitches, positionTesting: playerType === "two_way" || !pitches };
}
/** Filter profile history only; saved speed readings and team comparisons stay unchanged. */
export function profileMeasurementVisible(reading: { metric: string; unit: string }, season?: AthleteSeason | null): boolean {
  const key = normalizePlayerMetric(reading.metric, reading.unit)?.key ?? "";
  return isVisibleProfileMetric(key) && (testingRole(season).positionTesting || !(SPEED_AGILITY as readonly string[]).includes(key));
}
/** Presentation only: do not change metric groups, source periods, units or comparisons. */
export function getPlayerProfileLayout(performance: PlayerPerformance, season?: AthleteSeason | null) {
  const all = Object.values(performance).flat().filter(card => card.latest && isVisibleProfileMetric(card.metric.key));
  const { positions, pitches, positionTesting } = testingRole(season);
  const fieldKeys = [...(positions.some(p => infield.has(p)) ? ["infield_velocity"] : []), ...(positions.some(p => outfield.has(p)) ? ["outfield_velocity"] : [])];
  return {
    showHitting: positionTesting,
    physicality: ordered(all, PHYSICALITY_PRIMARY),
    additionalBody: all.filter(card => card.metric.group === "body" && card.metric.key !== "skeletal_muscle_mass" && card.metric.key !== "body_score" && card.metric.key !== "muscle_mass_pct" && !(PHYSICALITY_PRIMARY as readonly string[]).includes(card.metric.key)),
    speedAgility: positionTesting ? ordered(all, SPEED_AGILITY) : [],
    hitting: ordered(all, HITTING_PRIMARY),
    // Existing generic bat speed is not relabeled as a max or average.
    otherHitting: all.filter(card => card.metric.group === "hitting" && !new Set<string>([...HITTING_PRIMARY, ...SPEED_AGILITY]).has(card.metric.key)),
    fieldThrowing: ordered(all, fieldKeys),
    pitching: pitches ? ordered(all, PITCHING_PRIMARY) : [],
    hasThrowingRole: pitches || fieldKeys.length > 0,
  };
}

/** Explicit live-session sources; unknown source labels remain in testing with their original label. */
export function profileSessionContext(source: string): "in_game" | "practice" {
  return /^full swing\s*·\s*(game|intrasquad)$/i.test(source.trim()) ? "in_game" : "practice";
}
export function getSessionPerformance(performance: PlayerPerformance, context: "in_game" | "practice"): PlayerPerformance {
  const filter = (cards: PlayerMetricCard[]) => cards.flatMap(card => card.sourceCards ?? [card])
    .filter(card => card.latest && profileSessionContext(card.latest.source) === context);
  return { body: [], hitting: filter(performance.hitting), pitching: filter(performance.pitching), throwing: filter(performance.throwing) };
}
