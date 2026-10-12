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
  /** "pitch" = this pitch type's own balls in play; "pitcher" = all of this pitcher's balls in play (fallback). */
  contactBasis: "pitch" | "pitcher" | null;
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

type Dist = { n: number; mean: number; sd: number };
/** Aggregate-only team reference for grading; no pitcher identities or individual values. */
export type PitchGradeBaselines = {
  teamStrike: Partial<Record<Family, number>>;
  contact: { ev: number | null; hard: number | null; squared: number | null };
  types: Record<string, { velocity?: Dist; spin?: Dist; velocityGap?: Dist }>;
};
type RawPitch = Omit<PitchGradeRow, "strike" | "contact" | "stuff" | "grade" | "missing"> & { familyKey: Family | null; familyStrikes: number | null; balls: AllowedContact[] };
const dist = (values: number[]): Dist | undefined => values.length ? { n: values.length, mean: mean(values), sd: values.length > 1 ? sd(values) : 0 } : undefined;

/** One pitcher's inputs: in-game arsenal, sheet family counts and in-play contact against. */
function rawPitches(player: CoachingPlayer, stats: readonly SharedGameStat[], pitches: readonly FallArsenalPitch[], contacts: readonly AllowedContact[]): RawPitch[] {
  const cum = cumulativePitching(stats.filter(r => r.athlete_id === player.id && r.source === "pitching_fall_2026"));
  const get = (metric: string) => { const r = cum.find(row => row.metric === metric); return r && Number.isFinite(r.value) ? r.value : null; };
  const family = new Map<Family, { pitches: number; strikes: number }>();
  for (const key of Object.keys(FAMILY_STRIKES) as Family[]) { const n = get(key), k = get(FAMILY_STRIKES[key]); if (n !== null && k !== null && n > 0 && k <= n) family.set(key, { pitches: n, strikes: k }); }
  const types = [...new Set(pitches.filter(p => p.category !== "Practice").map(p => p.pitchType))].filter(t => t !== "Fastball");
  const primaryFb = types.filter(t => PITCH_FAMILY[t] === "fb").map(t => ({ t, ...inGame(pitches, t) })).filter(x => x.velocity !== null).sort((a, b) => b.readings - a.readings)[0];
  const ownInPlay = contacts.filter(c => !isLikelyFoul(c));
  return types.map(type => {
    const familyKey = PITCH_FAMILY[type] ?? null, { velocity, spin } = inGame(pitches, type), fam = familyKey ? family.get(familyKey) : undefined;
    // Until a pitch type has enough of its own balls in play, Contact+ uses all of the pitcher's in-play contact.
    const pitchBalls = ownInPlay.filter(c => c.pitchType === type);
    const contactBasis = pitchBalls.length >= MIN_BALLS_IN_PLAY ? "pitch" as const : ownInPlay.length >= MIN_BALLS_IN_PLAY ? "pitcher" as const : null;
    const balls = contactBasis === "pitch" ? pitchBalls : ownInPlay, squared = balls.filter(c => typeof c.squaredUp === "number");
    const strikePct = fam ? fam.strikes / fam.pitches : null;
    return { player, pitchType: type, family: familyKey ? FAMILY_LABEL[familyKey] : null, familyKey, velocity, spin,
      velocityGap: familyKey === "ch" && primaryFb && velocity !== null ? primaryFb.velocity! - velocity : null,
      ballsInPlay: contactBasis === "pitcher" ? ownInPlay.length : pitchBalls.length, familyPitches: fam?.pitches ?? null, familyStrikes: fam?.strikes ?? null,
      strikePct: strikePct === null ? null : 100 * strikePct, avgEvAgainst: balls.length ? mean(balls.map(c => c.exitVelocity)) : null,
      hardHitAgainst: balls.length ? 100 * balls.filter(c => c.exitVelocity >= 90).length / balls.length : null,
      squaredAgainst: squared.length ? 100 * mean(squared.map(c => c.squaredUp!)) : null, contactBasis, balls: contactBasis ? balls : [] };
  });
}

