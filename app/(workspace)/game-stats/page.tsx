import { loadTeamGameTrends } from "@/lib/game-trends-server";
import { ScaleLegend } from "@/components/charts/scale-legend";
import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { loadGameStats } from "@/lib/game-server";
import { loadGameComparisons } from "@/lib/game-comparison-server";
import { AthleteGameStats } from "@/components/athlete-game-stats";
import { TeamGameStats } from "@/components/team-game-stats";
import { PageHeading } from "@/components/page-heading";

export default async function GameStatsPage() {
  const access = await requireAccess();
  if (canImportPresentedAccess(access)) {
    const stats = await loadGameStats(access);
    const ids = [...new Set(stats.map(row => row.athlete_id))];
    let names = new Map<string, string>();
    if (ids.length) {
      const { data, error } = await access.supabase.from("athletes").select("id,first_name,last_name").in("id", ids);
      if (error) throw new Error("Game roster could not be loaded.");
      names = new Map((data ?? []).map(a => [a.id, `${a.first_name} ${a.last_name}`]));
    }
    return <><PageHeading section="Team" title="Team Game Stats" description="Fall 2026 · Cumulative hitting and pitching."><Link href="/game-stats/review" className="btn btn-secondary">Data Review</Link></PageHeading><div className="mb-5"><ScaleLegend low="Poor" high="Elite" note="Bands compare the team with 2025 Northwest Conference teams. Red marks the top band, as on Baseball Savant."/></div><TeamGameStats stats={stats} names={names} trends={await loadTeamGameTrends(access)}/></>;
  }

  // Player View follows the presented athlete even when the real account is an Admin.
  const athleteId = access.athleteId;
  if (!athleteId) return <><PageHeading section="Team" title="My Game Stats" description="Fall 2026 · Cumulative results."/><p className="notice">Your account needs a player profile linked before game stats can appear.</p></>;
  const [stats, comparisons] = await Promise.all([
    loadGameStats(access, athleteId), loadGameComparisons(access, athleteId),
  ]);
  return <><PageHeading section="Team" title="My Game Stats" description="Fall 2026 · Cumulative results."><Link href={`/athletes/${athleteId}`} className="btn btn-secondary">My Profile</Link></PageHeading><AthleteGameStats stats={stats} comparisons={comparisons} showDetails={false}/></>;
}
