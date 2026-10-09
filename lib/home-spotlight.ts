import type { CoachingGame, CoachingPlayer } from "@/lib/coaching-tools";
import { gameValue } from "@/lib/game-metrics";
import { gameSampleText, isEarlyGameSample } from "@/lib/game-opportunities";
import type { HomeLeaderboard } from "@/lib/home-leaderboards";
import { TOP_PERFORMER_METRICS, topPerformers, type TopDiscipline } from "@/lib/top-performers";

export type SpotlightStat = { label: string; value: string };
export type SpotlightCard = {
  key: string; title: string; name: string; code: string; profileId: string | null; tied: boolean;
  headline: SpotlightStat; stats: SpotlightStat[]; sample: string | null; early: boolean; basis: string; href: string;
};

/** #1 Top Performer from the same complete same-snapshot ranking; ties are disclosed, never broken. */
function leader(data: { players: CoachingPlayer[]; games: CoachingGame[] }, discipline: TopDiscipline): SpotlightCard | null {
  const ranked = topPerformers(data, discipline).filter(row => row.rank === 1);
  const top = ranked[0];
  if (!top) return null;
  const [first, ...rest] = TOP_PERFORMER_METRICS[discipline].map(metric => ({ metric, game: top.stats[metric.key] }));
  if (!first.game) return null;
  const sampleGame = first.game;
  return {
    key: discipline, title: discipline === "hitting" ? "Top Hitter" : "Top Pitcher",
    name: top.player.name, code: top.player.code, profileId: top.player.id, tied: ranked.length > 1,
    headline: { label: first.metric.label, value: gameValue(sampleGame.value, sampleGame.unit) },
    stats: rest.flatMap(({ metric, game }) => game ? [{ label: metric.label, value: gameValue(game.value, game.unit) }] : []),
    sample: gameSampleText(sampleGame.source, sampleGame.metric, sampleGame.opportunities),
    early: TOP_PERFORMER_METRICS[discipline].some(metric => { const game = top.stats[metric.key]; return !!game && isEarlyGameSample(game.source, game.metric, game.opportunities); }),
    basis: "#1 Top Performer score · cumulative Fall game stats", href: "/top-performers",
  };
}

/** Practice leader is the first row of the existing Home bat-speed leaderboard projection. */
function practice(boards: readonly HomeLeaderboard[]): SpotlightCard | null {
  const board = boards.find(item => item.key === "bat");
  const top = board?.rows[0];
  if (!board || !top) return null;
  return {
    key: "practice", title: "Practice Standout", name: top.name, code: top.code, profileId: top.profileId,
    tied: board.rows.filter(row => row.rank === 1).length > 1,
    headline: { label: board.title, value: top.value }, stats: [], sample: top.sample ?? null, early: !!top.early,
    basis: `#1 on the ${board.title} leaderboard`, href: board.href,
  };
}

export function homeSpotlight(data: { players: CoachingPlayer[]; games: CoachingGame[] } | null, boards: readonly HomeLeaderboard[]): SpotlightCard[] {
  return [data && leader(data, "hitting"), data && leader(data, "pitching"), practice(boards)].filter((card): card is SpotlightCard => !!card);
}
