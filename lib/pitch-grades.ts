import type { CoachingPlayer } from "@/lib/coaching-tools";
import type { SharedGameStat } from "@/lib/game-server";
import type { AllowedContact } from "@/lib/contacts-allowed";
import type { FallArsenalPitch } from "@/lib/pitch-arsenal";
import { cumulativePitching } from "@/lib/pitching-cumulative";
import { isLikelyFoul } from "@/lib/likely-foul";

/**
 * Pitch+ (Team): an owner-requested, team-relative outcome grade, not Stuff+ (no movement, release or
 * run-value model). 100 = Pacific average. Weights: Strike+ 40%, Contact+ 40%, Stuff-lite 20%.
 * The blend shows only when every part meets its minimum; parts always show on their own.
 */
export const PITCH_GRADE_WEIGHTS = { strike: .4, contact: .4, stuff: .2 } as const;
export const MIN_FAMILY_PITCHES = 30, MIN_BALLS_IN_PLAY = 8, MIN_STUFF_PITCHERS = 3;
type Family = "fb" | "bb_pitch_family" | "ch";
/** Dashboard mapping from staff pitch labels to the game sheet's three strike families. */
export const PITCH_FAMILY: Partial<Record<string, Family>> = {
  "Four-Seam Fastball": "fb", "Two-Seam Fastball": "fb", Sinker: "fb", Cutter: "fb",
  "Breaking Ball": "bb_pitch_family", Slider: "bb_pitch_family", Sweeper: "bb_pitch_family", Curveball: "bb_pitch_family",
  Changeup: "ch", Splitter: "ch",
};
const FAMILY_STRIKES: Record<Family, string> = { fb: "fb_k", bb_pitch_family: "bb_pitch_family_k", ch: "ch_k" };
const FAMILY_LABEL: Record<Family, string> = { fb: "Fastball family", bb_pitch_family: "Breaking ball family", ch: "Changeup family" };
const clamp = (v: number) => Math.max(50, Math.min(150, v));
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const sd = (v: number[]) => { const m = mean(v); return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)); };

export type PitchGradeRow = {
  player: CoachingPlayer; pitchType: string; family: string | null;
  velocity: number | null; spin: number | null; velocityGap: number | null; ballsInPlay: number; familyPitches: number | null;
  strike: number | null; contact: number | null; stuff: number | null; grade: number | null;
  strikePct: number | null; avgEvAgainst: number | null; hardHitAgainst: number | null; squaredAgainst: number | null;
  missing: string[];
};

/** Combine Game and Intrasquad entries for one pitch, weighting by verified reading counts. */
function inGame(pitches: readonly FallArsenalPitch[], type: string) {
  const rows = pitches.filter(p => p.pitchType === type && p.category !== "Practice");
  const pool = (value: (p: FallArsenalPitch) => number | null, count: (p: FallArsenalPitch) => number | null) => {
    const usable = rows.filter(p => value(p) !== null);
    if (!usable.length) return null;
    if (usable.length === 1) return value(usable[0]);
    if (usable.some(p => !count(p))) return value([...usable].sort((a, b) => b.lastDate.localeCompare(a.lastDate))[0]);
    const total = usable.reduce((n, p) => n + count(p)!, 0);
    return usable.reduce((n, p) => n + value(p)! * count(p)!, 0) / total;
  };
  return { velocity: pool(p => p.averageVelocity, p => p.velocityReadings), spin: pool(p => p.averageSpin, p => p.spinReadings), readings: rows.reduce((n, p) => n + (p.velocityReadings ?? 0), 0) };
}