/** Team reference from every pitcher: pooled family strike rates, pooled contact against, and per-type velocity/spin/gap spreads. */
export function pitchGradeBaselines(raws: readonly RawPitch[], contacts: readonly AllowedContact[]): PitchGradeBaselines {
  const teamStrike: PitchGradeBaselines["teamStrike"] = {};
  for (const key of Object.keys(FAMILY_STRIKES) as Family[]) {
    // One count per pitcher and family (pitch types in a family share the same sheet line).
    const perPitcher = new Map(raws.filter(r => r.familyKey === key && r.familyPitches !== null).map(r => [r.player.id, r]));
    const n = [...perPitcher.values()].reduce((a, r) => a + r.familyPitches!, 0), k = [...perPitcher.values()].reduce((a, r) => a + r.familyStrikes!, 0);
    if (n > 0) teamStrike[key] = k / n;
  }
  const inPlay = contacts.filter(c => !isLikelyFoul(c)), squared = inPlay.filter(c => typeof c.squaredUp === "number");
  const types: PitchGradeBaselines["types"] = {};
  for (const type of new Set(raws.map(r => r.pitchType))) {
    const group = raws.filter(r => r.pitchType === type);
    types[type] = { velocity: dist(group.flatMap(r => r.velocity === null ? [] : [r.velocity])), spin: dist(group.flatMap(r => r.spin === null ? [] : [r.spin])), velocityGap: dist(group.flatMap(r => r.velocityGap === null ? [] : [r.velocityGap])) };
  }
  return { teamStrike, contact: { ev: inPlay.length ? mean(inPlay.map(c => c.exitVelocity)) : null, hard: inPlay.length ? inPlay.filter(c => c.exitVelocity >= 90).length / inPlay.length : null, squared: squared.length ? mean(squared.map(c => c.squaredUp!)) : null }, types };
}

/** Grade one pitcher's pitches against team baselines. `minStuff` is the teammates needed per pitch type. */
function gradeRaw(raw: RawPitch, baselines: PitchGradeBaselines, minStuff: number): PitchGradeRow {
  const lowerBetter = (value: number, baseline: number | null) => baseline && baseline > 0 ? clamp(100 + 100 * (baseline - value) / baseline) : null;
  const teamPct = raw.familyKey ? baselines.teamStrike[raw.familyKey] ?? null : null;
  const strike = raw.familyPitches !== null && raw.familyPitches >= MIN_FAMILY_PITCHES && teamPct && raw.strikePct !== null ? clamp(raw.strikePct / teamPct) : null;
  const balls = raw.balls, squared = balls.filter(c => typeof c.squaredUp === "number");
  const contactParts = raw.contactBasis ? [lowerBetter(raw.avgEvAgainst!, baselines.contact.ev), lowerBetter(raw.hardHitAgainst! / 100, baselines.contact.hard), squared.length >= MIN_BALLS_IN_PLAY ? lowerBetter(raw.squaredAgainst! / 100, baselines.contact.squared) : null].filter((v): v is number => v !== null) : [];
  const keys: ("velocity" | "spin" | "velocityGap")[] = PITCH_FAMILY[raw.pitchType] === "ch" ? ["velocityGap"] : ["velocity", "spin"];
  const scores = keys.flatMap(key => { const d = baselines.types[raw.pitchType]?.[key]; if (!d || d.n < minStuff || raw[key] === null) return []; return d.sd > 0 ? [100 + 10 * (raw[key]! - d.mean) / d.sd] : [100]; });
  const row: PitchGradeRow = { player: raw.player, pitchType: raw.pitchType, family: raw.family, velocity: raw.velocity, spin: raw.spin, velocityGap: raw.velocityGap, ballsInPlay: raw.ballsInPlay, familyPitches: raw.familyPitches,
    strike, contact: contactParts.length ? mean(contactParts) : null, stuff: scores.length === keys.length ? clamp(mean(scores)) : null, grade: null,
    strikePct: raw.strikePct, avgEvAgainst: raw.avgEvAgainst, hardHitAgainst: raw.hardHitAgainst, squaredAgainst: raw.squaredAgainst, contactBasis: raw.contactBasis, missing: [] };
  if (row.strike === null) row.missing.push(row.family ? `${MIN_FAMILY_PITCHES}+ ${row.family.toLowerCase()} pitches` : "a sheet strike family");
  if (row.contact === null) row.missing.push(`${MIN_BALLS_IN_PLAY}+ balls in play against the pitcher`);
  if (row.stuff === null) row.missing.push(`${minStuff}+ teammates with this pitch`);
  if (!row.missing.length) row.grade = PITCH_GRADE_WEIGHTS.strike * row.strike! + PITCH_GRADE_WEIGHTS.contact * row.contact! + PITCH_GRADE_WEIGHTS.stuff * row.stuff!;
  return row;
}

