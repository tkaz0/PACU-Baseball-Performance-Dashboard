import { GameLeaderboard } from "@/components/game-leaderboard";
import { loadGameLeaderboards } from "@/lib/game-comparison-server";
import { requireAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { LeaderboardBoard } from "@/components/leaderboard-board";
import { loadLeaderboard, loadLeaderboardComparisons } from "@/lib/leaderboard-server";
import { LEADERBOARD_GROUPS, selectPitchLeaderboards, visibleLeaderboardComparisons } from "@/lib/leaderboards";

export default async function LeaderboardsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requireAccess(["admin", "coach", "player"]);
  const query = await searchParams;
  if(query.group === "games") return <><PageHeading section="Pacific Baseball / Team Results" title="Leaderboards" description="Fall 2026 · Team game rankings."/><GameLeaderboard rows={await loadGameLeaderboards(access)} discipline={query.discipline==="pitching"?"pitching":"hitting"}/></>;
  const group = LEADERBOARD_GROUPS.find(group => group === query.group) ?? "physicality";
  const session = query.session === "practice" || (group === "throwing" && query.session !== "in_game") ? "practice" : "in_game";
  const comparisons = visibleLeaderboardComparisons(group, await loadLeaderboardComparisons(access), session);
  const pitchSelection = selectPitchLeaderboards(comparisons, typeof query.pitch === "string" ? query.pitch : undefined);
  const selected = group === "pitching" ? pitchSelection.comparisons : comparisons;
  const panels = await Promise.all(selected.map(async comparison => ({ comparison, rows: await loadLeaderboard(access, comparison) })));
  return <><PageHeading section="Pacific Baseball / Team Results" title="Leaderboards" description="Fall 2026 · Recorded team results." /><LeaderboardBoard group={group} panels={panels} session={session} pitches={pitchSelection.pitches} selectedPitch={pitchSelection.selectedPitch} /></>;
}
