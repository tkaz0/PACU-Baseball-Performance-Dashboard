import type { CoachingPlayer } from "@/lib/coaching-tools";
import type { SharedGameStat } from "@/lib/game-server";
import { cumulativePitching } from "@/lib/pitching-cumulative";
import { pitchSplits, formatInnings } from "@/lib/pitching-stats";
import { gameOverviewMetrics } from "@/lib/game-overview";
import { battedBallType } from "@/lib/batted-ball-profile";
import { isLikelyFoul } from "@/lib/likely-foul";

const pitches = (p: CoachingPlayer) => { const type = p.playerType.trim().toLowerCase(); return ["pitcher", "two_way"].includes(type) || [p.position, p.secondaryPosition].some(x => x?.trim().toUpperCase() === "P"); };
const hits = (p: CoachingPlayer) => !pitches(p) || p.playerType.trim().toLowerCase() === "two_way";
const median = (values: number[]) => { if (!values.length) return null; const s = [...values].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export type CommandRow = { player: CoachingPlayer; outs: number; innings: string; walks: number; bb9: number | null; strikePct: number | null; kbb: number | null; fps: number | null; hbp: number | null; families: { label: string; strikePct: number | null; pitches: number | null }[]; aboveTeam: boolean };
/**
 * Cumulative Fall pitching lines from the current sheet snapshot (same overlap guard as profiles).
 * Sorted by BB/9, most walks first. FPS is the sheet's first-pitch-strike count; without a matching
 * first-pitch opportunity count it is not turned into a percentage.
 */
export function commandFocus(players: readonly CoachingPlayer[], stats: readonly SharedGameStat[]) {
  const rows: CommandRow[] = [];
  for (const player of players.filter(pitches)) {
    const cum = cumulativePitching(stats.filter(r => r.athlete_id === player.id && r.source === "pitching_fall_2026"));
    const get = (metric: string) => { const r = cum.find(row => row.metric === metric); return r && Number.isFinite(r.value) ? r.value : null; };
    const outs = get("innings_outs"), walks = get("bb_outcome");
    if (outs === null || outs <= 0 || walks === null) continue;
    const k = get("k"), strikes = get("strikes"), total = get("pitches");
    rows.push({ player, outs, innings: formatInnings(outs), walks, bb9: 27 * walks / outs,
      strikePct: strikes !== null && total !== null && total > 0 && strikes <= total ? 100 * strikes / total : null,
      kbb: k !== null && walks > 0 ? k / walks : null, fps: get("fps"), hbp: get("hbp"),
      families: pitchSplits(cum).map(f => ({ label: f.label, strikePct: f.strikePct, pitches: f.pitches })), aboveTeam: false });
  }
  const teamOuts = rows.reduce((n, r) => n + r.outs, 0), teamWalks = rows.reduce((n, r) => n + r.walks, 0);
  const teamBb9 = teamOuts > 0 ? 27 * teamWalks / teamOuts : null;
  for (const row of rows) row.aboveTeam = teamBb9 !== null && row.bb9 !== null && row.bb9 > teamBb9;
  rows.sort((a, b) => (b.bb9 ?? -1) - (a.bb9 ?? -1) || b.outs - a.outs || a.player.name.localeCompare(b.player.name));
  return { rows, teamBb9 };
}

export type PowerContact = { athleteId: string; category: string; exitVelocity: number; launchAngle: number; direction: number | null; squaredUp: number | null };
export type PowerRow = { player: CoachingPlayer; iso: number | null; slg: number | null; ab: number | null; balls: number; maxEv: number | null; avgEv: number | null; hardHitPct: number | null; airPct: number | null; squaredUp: number | null; squaredCount: number; profile: string | null };
export const POWER_MIN_BALLS = 5;
/**
 * Game ISO/SLG beside in-game Full Swing contact (likely fouls left out). Profiles compare each hitter
 * with the team medians of hitters with at least five balls; they describe contact, not a grade or plan.
 */
export function powerDevelopment(players: readonly CoachingPlayer[], stats: readonly SharedGameStat[], contacts: readonly PowerContact[]) {
  const rows: PowerRow[] = players.filter(hits).map(player => {
    const games = gameOverviewMetrics(stats.filter(r => r.athlete_id === player.id && r.source === "qpa_fall_2026"), []);
    const iso = games.find(g => g.metric === "batting_est_iso"), slg = games.find(g => g.metric === "batting_est_slg");
    const own = contacts.filter(c => c.athleteId === player.id && c.category !== "practice" && !isLikelyFoul(c));
    const ev = own.map(c => c.exitVelocity), squared = own.filter(c => typeof c.squaredUp === "number");
    return { player, iso: iso?.value ?? null, slg: slg?.value ?? null, ab: iso?.opportunities ?? null, balls: own.length,
      maxEv: ev.length ? Math.max(...ev) : null, avgEv: ev.length ? ev.reduce((a, b) => a + b, 0) / ev.length : null,
      hardHitPct: own.length ? 100 * own.filter(c => c.exitVelocity >= 90).length / own.length : null,
      airPct: own.length ? 100 * own.filter(c => ["line", "fly"].includes(battedBallType(c.launchAngle))).length / own.length : null,
      squaredUp: squared.length ? 100 * squared.reduce((a, c) => a + c.squaredUp!, 0) / squared.length : null, squaredCount: squared.length, profile: null };
  }).filter(row => row.iso !== null || row.balls > 0);
  const eligible = rows.filter(r => r.balls >= POWER_MIN_BALLS);
  const medians = { hard: median(eligible.map(r => r.hardHitPct!)), air: median(eligible.map(r => r.airPct!)), squared: median(eligible.flatMap(r => r.squaredUp === null ? [] : [r.squaredUp])) };
  for (const row of rows) {
    if (row.balls < POWER_MIN_BALLS || medians.hard === null || medians.air === null) continue;
    const hard = row.hardHitPct! >= medians.hard, air = row.airPct! >= medians.air;
    row.profile = hard && air ? "Hard contact in the air" : hard ? "Hard contact, lower launch" : air ? "In the air, softer contact"
      : medians.squared !== null && row.squaredUp !== null && row.squaredUp >= medians.squared ? "Squared up, softer contact" : "Softer, lower contact";
  }
  rows.sort((a, b) => (b.iso ?? -1) - (a.iso ?? -1) || b.balls - a.balls || a.player.name.localeCompare(b.player.name));
  return { rows, medians };
}
