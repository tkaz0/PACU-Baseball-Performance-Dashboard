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
    return <><PageHeading section="Pacific Baseball / Competition" title="Team Game Stats" description="Fall 2026 · Cumulative hitting and pitching."><Link href="/game-stats/review" className="btn btn-secondary">Data Review</Link></PageHeading><TeamGameStats stats={stats} names={names}/></>;
  }

  // Player View follows the presented athlete even when the real account is an Admin.
  const athleteId = access.athleteId;
  if (!athleteId) return <><PageHeading section="Pacific Baseball / Competition" title="My Game Stats" description="Fall 2026 · Cumulative results."/><p className="notice">Your account needs a player profile linked before game stats can appear.</p></>;
  const [stats, comparisons] = await Promise.all([
    loadGameStats(access, athleteId), loadGameComparisons(access, athleteId),
  ]);
  return <><PageHeading section="Pacific Baseball / Competition" title="My Game Stats" description="Fall 2026 · Cumulative results."><Link href={`/athletes/${athleteId}`} className="btn btn-secondary">My Profile</Link></PageHeading><AthleteGameStats stats={stats} comparisons={comparisons} showDetails={false}/></>;
}
