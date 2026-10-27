import { coachingGames, type CoachingPlayer } from "@/lib/coaching-tools";
import { gameValue } from "@/lib/game-metrics";
import { gameSampleText, isEarlyGameSample } from "@/lib/game-opportunities";
import { fallBallWeekDate, type GameWeek, type GameWeekSet } from "@/lib/game-weeks";
import { TOP_PERFORMER_METRICS, topPerformers, type TopDiscipline } from "@/lib/top-performers";

export type SpotlightStat = { label: string; value: string };
export type SpotlightCard = {
  key: string; discipline: TopDiscipline; week: number; weekLabel: string; detail: string;
  name: string; code: string; profileId: string | null; tied: boolean;
  headline: SpotlightStat; stats: SpotlightStat[]; sample: string | null; early: boolean;
};
/** Roster identity from the narrow weekly projection; profileId is null for peers in a player view. */
export type WeekPlayer = CoachingPlayer & { profileId: string | null };
export type SpotlightWeek = { week: number; label: string; date: string | null; hitting: SpotlightCard | null; pitching: SpotlightCard | null };

/** #1 on the same equal-weight Top Performer blend, using only that week's counts. Ties are disclosed, never broken. */
function weekLeader(players: WeekPlayer[], week: GameWeek, discipline: TopDiscipline): SpotlightCard | null {
  const ids = new Map(players.map(player => [player.code, player.id]));
  const rows = week.rows.flatMap(row => ids.has(row.athlete_id) ? [{ ...row, athlete_id: ids.get(row.athlete_id)! }] : []);
  const ranked = topPerformers({ players, games: coachingGames(rows) }, discipline).filter(row => row.rank === 1);
  const top = ranked[0];
  if (!top) return null;
  const metrics = TOP_PERFORMER_METRICS[discipline].map(metric => ({ metric, game: top.stats[metric.key] }));
  const [first, ...rest] = metrics;
  if (!first.game) return null;
  return {
    key: `${discipline}:${week.week}`, discipline, week: week.week, weekLabel: week.label, detail: week.detail,
    name: top.player.name, code: top.player.code, profileId: (top.player as WeekPlayer).profileId ?? null, tied: ranked.length > 1,
    headline: { label: first.metric.label, value: gameValue(first.game.value, first.game.unit) },
    stats: rest.flatMap(({ metric, game }) => game ? [{ label: metric.label, value: gameValue(game.value, game.unit) }] : []),
    sample: gameSampleText(first.game.source, first.game.metric, first.game.opportunities),
    early: metrics.some(({ game }) => !!game && isEarlyGameSample(game.source, game.metric, game.opportunities)),
  };
}

/** Newest week first. A week appears when either discipline has a complete ranked leader. */
export function playersOfTheWeek(players: WeekPlayer[] | null, weeks: { hitting: GameWeek[]; pitching: GameWeek[] } | null): SpotlightWeek[] {
  if (!players || !weeks) return [];
  const numbers = [...new Set([...weeks.hitting, ...weeks.pitching].map(week => week.week))].sort((a, b) => b - a);
  return numbers.flatMap(number => {
    const hittingWeek = weeks.hitting.find(week => week.week === number), pitchingWeek = weeks.pitching.find(week => week.week === number);
    const hitting = hittingWeek ? weekLeader(players, hittingWeek, "hitting") : null;
    const pitching = pitchingWeek ? weekLeader(players, pitchingWeek, "pitching") : null;
    return hitting || pitching ? [{ week: number, label: `Week ${number}`, date: fallBallWeekDate(number), hitting, pitching }] : [];
  });
}

/** Owner minimums (October 27): BWS races count hitters with 4+ PA and pitchers with 2+ IP in the series. */
export const BWS_RACE_MINIMUM = { hitting: { metric: "pa", count: 4, label: "4 PA" }, pitching: { metric: "innings_outs", count: 6, label: "2 IP" } } as const;
export type RaceEntry = SpotlightCard & { rank: number; score: number };
export type BwsRace = { entries: RaceEntry[]; qualified: number; minimum: string };
export type BwsRaces = { mvp: BwsRace | null; cyYoung: BwsRace | null };
function race(players: WeekPlayer[], week: GameWeek, discipline: TopDiscipline): BwsRace {
  const rule = BWS_RACE_MINIMUM[discipline];
  const enough = new Set(week.rows.filter(row => row.metric === rule.metric && row.value >= rule.count).map(row => row.athlete_id));
  const ids = new Map(players.map(player => [player.code, player.id]));
  const rows = week.rows.flatMap(row => enough.has(row.athlete_id) && ids.has(row.athlete_id) ? [{ ...row, athlete_id: ids.get(row.athlete_id)! }] : []);
  const ranked = topPerformers({ players, games: coachingGames(rows) }, discipline).filter(row => row.rank !== null && row.score !== null).sort((a, b) => a.rank! - b.rank!);
  // Top three places; ties beyond three spots are disclosed by the Tied label rather than listed.
  const entries = ranked.filter(row => row.rank! <= 3).slice(0, 3).flatMap((top): RaceEntry[] => {
    const metrics = TOP_PERFORMER_METRICS[discipline].map(metric => ({ metric, game: top.stats[metric.key] }));
    const [first, ...rest] = metrics;
    if (!first.game) return [];
    return [{ key: `${discipline}:bws:${top.player.code}`, discipline, week: week.week, weekLabel: week.label, detail: week.detail, rank: top.rank!, score: top.score!,
      name: top.player.name, code: top.player.code, profileId: (top.player as WeekPlayer).profileId ?? null, tied: ranked.filter(r => r.rank === top.rank).length > 1,
      headline: { label: first.metric.label, value: gameValue(first.game.value, first.game.unit) },
      stats: rest.flatMap(({ metric, game }) => game ? [{ label: metric.label, value: gameValue(game.value, game.unit) }] : []),
      sample: gameSampleText(first.game.source, first.game.metric, first.game.opportunities), early: false }];
  });
  return { entries, qualified: new Set(rows.map(row => row.athlete_id)).size, minimum: rule.label };
}
/**
 * Owner request (October 27): while the Boxer World Series is being played, MVP (hitting) and Cy Young (pitching)
 * are races, not awards: the top three on the same equal-weight Top Performer blend using BWS counts only,
 * among players who reached the minimum. The blend still needs five complete qualified lines. Ties are disclosed.
 */
export function bwsRaces(players: WeekPlayer[] | null, bws: GameWeekSet["bws"] | null | undefined): BwsRaces | null {
  if (!players || !bws || (!bws.hitting && !bws.pitching)) return null;
  return { mvp: bws.hitting ? race(players, bws.hitting, "hitting") : null, cyYoung: bws.pitching ? race(players, bws.pitching, "pitching") : null };
}
