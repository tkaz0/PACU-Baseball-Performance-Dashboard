import type { AthleteSeason } from "@/lib/types";
import { normalizePlayerMetric, type PlayerMetricCard, type PlayerPerformance } from "@/lib/player-performance";
export const PHYSICALITY_PRIMARY = ["weight", "height", "grip_strength"] as const;
export const HITTING_PRIMARY = ["max_exit_velocity", "avg_exit_velocity", "max_bat_speed", "avg_bat_speed", "smash_factor", "max_distance"] as const;
export const SPEED_AGILITY = ["home_to_first", "home_to_second", "steal_break", "boxer_t"] as const;
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
  return testingRole(season).positionTesting || !(SPEED_AGILITY as readonly string[]).includes(normalizePlayerMetric(reading.metric, reading.unit)?.key ?? "");
}
/** Presentation only: do not change metric groups, source periods, units or comparisons. */
export function getPlayerProfileLayout(performance: PlayerPerformance, season?: AthleteSeason | null) {
  const all = Object.values(performance).flat();
  const { positions, pitches, positionTesting } = testingRole(season);
  const fieldKeys = [...(positions.some(p => infield.has(p)) ? ["infield_velocity"] : []), ...(positions.some(p => outfield.has(p)) ? ["outfield_velocity"] : [])];
  return {
    showHitting: positionTesting,
    physicality: ordered(all, PHYSICALITY_PRIMARY),
    additionalBody: performance.body.filter(card => !(PHYSICALITY_PRIMARY as readonly string[]).includes(card.metric.key)),
    speedAgility: positionTesting ? ordered(all, SPEED_AGILITY) : [],
    hitting: ordered(all, HITTING_PRIMARY),
    // Existing generic bat speed is not relabeled as a max or average.
    otherHitting: performance.hitting.filter(card => card.latest && !new Set<string>([...HITTING_PRIMARY, ...SPEED_AGILITY]).has(card.metric.key)),
    fieldThrowing: ordered(all, fieldKeys),
    pitching: pitches ? ordered(all, PITCHING_PRIMARY) : [],
    hasThrowingRole: pitches || fieldKeys.length > 0,
  };
}
