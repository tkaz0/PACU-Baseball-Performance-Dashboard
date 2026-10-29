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
/** `score` is the series value (bases above average or baserunners prevented), rounded to one decimal. */
export type RaceEntry = SpotlightCard & { rank: number; score: number };
export type BwsRace = { entries: RaceEntry[]; qualified: number; minimum: string };
export type BwsRaces = { mvp: BwsRace | null; cyYoung: BwsRace | null };
const pitchesRole = (player: WeekPlayer) => { const type = player.playerType.trim().toLowerCase(); return ["pitcher", "two_way"].includes(type) || [player.position, player.secondaryPosition].some(p => p?.trim().toUpperCase() === "P"); };
const inDiscipline = (player: WeekPlayer, discipline: TopDiscipline) => discipline === "pitching" ? pitchesRole(player) : !pitchesRole(player) || player.playerType.trim().toLowerCase() === "two_way";
/**
 * Series value over the whole BWS, compared with the team's pooled BWS rate (everyone in the discipline, not only
 * qualified players). Hitting: bases above average = (TB + BB + HBP) − team rate × PA, with doubles/triples counted
 * as doubles like PAC Production+. Pitching: baserunners prevented = team (H + BB) per out × outs − (H + BB).
 * Incomplete counts give no value, never a zero.
 */
function seriesValues(players: WeekPlayer[], week: GameWeek, discipline: TopDiscipline) {
  const byCode = new Map<string, Map<string, number>>();
  for (const row of week.rows) { if (row.unit !== "count") continue; const own = byCode.get(row.athlete_id) ?? new Map(); own.set(row.metric, row.value); byCode.set(row.athlete_id, own); }
  const lines = players.filter(player => inDiscipline(player, discipline)).flatMap(player => {
    const c = byCode.get(player.code); if (!c) return [];
    const get = (k: string) => c.get(k);
    if (discipline === "hitting") {
      const pa = get("pa"), h = get("base_hit"), xbh = get("hh_extra_base_hit") ?? 0, hr = get("pumps") ?? 0, bb = get("bb") ?? 0, hbp = get("hbp") ?? 0;
      if (!pa || pa <= 0 || h === undefined || xbh + hr > h) return [];
      return [{ player, chances: pa, produced: h + xbh + 3 * hr + bb + hbp }];
    }
    const outs = get("innings_outs"), hits = get("h"), walks = get("bb_outcome");
    if (!outs || outs <= 0 || hits === undefined || walks === undefined) return [];
    return [{ player, chances: outs, produced: hits + walks }];
  });
  const rate = lines.reduce((t, l) => t + l.produced, 0) / Math.max(1, lines.reduce((t, l) => t + l.chances, 0));
  return lines.map(l => ({ ...l, value: discipline === "hitting" ? l.produced - rate * l.chances : rate * l.chances - l.produced }));
}
function race(players: WeekPlayer[], week: GameWeek, discipline: TopDiscipline): BwsRace {
  const rule = BWS_RACE_MINIMUM[discipline];
  const enough = new Set(week.rows.filter(row => row.metric === rule.metric && row.value >= rule.count).map(row => row.athlete_id));
  const values = seriesValues(players, week, discipline).filter(v => enough.has(v.player.code)).sort((a, b) => b.value - a.value || a.player.name.localeCompare(b.player.name));
  // Card stats keep the usual rates (PAC Production+ / QPA% / OPS, WHIP / K/BB / Runs/9) for the qualified group.
  const ids = new Map(players.map(player => [player.code, player.id]));
  const games = coachingGames(week.rows.flatMap(row => enough.has(row.athlete_id) && ids.has(row.athlete_id) ? [{ ...row, athlete_id: ids.get(row.athlete_id)! }] : []));
  const round = (v: number) => Math.round(v * 10) / 10, rankOf = (v: number) => 1 + values.filter(x => round(x.value) > round(v)).length;
  const entries = values.length >= 5 ? values.slice(0, 3).map((top): RaceEntry => {
    const stats = TOP_PERFORMER_METRICS[discipline].flatMap(metric => { const g = games.filter(x => x.athleteId === top.player.id && x.metric === metric.key && x.source === week.source); return g.length === 1 ? [{ label: metric.label, value: gameValue(g[0].value, g[0].unit), game: g[0] }] : []; });
    const value = round(top.value), unit = discipline === "hitting" ? "bases above average" : "baserunners prevented";
    return { key: `${discipline}:bws:${top.player.code}`, discipline, week: week.week, weekLabel: week.label, detail: week.detail, rank: rankOf(top.value), score: value,
      name: top.player.name, code: top.player.code, profileId: top.player.profileId ?? null, tied: values.filter(x => round(x.value) === value).length > 1,
      headline: { label: unit, value: `${value > 0 ? "+" : ""}${value.toFixed(1)}` },
      stats: stats.map(({ label, value }) => ({ label, value })),
      sample: stats[0] ? gameSampleText(stats[0].game.source, stats[0].game.metric, stats[0].game.opportunities) : null, early: false };
  }) : [];
  return { entries, qualified: values.length, minimum: rule.label };
}
/**
 * Owner choices (October 27–29): while the Boxer World Series is played, MVP (hitting) and Cy Young (pitching) are
 * races ranked by series value (bases above average / baserunners prevented vs the team's BWS rate), among hitters with
 * 4+ BWS PA and pitchers with 2+ BWS IP; at least five qualified players are needed. Fall Ball Players of the Week keep
 * the equal-weight Top Performer blend.
 */
export function bwsRaces(players: WeekPlayer[] | null, bws: GameWeekSet["bws"] | null | undefined): BwsRaces | null {
  if (!players || !bws || (!bws.hitting && !bws.pitching)) return null;
  return { mvp: bws.hitting ? race(players, bws.hitting, "hitting") : null, cyYoung: bws.pitching ? race(players, bws.pitching, "pitching") : null };
}
