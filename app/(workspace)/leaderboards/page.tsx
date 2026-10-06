import { GameLeaderboard } from "@/components/game-leaderboard";
import { loadGameLeaderboards } from "@/lib/game-comparison-server";
import { requireRenderAccess as requireAccess } from "@/lib/render-access";
import { PageHeading } from "@/components/page-heading";
import { LeaderboardBoard } from "@/components/leaderboard-board";
import { loadTeamHeadshots } from "@/lib/headshots-server";
import { loadLeaderboards, loadLeaderboardComparisons } from "@/lib/leaderboard-server";
import { LEADERBOARD_GROUPS, selectPitchLeaderboards, visibleLeaderboardComparisons } from "@/lib/leaderboards";

export default async function LeaderboardsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requireAccess(["admin", "coach", "player"]);
  const query = await searchParams;
  if(query.group === "games") return <><PageHeading section="Team" title="Leaderboards" description="Fall 2026 · Team game rankings."/><GameLeaderboard rows={await loadGameLeaderboards(access)} discipline={query.discipline==="pitching"?"pitching":"hitting"}/></>;
  const group = LEADERBOARD_GROUPS.find(group => group === query.group) ?? "physicality";
  const session = query.session === "practice" || (group === "throwing" && query.session !== "in_game") ? "practice" : "in_game";
  const comparisons = visibleLeaderboardComparisons(group, await loadLeaderboardComparisons(access), session);
  const pitchSelection = selectPitchLeaderboards(comparisons, typeof query.pitch === "string" ? query.pitch : undefined);
  const selected = group === "pitching" ? pitchSelection.comparisons : comparisons;
  // One unavailable board must not take down the page: it is hidden with a notice; no stale values are shown.
  const results = await loadLeaderboards(access, selected);
  const failed = selected.filter((comparison, index) => {
    const result = results[index];
    if (result instanceof Error) console.error("Leaderboard board failed:", comparison.metricKey, comparison.source, result.message);
    return result instanceof Error;
  });
  const panels = selected.map((comparison, index) => { const result = results[index]; return { comparison, rows: result instanceof Error ? [] : result }; });
  const position = query.pos === "pitchers" || query.pos === "position" ? query.pos : "all";
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 60) : "";
  return <><PageHeading section="Team" title="Leaderboards" description="Fall 2026 · Recorded team results." />{failed.length > 0 && <p role="status" className="notice mb-4 text-sm">{failed.length === 1 ? "One leaderboard is" : `${failed.length} leaderboards are`} temporarily unavailable. Refresh to try again.</p>}<LeaderboardBoard group={group} panels={panels} session={session} pitches={pitchSelection.pitches} selectedPitch={pitchSelection.selectedPitch} position={position} search={search} headshots={panels.some(panel => panel.rows.length) ? Object.fromEntries(await loadTeamHeadshots(access)) : {}} /></>;
}
