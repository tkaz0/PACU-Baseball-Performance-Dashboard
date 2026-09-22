import "server-only";
import type { requireAccess } from "@/lib/auth";
import { loadGameLeaderboards } from "@/lib/game-comparison-server";
import { loadLeaderboard, loadLeaderboardComparisons } from "@/lib/leaderboard-server";
import { visibleLeaderboardComparisons } from "@/lib/leaderboards";
import { homeGameBoard, homeMeasurementBoard, type HomeLeaderboard } from "@/lib/home-leaderboards";

type Access = Awaited<ReturnType<typeof requireAccess>>;

/** Use only the existing narrow, signed-in leaderboard RPCs. The readers remove peer profile links in Player presentation. */
export async function loadHomeLeaderboards(access: Access): Promise<HomeLeaderboard[]> {
  if (!access.roles.some(role => role === "admin" || role === "coach" || role === "player") || (!access.athleteId && !access.roles.some(role => role === "admin" || role === "coach"))) return [];
  const [options, gameRows] = await Promise.all([loadLeaderboardComparisons(access), loadGameLeaderboards(access)]);
  const body = visibleLeaderboardComparisons("physicality", options).find(option => option.metricKey === "body_score");
  const practice = visibleLeaderboardComparisons("hitting", options, "practice").find(option => option.metricKey === "avg_bat_speed");
  const [bodyRows, practiceRows] = await Promise.all([body ? loadLeaderboard(access, body) : [], practice ? loadLeaderboard(access, practice) : []]);
  const boards = [
    ...(body ? [homeMeasurementBoard("body", "Physicality", "Body Score", "/leaderboards?group=physicality", bodyRows, body, access.athleteId)] : []),
    ...(practice ? [homeMeasurementBoard("bat", "Hitting · Practice", "Average Bat Speed", "/leaderboards?group=hitting&session=practice", practiceRows, practice, access.athleteId)] : []),
    homeGameBoard("avg", "Hitting · In Game", "Batting AVG", "/leaderboards?group=games&discipline=hitting", gameRows, "qpa_fall_2026", "", "batting_avg", access.athleteId),
    homeGameBoard("strike", "Pitching · In Game", "Strike %", "/leaderboards?group=games&discipline=pitching", gameRows, "pitching_fall_2026", "fall-2026-cumulative", "strike_pct", access.athleteId),
  ];
  return boards.filter(board => board.total > 0);
}
