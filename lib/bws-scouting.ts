import { battedBallProfile, battedBallType } from "@/lib/batted-ball-profile";
import { isLikelyFoul } from "@/lib/likely-foul";
import { MIDDLE_DIRECTION_DEGREES, INFIELD_DISTANCE_FEET } from "@/lib/spray-zones";

/**
 * BWS scouting helpers (owner request, October 14; NW Baseball Stats "Defensive Alignments" idea).
 * Built only from saved in-game Full Swing batted balls. Directions are degrees from straight
 * away center: negative is the third-base side. Likely fouls are left out. These are tendencies
 * from a small Fall sample, never hit outcomes.
 */
export type ScoutContact = { exitVelocity: number; launchAngle: number; direction: number | null; distance: number | null; pitcherThrows: "R" | "L" | null };
export const ALIGNMENT_MIN_BALLS = 8;
const mean = (v: number[]) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;

export type AlignmentCall = { area: "Infield" | "Outfield"; call: string };
export function hitterAlignment(contacts: readonly ScoutContact[], bats: string | null | undefined) {
  const inPlay = contacts.filter(c => !isLikelyFoul(c) && Number.isFinite(c.launchAngle) && Math.abs(c.launchAngle) <= 90);
  const profile = battedBallProfile(inPlay, bats);
  const side = profile.battingSide;
  const directed = inPlay.filter((c): c is ScoutContact & { direction: number } => typeof c.direction === "number" && Math.abs(c.direction) <= 90);
  // Pull is the third-base side for righties and first-base side for lefties; switch/unknown stay field sides.
  const pull = (d: number) => side === "R" ? d < -MIDDLE_DIRECTION_DEGREES : side === "L" ? d > MIDDLE_DIRECTION_DEGREES : false;
  const oppo = (d: number) => side === "R" ? d > MIDDLE_DIRECTION_DEGREES : side === "L" ? d < -MIDDLE_DIRECTION_DEGREES : false;
  const grounders = directed.filter(c => battedBallType(c.launchAngle) === "ground"), air = directed.filter(c => c.launchAngle >= 10);
  const share = (rows: { direction: number }[], test: (d: number) => boolean) => rows.length ? rows.filter(r => test(r.direction)).length / rows.length : null;
  const calls: AlignmentCall[] = [];
  if (directed.length >= ALIGNMENT_MIN_BALLS && side) {
    const gbPull = share(grounders, pull), gbOppo = share(grounders, oppo);
    calls.push({ area: "Infield", call: grounders.length < 4 ? "Few grounders; straight up" : gbPull !== null && gbPull >= 0.6 ? "Shade to the pull side" : gbOppo !== null && gbOppo >= 0.4 ? "Shade to the opposite side" : "Straight up" });
    const airPull = share(air, pull), airOppo = share(air, oppo);
    const airDistance = mean(air.flatMap(c => c.distance !== null && c.distance >= INFIELD_DISTANCE_FEET ? [c.distance] : []));
    const depth = airDistance === null ? "" : airDistance >= 300 ? ", play deep" : airDistance < 230 ? ", play shallow" : "";
    calls.push({ area: "Outfield", call: air.length < 4 ? "Few balls in the air; straight up" : `${airPull !== null && airPull >= 0.5 ? "Shade to the pull side" : airOppo !== null && airOppo >= 0.4 ? "Shade to the opposite side" : "Straight up"}${depth}` });
  }
  const hard = inPlay.filter(c => c.exitVelocity >= 90).length;
  return { count: inPlay.length, directedCount: directed.length, profile, calls, avgEv: mean(inPlay.map(c => c.exitVelocity)), hardPct: inPlay.length ? 100 * hard / inPlay.length : null,
    points: directed.map(c => ({ direction: c.direction, distance: c.distance, type: battedBallType(c.launchAngle), hard: c.exitVelocity >= 90 })) };
}

/** A hitter's contact against one pitching hand, from batted balls linked to a roster pitcher. */
export function handSplit(contacts: readonly ScoutContact[], hand: "R" | "L") {
  const rows = contacts.filter(c => c.pitcherThrows === hand && !isLikelyFoul(c));
  return { count: rows.length, avgEv: mean(rows.map(c => c.exitVelocity)), hardPct: rows.length ? 100 * rows.filter(c => c.exitVelocity >= 90).length / rows.length : null };
}

export type MatchupHitter = { kPct: number | null; bbPct: number | null; ops: number | null; groundPct: number | null; split: { count: number; avgEv: number | null; hardPct: number | null } };
export type MatchupPitcher = { k9: number | null; bb9: number | null; groundPct: number | null; hardPctAgainst: number | null };
export const MATCHUP_SPLIT_MIN = 5;
/**
 * Plain-language matchup notes, in the spirit of a scouting sheet. Thresholds are simple team
 * planning cutoffs (not league norms): K% 25+, BB% 12+, K/9 9+, BB/9 5+, ground balls 50%+,
 * hard-hit 40%+ against that hand with 5+ linked balls.
 */
export function matchupNotes(h: MatchupHitter, p: MatchupPitcher, hand: "R" | "L"): { tone: "pitcher" | "hitter" | "neutral"; text: string }[] {
  const notes: { tone: "pitcher" | "hitter" | "neutral"; text: string }[] = [];
  if (h.kPct !== null && h.kPct >= 25 && p.k9 !== null && p.k9 >= 9) notes.push({ tone: "pitcher", text: "Strikeout chance: high-K hitter vs swing-and-miss arm" });
  else if (h.kPct !== null && h.kPct >= 25) notes.push({ tone: "pitcher", text: "Strikes out often" });
  if (h.bbPct !== null && h.bbPct >= 12 && p.bb9 !== null && p.bb9 >= 5) notes.push({ tone: "hitter", text: "Walk risk: patient hitter vs wild arm" });
  if (h.split.count >= MATCHUP_SPLIT_MIN && h.split.hardPct !== null && h.split.hardPct >= 40) notes.push({ tone: "hitter", text: `Hits ${hand === "R" ? "righties" : "lefties"} hard (${Math.round(h.split.hardPct)}% 90+ mph, ${h.split.count} balls)` });
  if (h.groundPct !== null && h.groundPct >= 50 && p.groundPct !== null && p.groundPct >= 50) notes.push({ tone: "pitcher", text: "Ground-ball hitter vs ground-ball arm" });
  if (h.ops !== null && h.ops >= 1 && !notes.some(n => n.tone === "pitcher")) notes.push({ tone: "hitter", text: "Dangerous bat (1.000+ OPS)" });
  return notes;
}
