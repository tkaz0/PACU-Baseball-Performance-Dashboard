import { MIDDLE_DIRECTION_DEGREES } from "@/lib/spray-zones";

/**
 * Descriptive batted-ball mix from saved Full Swing contact (owner request, October 9).
 * Launch-angle types use the standard MLB Statcast ranges: ground ball below 10°, line drive
 * 10–25°, fly ball 25–50°, pop-up above 50°. Direction zones reuse the spray map's ±15° middle.
 * These describe how the ball left the bat; they are not hit outcomes.
 */
export type BattedBallReading = { launchAngle: number; direction: number | null };
export type BattedBallType = "ground" | "line" | "fly" | "popup";
export const BATTED_BALL_TYPES: readonly { key: BattedBallType; label: string; range: string }[] = [
  { key: "ground", label: "Ground Ball", range: "below 10°" },
  { key: "line", label: "Line Drive", range: "10–25°" },
  { key: "fly", label: "Fly Ball", range: "25–50°" },
  { key: "popup", label: "Pop-Up", range: "above 50°" },
];

export function battedBallType(angle: number): BattedBallType {
  return angle < 10 ? "ground" : angle < 25 ? "line" : angle <= 50 ? "fly" : "popup";
}

export function battedBallProfile(rows: readonly BattedBallReading[], bats: string | null | undefined) {
  const valid = rows.filter(row => Number.isFinite(row.launchAngle) && Math.abs(row.launchAngle) <= 90);
  const types = BATTED_BALL_TYPES.map(type => {
    const count = valid.filter(row => battedBallType(row.launchAngle) === type.key).length;
    return { ...type, count, pct: valid.length ? 100 * count / valid.length : 0 };
  });
  const side = bats?.trim().toUpperCase();
  const battingSide = side === "R" || side === "L" ? side : null;
  const directed = valid.filter((row): row is BattedBallReading & { direction: number } => row.direction !== null && Number.isFinite(row.direction) && Math.abs(row.direction) <= 90);
  const zoneOf = (direction: number) => direction < -MIDDLE_DIRECTION_DEGREES ? "third" : direction > MIDDLE_DIRECTION_DEGREES ? "first" : "middle";
  const pullZone = battingSide === "R" ? "third" : battingSide === "L" ? "first" : null;
  const order = battingSide === "L" ? ["first", "middle", "third"] as const : ["third", "middle", "first"] as const;
  const zones = order.map(zone => {
    const count = directed.filter(row => zoneOf(row.direction) === zone).length;
    const label = pullZone ? zone === "middle" ? "Middle" : zone === pullZone ? "Pull" : "Opposite" : zone === "middle" ? "Middle" : zone === "third" ? "Third-base side" : "First-base side";
    return { zone, label, count, pct: directed.length ? 100 * count / directed.length : 0 };
  });
  // Air balls are line drives, fly balls and pop-ups (10° and up) hit to the pull side.
  const airPull = pullZone ? directed.filter(row => row.launchAngle >= 10 && zoneOf(row.direction) === pullZone).length : null;
  return {
    count: valid.length, types, battingSide,
    directedCount: directed.length, zones,
    airPull, airPullPct: airPull === null || !directed.length ? null : 100 * airPull / directed.length,
  };
}