export function pitchGrades(players: readonly CoachingPlayer[], stats: readonly SharedGameStat[], arsenals: readonly { athleteId: string; pitches: FallArsenalPitch[] }[], contacts: ReadonlyMap<string, readonly AllowedContact[]>) {
  const rows: PitchGradeRow[] = [];
  // Family strike counts from cumulative sheet lines (same overlap guard as profiles).
  const familyCounts = new Map<string, Map<Family, { pitches: number; strikes: number }>>();
  for (const player of players) {
    const cum = cumulativePitching(stats.filter(r => r.athlete_id === player.id && r.source === "pitching_fall_2026"));
    const get = (metric: string) => { const r = cum.find(row => row.metric === metric); return r && Number.isFinite(r.value) ? r.value : null; };
    const own = new Map<Family, { pitches: number; strikes: number }>();
    for (const family of Object.keys(FAMILY_STRIKES) as Family[]) { const pitches = get(family), strikes = get(FAMILY_STRIKES[family]); if (pitches !== null && strikes !== null && pitches > 0 && strikes <= pitches) own.set(family, { pitches, strikes }); }
    familyCounts.set(player.id, own);
  }
  const teamStrike = new Map<Family, number>();
  for (const family of Object.keys(FAMILY_STRIKES) as Family[]) {
    let p = 0, s = 0; for (const own of familyCounts.values()) { const c = own.get(family); if (c) { p += c.pitches; s += c.strikes; } }
    if (p > 0) teamStrike.set(family, s / p);
  }
  // Team contact baseline: every linked in-game, in-play, classified ball against Pacific pitchers.
  const allInPlay = [...contacts.values()].flat().filter(c => c.pitchType && !isLikelyFoul(c));
  const squaredAll = allInPlay.filter(c => typeof c.squaredUp === "number");
  const team = { ev: allInPlay.length ? mean(allInPlay.map(c => c.exitVelocity)) : null, hard: allInPlay.length ? allInPlay.filter(c => c.exitVelocity >= 90).length / allInPlay.length : null, squared: squaredAll.length ? mean(squaredAll.map(c => c.squaredUp!)) : null };
  const lowerBetter = (value: number, baseline: number | null) => baseline && baseline > 0 ? clamp(100 + 100 * (baseline - value) / baseline) : null;

  for (const player of players) {
    const pitches = arsenals.find(a => a.athleteId === player.id)?.pitches ?? [];
    const types = [...new Set(pitches.filter(p => p.category !== "Practice").map(p => p.pitchType))].filter(t => t !== "Fastball");
    const primaryFb = types.filter(t => PITCH_FAMILY[t] === "fb").map(t => ({ t, ...inGame(pitches, t) })).filter(x => x.velocity !== null).sort((a, b) => b.readings - a.readings)[0];
    for (const type of types) {
      const family = PITCH_FAMILY[type] ?? null, { velocity, spin } = inGame(pitches, type);
      const fam = family ? familyCounts.get(player.id)?.get(family) : undefined;
      const strikePct = fam ? fam.strikes / fam.pitches : null, teamPct = family ? teamStrike.get(family) ?? null : null;
      const balls = (contacts.get(player.id) ?? []).filter(c => c.pitchType === type && !isLikelyFoul(c));
      const squared = balls.filter(c => typeof c.squaredUp === "number");
      const ev = balls.length ? mean(balls.map(c => c.exitVelocity)) : null, hard = balls.length ? balls.filter(c => c.exitVelocity >= 90).length / balls.length : null, sq = squared.length ? mean(squared.map(c => c.squaredUp!)) : null;
      const contactParts = balls.length >= MIN_BALLS_IN_PLAY ? [lowerBetter(ev!, team.ev), lowerBetter(hard!, team.hard), squared.length >= MIN_BALLS_IN_PLAY ? lowerBetter(sq!, team.squared) : null].filter((v): v is number => v !== null) : [];
      rows.push({ player, pitchType: type, family: family ? FAMILY_LABEL[family] : null, velocity, spin,
        velocityGap: family === "ch" && primaryFb && velocity !== null ? primaryFb.velocity! - velocity : null,
        ballsInPlay: balls.length, familyPitches: fam?.pitches ?? null,
        strike: fam && fam.pitches >= MIN_FAMILY_PITCHES && teamPct ? clamp(100 * strikePct! / teamPct) : null,
        contact: contactParts.length ? mean(contactParts) : null, stuff: null, grade: null,
        strikePct: strikePct === null ? null : 100 * strikePct, avgEvAgainst: ev, hardHitAgainst: hard === null ? null : 100 * hard, squaredAgainst: sq === null ? null : 100 * sq, missing: [] });
    }
  }
  // Stuff-lite: velocity and spin z-scores against teammates throwing the same pitch type (changeups: speed gap off the pitcher's main fastball).
  for (const type of new Set(rows.map(r => r.pitchType))) {
    const group = rows.filter(r => r.pitchType === type), changeup = PITCH_FAMILY[type] === "ch";
    const parts: { key: "velocity" | "spin" | "velocityGap" }[] = changeup ? [{ key: "velocityGap" }] : [{ key: "velocity" }, { key: "spin" }];
    for (const row of group) {
      const scores = parts.flatMap(({ key }) => {
        const values = group.flatMap(r => r[key] === null ? [] : [r[key]!]);
        if (values.length < MIN_STUFF_PITCHERS || row[key] === null) return [];
        const s = sd(values); return s > 0 ? [100 + 10 * (row[key]! - mean(values)) / s] : [100];
      });
      row.stuff = scores.length === parts.length ? clamp(mean(scores)) : null;
    }
  }
  for (const row of rows) {
    if (row.strike === null) row.missing.push(row.family ? `${MIN_FAMILY_PITCHES}+ ${row.family.toLowerCase()} pitches` : "a sheet strike family");
    if (row.contact === null) row.missing.push(`${MIN_BALLS_IN_PLAY}+ balls in play`);
    if (row.stuff === null) row.missing.push(`${MIN_STUFF_PITCHERS}+ teammates with this pitch`);
    if (!row.missing.length) row.grade = PITCH_GRADE_WEIGHTS.strike * row.strike! + PITCH_GRADE_WEIGHTS.contact * row.contact! + PITCH_GRADE_WEIGHTS.stuff * row.stuff!;
  }
  rows.sort((a, b) => (b.grade ?? -1) - (a.grade ?? -1) || a.player.name.localeCompare(b.player.name) || a.pitchType.localeCompare(b.pitchType));
  return { rows, team };
}
