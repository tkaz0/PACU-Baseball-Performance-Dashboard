import "server-only";
import type { requireAdminWorkspaceAccess } from "@/lib/auth";
import { loadBwsTeamPlan } from "@/lib/bws-team-server";
import { loadTopPerformersData } from "@/lib/analytics-server";
import { loadGameStats } from "@/lib/game-server";
import { cumulativePitching } from "@/lib/pitching-cumulative";
import { pitchSplits } from "@/lib/pitching-stats";
import { playerSheetPitchMix } from "@/lib/sheet-pitch-mix";
import { PITCHING_CUMULATIVE } from "@/lib/pitching-cumulative";
import { gameValue } from "@/lib/game-metrics";
import type { SheetPitchMix } from "@/lib/pitching-stats";

type Access = Awaited<ReturnType<typeof requireAdminWorkspaceAccess>>;
export type SheetPitcher = {
  id: string; name: string; throws: string; academicClass: string; outs: number | null;
  mix: SheetPitchMix | null; familyStrike: { label: string; strikePct: number | null; pitches: number | null }[];
  line: { label: string; value: string }[];
};

/**
 * BWS dugout arsenal sheet (actual Admin, outside View as): every opposing pitcher, meaning current eligible
 * pitchers not linked on your BWS roster and not hidden from Scouting. Owner request: pitching-sheet pitch mix
 * and strike rates only (no Full Swing). Uses the existing staff readers; nothing is written.
 */
export async function loadBwsArsenalSheet(access: Access): Promise<SheetPitcher[]> {
  const [plan, data, games] = await Promise.all([loadBwsTeamPlan(access), loadTopPerformersData(), loadGameStats(access)]);
  const mine = new Set((plan?.document.players ?? []).flatMap(p => p.athleteId ? [p.athleteId] : [])), hidden = new Set(plan?.document.series.hidden ?? []);
  const pitches = (p: typeof data.players[number]) => ["pitcher", "two_way"].includes(p.playerType.trim().toLowerCase()) || [p.position, p.secondaryPosition].some(x => x?.trim().toUpperCase() === "P");
  const rows: SheetPitcher[] = [];
  for (const player of data.players.filter(p => pitches(p) && !mine.has(p.id) && !hidden.has(p.id))) {
    const own = games.filter(g => g.athlete_id === player.id && g.source === "pitching_fall_2026");
    const cumulative = cumulativePitching(own);
    const outs = cumulative.find(r => r.metric === "innings_outs")?.value ?? null;
    const stat = (metric: string, label: string) => { const g = data.games.filter(x => x.athleteId === player.id && x.source === "pitching_fall_2026" && x.eventId === PITCHING_CUMULATIVE && x.metric === metric); return g.length === 1 ? [{ label, value: gameValue(g[0].value, g[0].unit) }] : []; };
    const mix = playerSheetPitchMix(own);
    if (!mix && outs === null) continue;
    rows.push({ id: player.id, name: player.name, throws: player.throws, academicClass: player.academicClass, outs, mix,
      familyStrike: pitchSplits(cumulative).filter(s => s.pitches !== null && s.pitches > 0).map(s => ({ label: s.label, strikePct: s.strikePct, pitches: s.pitches })),
      line: [...stat("strike_pct", "Strike %"), ...stat("pitching_whip", "WHIP"), ...stat("pitching_k9", "K/9"), ...stat("pitching_bb9", "BB/9")] });
  }
  return rows.sort((a, b) => (b.outs ?? -1) - (a.outs ?? -1) || a.name.localeCompare(b.name));
}

export type SheetHitter = { id: string; name: string; bats: string; position: string; pa: number | null; stats: Record<string, { value: string; raw: number }>; tags: string[] };
/** Simple dugout cues from fixed planning cutoffs (K% 25+ and BB% 12+ match the Matchups notes), not grades. */
export const HITTER_TAGS = [
  { key: "power", label: "Power", test: (s: SheetHitter["stats"]) => (s.batting_est_iso?.raw ?? 0) >= 0.2 },
  { key: "patient", label: "Patient", test: (s: SheetHitter["stats"]) => (s.batting_bb_pct?.raw ?? 0) >= 12 },
  { key: "chase", label: "Strikes out", test: (s: SheetHitter["stats"]) => (s.batting_k_pct?.raw ?? 0) >= 25 },
  { key: "contact", label: "Tough to K", test: (s: SheetHitter["stats"]) => s.batting_k_pct !== undefined && s.batting_k_pct.raw < 10 },
  { key: "runner", label: "Runs", test: (s: SheetHitter["stats"]) => (s.sb?.raw ?? 0) >= 2 },
] as const;
const HITTER_METRICS = ["batting_ops", "batting_avg", "batting_obp", "batting_est_slg", "batting_est_iso", "batting_k_pct", "batting_bb_pct", "qpa_pct", "batting_hh_pct", "batting_8plus_pct", "pumps", "sb"];

/**
 * BWS dugout hitter sheet (actual Admin, outside View as): every opposing hitter (current eligible
 * non-pitcher-only players not linked on your BWS roster and not hidden from Scouting) with cumulative Fall
 * QPA sheet results, sorted by OPS. Existing staff reader only; nothing is written.
 */
export async function loadBwsHitterSheet(access: Access): Promise<SheetHitter[]> {
  const [plan, data] = await Promise.all([loadBwsTeamPlan(access), loadTopPerformersData()]);
  const mine = new Set((plan?.document.players ?? []).flatMap(p => p.athleteId ? [p.athleteId] : [])), hidden = new Set(plan?.document.series.hidden ?? []);
  const rows: SheetHitter[] = [];
  for (const player of data.players.filter(p => p.playerType.trim().toLowerCase() !== "pitcher" && !mine.has(p.id) && !hidden.has(p.id))) {
    const own = data.games.filter(g => g.athleteId === player.id && g.source === "qpa_fall_2026" && g.eventId === "");
    if (!own.length) continue;
    const stats: SheetHitter["stats"] = {};
    for (const metric of HITTER_METRICS) { const g = own.filter(x => x.metric === metric); if (g.length === 1) stats[metric] = { value: gameValue(g[0].value, g[0].unit), raw: g[0].value }; }
    const pa = own.find(g => g.metric === "qpa_pct")?.opportunities ?? null;
    rows.push({ id: player.id, name: player.name, bats: player.bats, position: [player.position, player.secondaryPosition].filter((p, i, list) => p && list.indexOf(p) === i).join("/"), pa, stats, tags: HITTER_TAGS.filter(t => t.test(stats)).map(t => t.label) });
  }
  return rows.sort((a, b) => (b.stats.batting_ops?.raw ?? -1) - (a.stats.batting_ops?.raw ?? -1) || a.name.localeCompare(b.name));
}