/** Staff: every pitcher graded against baselines built from the whole staff. */
export function pitchGrades(players: readonly CoachingPlayer[], stats: readonly SharedGameStat[], arsenals: readonly { athleteId: string; pitches: FallArsenalPitch[] }[], contacts: ReadonlyMap<string, readonly AllowedContact[]>) {
  const raws = players.flatMap(player => rawPitches(player, stats, arsenals.find(a => a.athleteId === player.id)?.pitches ?? [], contacts.get(player.id) ?? []));
  const baselines = pitchGradeBaselines(raws, [...contacts.values()].flat());
  const rows = raws.map(raw => gradeRaw(raw, baselines, MIN_STUFF_PITCHERS));
  rows.sort((a, b) => (b.grade ?? -1) - (a.grade ?? -1) || a.player.name.localeCompare(b.player.name) || a.pitchType.localeCompare(b.pitchType));
  return { rows, team: baselines.contact, baselines };
}

/** Minimum pitchers per pitch type before a velocity/spin spread may be shown to players (so teammates' values cannot be worked out). */
export const PLAYER_BASELINE_MIN_PITCHERS = 5;
const finiteOrNull = (v: unknown, max: number) => v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max);
/** Strict shape check for the stored row before a player is graded against it. */
export function parsePitchGradeBaselines(value: unknown): PitchGradeBaselines | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>, strike = v.teamStrike as Record<string, unknown>, contact = v.contact as Record<string, unknown>, types = v.types as Record<string, unknown>;
  if (!strike || typeof strike !== "object" || !contact || typeof contact !== "object" || !types || typeof types !== "object") return null;
  if (!Object.entries(strike).every(([k, x]) => k in FAMILY_STRIKES && typeof x === "number" && x >= 0 && x <= 1)) return null;
  if (!finiteOrNull(contact.ev ?? null, 200) || !finiteOrNull(contact.hard ?? null, 1) || !finiteOrNull(contact.squared ?? null, 1)) return null;
  for (const t of Object.values(types)) {
    if (!t || typeof t !== "object") return null;
    for (const [k, d] of Object.entries(t as Record<string, unknown>)) {
      const x = d as Dist;
      if (!["velocity", "spin", "velocityGap"].includes(k) || !x || typeof x.n !== "number" || x.n < PLAYER_BASELINE_MIN_PITCHERS || !Number.isFinite(x.mean) || !(typeof x.sd === "number" && x.sd >= 0)) return null;
    }
  }
  return { teamStrike: strike as PitchGradeBaselines["teamStrike"], contact: { ev: (contact.ev ?? null) as number | null, hard: (contact.hard ?? null) as number | null, squared: (contact.squared ?? null) as number | null }, types: types as PitchGradeBaselines["types"] };
}
/** Strip spreads from pitch types with fewer than five pitchers before publishing to player accounts. */
export function playerVisibleBaselines(b: PitchGradeBaselines): PitchGradeBaselines {
  const keep = (d?: Dist) => d && d.n >= PLAYER_BASELINE_MIN_PITCHERS ? { n: d.n, mean: Number(d.mean.toFixed(4)), sd: Number(d.sd.toFixed(4)) } : undefined;
  const types = Object.entries(b.types).map(([type, t]) => [type, Object.fromEntries((["velocity", "spin", "velocityGap"] as const).flatMap(key => { const d = keep(t[key]); return d ? [[key, d]] : []; }))] as const).filter(([, t]) => Object.keys(t).length);
  return { teamStrike: b.teamStrike, contact: b.contact, types: Object.fromEntries(types) };
}
/** A player's own grades from their own inputs and the published team baselines. */
export function ownPitchGrades(player: CoachingPlayer, stats: readonly SharedGameStat[], pitches: readonly FallArsenalPitch[], contacts: readonly AllowedContact[], baselines: PitchGradeBaselines): PitchGradeRow[] {
  return rawPitches(player, stats, pitches, contacts).map(raw => gradeRaw(raw, baselines, PLAYER_BASELINE_MIN_PITCHERS));
}
