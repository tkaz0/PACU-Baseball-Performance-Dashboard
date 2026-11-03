import { requireRenderImportAccess as requireImportAccess } from "@/lib/render-access";
import { loadStaffAthleteChoices } from "@/lib/staff-athlete-search-server";
import { ExitMeetingPrintAll } from "@/components/exit-meeting-print-all";
import { TeamReviewSheet } from "@/components/team-review-sheet";
import { loadTeamReviewData } from "@/lib/team-review-server";
import { loadGameStats } from "@/lib/game-server";
import { loadGameLogs } from "@/lib/game-log-server";
import { reviewGameData } from "@/lib/game-review";
import type { PrintReadiness } from "@/components/exit-meeting-print-all";

export const metadata = { title: "Print All Handouts" };
/** November 2 owner request: every current player's exit meeting handout in one print job (Save as PDF). */
export default async function PrintAllHandoutsPage() {
  const access = await requireImportAccess();
  // The whole-team sheet prints first (owner request); its readers run alongside the player list.
  const [players, team, stats, logs] = await Promise.all([loadStaffAthleteChoices(access), loadTeamReviewData(access), loadGameStats(access).catch(() => null), loadGameLogs(access).catch(() => null)]);
  // Print readiness (November 2 owner request): after a sheet sync, confirm every game stat is available before printing.
  const names = new Map(players.map(p => [p.id, p.name]));
  const issues = stats && logs ? reviewGameData(stats, logs) : null;
  const latest = (source: string) => stats?.filter(s => s.source === source).map(s => s.fetched_at).sort().at(-1) ?? null;
  const pendingRates = [...(team.data.batting?.rates ?? []), ...(team.data.pitching?.rates ?? [])].filter(r => r.pending).map(r => r.label);
  const readiness: PrintReadiness = {
    issues: issues === null ? null : [...new Set(issues.map(i => names.get(i.athleteId) ?? "A player"))],
    pendingRates, hittingSaved: latest("qpa_fall_2026"), pitchingSaved: latest("pitching_fall_2026"),
  };
  return <ExitMeetingPrintAll players={players.map(p => ({ id: p.id, name: p.name }))} teamSheet={<TeamReviewSheet data={team.data} bundle/>} teamUnavailable={team.unavailable} readiness={readiness}/>;
}
