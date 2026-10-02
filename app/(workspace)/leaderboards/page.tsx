import { GameLeaderboard } from "@/components/game-leaderboard";
import { loadGameLeaderboards } from "@/lib/game-comparison-server";
import { requireRenderAccess as requireAccess } from "@/lib/render-access";
import { PageHeading } from "@/components/page-heading";
import { LeaderboardBoard } from "@/components/leaderboard-board";
import { loadTeamHeadshots } from "@/lib/headshots-server";
import { loadLeaderboard, loadLeaderboardComparisons } from "@/lib/leaderboard-server";
import { LEADERBOARD_GROUPS, loadLeaderboardPanels, selectPitchLeaderboards, visibleLeaderboardComparisons } from "@/lib/leaderboards";

export default async function LeaderboardsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requireAccess(["admin", "coach", "player"]);
  const query = await searchParams;
  if(query.group === "games") return <><PageHeading section="Team" title="Leaderboards" description="Fall 2026 · Team game rankings."/><GameLeaderboard rows={await loadGameLeaderboards(access)} discipline={query.discipline==="pitching"?"pitching":"hitting"}/></>;
  const group = LEADERBOARD_GROUPS.find(group => group === query.group) ?? "physicality";
  const session = query.session === "practice" || (group === "throwing" && query.session !== "in_game") ? "practice" : "in_game";
  const comparisons = visibleLeaderboardComparisons(group, await loadLeaderboardComparisons(access), session);
  const pitchSelection = selectPitchLeaderboards(comparisons, typeof query.pitch === "string" ? query.pitch : undefined);
  const selected = group === "pitching" ? pitchSelection.comparisons : comparisons;
  const panels = await loadLeaderboardPanels(selected, comparison => loadLeaderboard(access, comparison));
  const position = query.pos === "pitchers" || query.pos === "position" ? query.pos : "all";
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 60) : "";
  return <><PageHeading section="Team" title="Leaderboards" description="Fall 2026 · Recorded team results." /><LeaderboardBoard group={group} panels={panels} session={session} pitches={pitchSelection.pitches} selectedPitch={pitchSelection.selectedPitch} position={position} search={search} headshots={panels.some(panel => panel.rows.length) ? Object.fromEntries(await loadTeamHeadshots(access)) : {}} /></>;
}
