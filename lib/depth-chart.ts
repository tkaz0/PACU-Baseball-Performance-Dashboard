import type { CoachingData, CoachingGame, CoachingPlayer } from "@/lib/coaching-tools";
import { gameValue } from "@/lib/game-metrics";

export const DEPTH_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "OF"] as const;
export type DepthPosition = typeof DEPTH_POSITIONS[number];
export type DepthStat = { label: string; value: string; sample?: string };
export type DepthPlayer = { id: string; code: string; name: string; academicClass: string; secondary: boolean; stats: DepthStat[]; sortValue: number | null };

const OUTFIELD = new Set(["LF", "CF", "RF", "OF"]);
const slotOf = (position: string): DepthPosition | null => { const p = position.trim().toUpperCase(); return OUTFIELD.has(p) ? "OF" : (DEPTH_POSITIONS as readonly string[]).includes(p) ? p as DepthPosition : null; };
const FASTBALL = /fastball|sinker|cutter/i;

/** Groups the eligible roster by primary (then secondary) position with a few recorded key stats. No lineup score is invented. */
export function buildDepthChart(data: CoachingData): Record<DepthPosition, DepthPlayer[]> {
  const chart = Object.fromEntries(DEPTH_POSITIONS.map(p => [p, [] as DepthPlayer[]])) as Record<DepthPosition, DepthPlayer[]>;
  const game = (player: CoachingPlayer, metric: string): CoachingGame | undefined => data.games.find(g => g.athleteId === player.id && g.metric === metric);
  const fall = data.readings.filter(r => r.date >= "2026-09-01" && r.date <= "2026-12-31");
  const best = (player: CoachingPlayer, metric: string) => { const rows = fall.filter(r => r.athleteId === player.id && r.metric === metric); return rows.length ? rows.reduce((a, b) => b.value > a.value ? b : a) : undefined; };
  const latest = (player: CoachingPlayer, metric: string) => { const rows = fall.filter(r => r.athleteId === player.id && r.metric === metric); return rows.length ? rows.reduce((a, b) => b.date > a.date ? b : a) : undefined; };
  const stat = (label: string, g: CoachingGame | undefined, sampleLabel?: string): DepthStat[] => g ? [{ label, value: gameValue(g.value, g.unit), ...(g.opportunities != null && sampleLabel ? { sample: `${g.opportunities} ${sampleLabel}` } : {}) }] : [];
  for (const player of data.players) {
    const primary = slotOf(player.position), secondary = slotOf(player.secondaryPosition ?? "");
    const pitcherStats = () => {
      const fastball = data.arsenals?.find(a => a.athleteId === player.id)?.pitches.filter(p => FASTBALL.test(p.pitchType) && p.averageVelocity !== null).map(p => p.averageVelocity!).sort((a, b) => b - a)[0];
      const whip = game(player, "pitching_whip");
      return { stats: [...stat("WHIP", whip, "outs"), ...stat("K/BB", game(player, "pitching_k_bb")), ...stat("K/9", game(player, "pitching_k9")), ...(fastball !== undefined ? [{ label: "FB Velo", value: `${fastball.toFixed(1)} mph` }] : [])], sortValue: whip ? -whip.value : null };
    };
    const hitterStats = () => {
      const pp = game(player, "batting_production_plus"), ev = best(player, "max_exit_velocity"), bat = latest(player, "avg_bat_speed");
      return { stats: [...stat("PAC Prod+", pp, "PA"), ...stat("OBP", game(player, "batting_obp")), ...(ev ? [{ label: "Max EV", value: `${ev.value.toFixed(1)} mph` }] : []), ...(bat ? [{ label: "Bat Speed", value: `${bat.value.toFixed(1)} mph` }] : [])], sortValue: pp ? pp.value : null };
    };
    for (const [slot, isSecondary] of [[primary, false], [secondary, true]] as const) {
      if (!slot || (isSecondary && slot === primary)) continue;
      const { stats, sortValue } = slot === "P" ? pitcherStats() : hitterStats();
      chart[slot].push({ id: player.id, code: player.code, name: player.name, academicClass: player.academicClass, secondary: isSecondary, stats, sortValue });
    }
  }
  for (const slot of DEPTH_POSITIONS) chart[slot].sort((a, b) => Number(a.secondary) - Number(b.secondary) || (b.sortValue ?? -Infinity) - (a.sortValue ?? -Infinity) || a.name.localeCompare(b.name));
  return chart;
}
