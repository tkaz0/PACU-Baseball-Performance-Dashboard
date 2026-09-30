import { UUID_PATTERN, type AthleteSeason, type Role } from "@/lib/types";

export type DesignNavigation = { swing: boolean; pitch: boolean };
export type DesignSeason = Pick<AthleteSeason, "season" | "player_type" | "primary_position" | "secondary_position">;
const fieldPositions = new Set(["C", "1B", "2B", "3B", "SS", "IF", "INF", "LF", "CF", "RF", "OF", "DH", "UT", "UTIL"]);

/** Current verified roster role only. Missing or unfamiliar roles do not imply a hitter. */
export function seasonDesignNavigation(season?: DesignSeason | null): DesignNavigation {
  if (season?.season !== "2026-27") return { swing: false, pitch: false };
  const type = season.player_type?.trim().toLowerCase();
  const positions = [season.primary_position, season.secondary_position].map(position => position?.trim().toUpperCase());
  if (type === "two_way") return { swing: true, pitch: true };
  if (type === "pitcher" || positions.includes("P")) return { swing: false, pitch: true };
  return { swing: type === "position" || positions.some(position => !!position && fieldPositions.has(position)), pitch: false };
}

/** Navigation is cosmetic; destination pages independently enforce trusted scope. */
export function presentedDesignNavigation(access: { roles: Role[]; athleteId: string | null }, season?: DesignSeason | null): DesignNavigation {
  if (access.roles.some(role => role === "admin" || role === "coach")) return { swing: true, pitch: true };
  if (!access.roles.includes("player") || !access.athleteId || !UUID_PATTERN.test(access.athleteId)) return { swing: false, pitch: false };
  return seasonDesignNavigation(season);
}
