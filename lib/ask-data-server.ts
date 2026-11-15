import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { loadGameLeaderboards } from "@/lib/game-comparison-server";
import { loadLeaderboardComparisons, loadLeaderboards } from "@/lib/leaderboard-server";
import { loadHomeSnapshot } from "@/lib/home-server";
import { LEADERBOARD_METRICS, leaderboardMetricLabel, leaderboardPitchType, leaderboardSession, leaderboardSourceLabel, pitchLeaderboardLabel, selectPitchLeaderboards, visibleLeaderboardComparisons, type LeaderboardComparison } from "@/lib/leaderboards";
import { profileMetricLabel } from "@/lib/profile-metric-label";
import { formatMetricNumber } from "@/lib/measurement-display";
import { isTimedMetric } from "@/lib/player-performance";
import { askData, type AskPlayer, type AskTestingBoard } from "@/lib/ask-data";
import type { RosterAthlete } from "@/lib/types";

type Access = Awaited<ReturnType<typeof requireAccess>>;
const roleLabel = (type: string | null) => type === "pitcher" ? "Pitcher" : type === "two_way" ? "Two-way" : "Position player";

/**
 * Staff-only context for Ask the Data, from the same signed-in readers the dashboard pages use. Returns the
 * name-free data block plus the code → name map used to restore names in the reply on the server.
 */
export async function loadAskContext(access: Access): Promise<{ data: string; names: Map<string, string>; players: number }> {
  if (!canImportPresentedAccess(access)) throw new Error("Ask the Data is available to coaches and admins.");
  const [roster, gameRows, options, summary] = await Promise.all([
    access.supabase.from("athletes").select("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons!inner(*)").eq("athlete_seasons.season", "2026-27"),
    loadGameLeaderboards(access).catch(() => []),
    loadLeaderboardComparisons(access).catch(() => [] as LeaderboardComparison[]),
    loadHomeSnapshot(access).catch(() => null),
  ]);
  if (roster.error || !Array.isArray(roster.data)) throw new Error("The roster couldn't be loaded.");
  const names = new Map<string, string>(), players: AskPlayer[] = [];
  for (const athlete of roster.data as RosterAthlete[]) {
    const season = athlete.athlete_seasons.find(s => s.season === "2026-27");
    if (!season || !(season.roster_status === null || season.roster_status === "active" || season.roster_status === "redshirt")) continue;
    names.set(athlete.athlete_code, `${athlete.preferred_name ?? athlete.first_name} ${athlete.last_name}`);
    players.push({ code: athlete.athlete_code, role: roleLabel(season.player_type), position: [season.primary_position, season.secondary_position].filter(Boolean).join("/"),
      academicClass: season.academic_class ?? "", batsThrows: season.bats || season.throws ? `B ${season.bats ?? "?"} / T ${season.throws ?? "?"}` : "" });
  }
  players.sort((a, b) => a.code.localeCompare(b.code));
  const comparisons = [
    ...visibleLeaderboardComparisons("physicality", options),
    ...visibleLeaderboardComparisons("hitting", options, "in_game"),
    ...visibleLeaderboardComparisons("hitting", options, "practice"),
    ...visibleLeaderboardComparisons("throwing", options, "practice"),
    ...selectPitchLeaderboards(options).comparisons,
  ].filter(c => c.period === "fall_2026" || c.period === "summer_2026");
  const results = comparisons.length ? await loadLeaderboards(access, comparisons).catch(() => []) : [];
  const boards: AskTestingBoard[] = comparisons.flatMap((comparison, index) => {
    const rows = results[index], metric = LEADERBOARD_METRICS.find(m => m.key === comparison.metricKey);
    if (!rows || rows instanceof Error || !metric || !rows.length) return [];
    const pitch = leaderboardPitchType(comparison.source);
    return [{ label: pitch ? pitchLeaderboardLabel(metric, comparison.source) : profileMetricLabel(metric.key, leaderboardMetricLabel(metric), comparison.source),
      context: `${pitch ? (leaderboardSession(comparison.source) === "in_game" ? "In-Game" : "Practice") : leaderboardSourceLabel(comparison.source)}${comparison.period === "summer_2026" ? ", summer" : ""}`, unit: comparison.unit,
      rows: rows.map(row => ({ code: row.athleteCode, rank: row.rank, date: row.measuredAt,
        value: isTimedMetric(metric.key) && comparison.unit === "s" ? `${row.value.toFixed(2)} s` : `${formatMetricNumber(row.value, metric.key, comparison.source)} ${comparison.unit}`,
        sample: row.sampleCount != null && row.sampleUnit ? `${row.sampleCount} ${row.sampleUnit}` : null })) }];
  });
  return { data: askData(players, gameRows, boards, { batting: summary?.batting ?? null, pitching: summary?.pitching ?? null }), names, players: players.length };
}
