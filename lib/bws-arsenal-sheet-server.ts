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
