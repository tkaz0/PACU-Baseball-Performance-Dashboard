import "server-only";
import { loadGameWeeks } from "@/lib/game-weeks-server";
import { playersOfTheWeek, type SpotlightCard } from "@/lib/home-spotlight";
import type { GraphicsWeek, GraphicsWeekCard } from "@/lib/graphics-data";
import type { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess, canReadPresentedAthlete } from "@/lib/access-preview";
import { UUID_PATTERN, athleteName, type RosterAthlete, formatClassYear } from "@/lib/types";
import { loadAthletePerformance, type AthletePerformanceData } from "@/lib/performance-server";
import { loadGameStats, type SharedGameStat } from "@/lib/game-server";
import { loadGameComparisons, loadGameLeaderboards } from "@/lib/game-comparison-server";
import { getPlayerPerformance, isTimedMetric, type PlayerFallSummary, type PlayerMetricCard } from "@/lib/player-performance";
import { loadPlayerFallSummaries } from "@/lib/player-fall-summaries-server";
import { getPlayerProfileLayout, profileShowsHitting, profileShowsPitching, withoutWeeklyBlastCards } from "@/lib/player-profile-layout";
import { profileMetricLabel } from "@/lib/profile-metric-label";
import { profileTrends } from "@/lib/profile-trends";
import { coachingValue } from "@/lib/coaching-tools";
import { gameOverviewMetrics } from "@/lib/game-overview";
import { GAME_METRIC_LABELS, gameValue, type GameComparison, type GameLeaderboardRow } from "@/lib/game-metrics";
import { gameOpportunityLabel, countLabel} from "@/lib/game-opportunities";
import { formatInnings } from "@/lib/pitching-stats";
import { fallArsenalPitches } from "@/lib/pitch-arsenal";
import { pitchTypeLabel } from "@/lib/imports/pitch-assignments";
import { blastFallSummary } from "@/lib/blast-fall";
import { BLAST_REPORT_METRICS, blastPracticeReports, blastUnit, formatBlastValue, parseBlastSource } from "@/lib/blast-metrics";
import { pacificTestingDate, validTestingDate } from "@/lib/testing-checklist";
import { loadLeaderboard, loadLeaderboardComparisons } from "@/lib/leaderboard-server";
import { LEADERBOARD_GROUPS, LEADERBOARD_METRICS, isPitchLeaderboardMetric, leaderboardGroup, leaderboardMetricLabel, leaderboardSourceLabel, loadLeaderboardPanels, pitchLeaderboardLabel, visibleLeaderboardComparisons } from "@/lib/leaderboards";
import type { GraphicsCategory, GraphicsLeaderboard, GraphicsMetric, GraphicsPlayerData } from "@/lib/graphics-data";

type Access = Awaited<ReturnType<typeof requireAccess>>;
export class GraphicsError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
const partition = (...parts: string[]) => JSON.stringify(parts);
const gameSource = (source: string) => source === "qpa_fall_2026" ? "QPA · Fall 2026" : "Pitching · Fall 2026";
const periodLabel = (period: string) => period === "summer_2026" ? "June–August 2026" : "Fall 2026";
const gameSample = (source: string, metric: string, count: number | null | undefined) => {
  const label = gameOpportunityLabel(source, metric);
  if (!label || count == null || !Number.isSafeInteger(count) || count <= 0) return "Sample not recorded";
  const early = (source === "qpa_fall_2026" && label === "PA" && count < 20) || (label === "pitches" && count < 50);
  return `${label === "outs" ? `${formatInnings(count)} IP` : countLabel(count,label)}${early ? " · Early sample" : ""}`;
};
const gameDate = (date: string) => `Updated ${pacificTestingDate(new Date(date))}`;

/** Pure allowlist projection of one previously authorized athlete, with a Pacific-calendar cutoff. */
export function buildGraphicsPlayerData(input: AthletePerformanceData & {
  athlete: RosterAthlete; games: readonly SharedGameStat[]; comparisons: readonly GameComparison[]; fallSummaries?: readonly PlayerFallSummary[];
}, today = pacificTestingDate()): GraphicsPlayerData {
  const { athlete } = input;
  const season = athlete.athlete_seasons.find(s => s.season === "2026-27");
  if (!season || !validTestingDate(today)) throw new GraphicsError("This player is not on the current roster.", 404);
  if (input.measurements.some(row => row.athlete_code !== athlete.athlete_code) || input.games.some(row => row.athlete_id.toLowerCase() !== athlete.id.toLowerCase())) throw new GraphicsError("The player result scope could not be verified.", 503);
  const readings = input.measurements.filter(row => row.athlete_code === athlete.athlete_code && validTestingDate(row.measured_at) && row.measured_at <= today && (!parseBlastSource(row.source) || parseBlastSource(row.source)!.end <= today));
  const performance = getPlayerPerformance({ readings, batches: input.batches, athleteCode: athlete.athlete_code, percentileOverrides: input.percentileOverrides, fallSummaries: input.fallSummaries });
  const layout = getPlayerProfileLayout(withoutWeeklyBlastCards(performance), season);
  const selected = [...layout.physicality, ...layout.additionalBody, ...performance.body.filter(card => card.metric.key === "body_score"), ...layout.speedAgility,
    ...(layout.showHitting ? [...layout.hitting, ...layout.otherHitting] : []), ...layout.fieldThrowing, ...layout.pitching];
  const cards = selected.flatMap(card => card.sourceCards ?? [card]).filter((card): card is PlayerMetricCard & { latest: NonNullable<PlayerMetricCard["latest"]> } => card.latest !== null);
  const metrics: GraphicsMetric[] = cards.map(card => {
    const latest = card.latest;
    const period = periodLabel(latest.period), timed = isTimedMetric(card.metric.key);
    const percentile = card.percentileStatus === "available" && card.percentile && card.percentile.sampleSize >= 5 ? card.percentile : null;
    return {
      key: partition(card.metric.key, latest.source, latest.unit, latest.period), label: profileMetricLabel(card.metric.key, card.metric.label, latest.source),
      category: card.metric.group === "body" || timed ? "physicality" : card.metric.group === "hitting" ? "hitting" : "pitching",
      value: latest.value, formatted: coachingValue(latest.value, card.metric.key, latest.unit, latest.source), unit: latest.unit, source: latest.source,
      context: `${period} · ${timed ? "Best time" : card.fallSummary ? (card.fallSummary.basis === "best" ? "Fall best" : card.fallSummary.pooled ? "Fall average" : "Latest session") : "Latest profile result"}`, date: card.fallSummary?.basis === "best" ? card.fallSummary.bestDate : latest.measuredAt,
      sample: [card.timedTrials ? `${card.timedTrials.count} trials` : card.fallSummary?.sampleCount && card.fallSummary.sampleUnit ? countLabel(card.fallSummary.sampleCount, card.fallSummary.sampleUnit) : "Sample not recorded", ...(percentile ? [`${percentile.sampleSize} comparable players`] : [])].join(" · "),
      percentile: percentile?.value ?? null, direction: card.metric.direction,
    };
  });
  if (profileShowsHitting(season)) {
    const blast = blastFallSummary(readings, BLAST_REPORT_METRICS.filter(metric => metric.unit !== "count").map(metric => metric.key));
    for (const metric of blast?.metrics ?? []) if (metric.average !== null && blast?.firstDate && blast.lastDate) metrics.push({
      key: partition(metric.key, "Blast Motion · Practice", metric.unit, "fall_weighted"), label: metric.label, category: "hitting",
      value: metric.average, formatted: `${formatBlastValue(metric.average, metric.unit)} ${blastUnit(metric.unit)}`, unit: metric.unit,
      source: "Blast Motion · Practice", context: "Fall 2026 · Swing-weighted average", date: `${blast.firstDate} to ${blast.lastDate}`,
      sample: `${blast.totalSwings} swings · ${blast.reportCount} reports`, percentile: null,
      direction: ["avg_bat_speed", "blast_peak_hand_speed"].includes(metric.key) ? "higher" : "neutral",
    });
    const peak = blast?.metrics.find(metric => metric.key === "avg_bat_speed");
    if (peak?.peak != null && blast?.peakPeriod) {
      const period = blast.peakPeriod;
      const count = blastPracticeReports(readings).find(report => report.start === period.start && report.end === period.end)?.p95.find(row => row.metric === "Blast Swing Count" && row.unit === "count")?.value;
      metrics.push({ key: partition("p95_bat_speed", "Blast Motion · Practice", "mph", "latest_weekly_p95"), label: "Peak Bat Speed (95th)", category: "hitting",
        value: peak.peak, formatted: `${formatBlastValue(peak.peak, "mph")} mph`, unit: "mph", source: "Blast Motion · Practice",
        context: "Latest weekly 95th percentile", date: `${period.start} to ${period.end}`, sample: count != null ? `${count} swings` : "Sample not recorded", percentile: null, direction: "higher" });
    }
  }
  // Preserve whole snapshots. A future dated observation withholds its source instead of making a partial total.
  const ownGames = input.games.filter(row => row.athlete_id.toLowerCase() === athlete.id.toLowerCase());
  const futureSources = new Set(ownGames.filter(row => row.played_on !== null && row.played_on > today).map(row => row.source));
  const games = ownGames.filter(row => !futureSources.has(row.source));
  for (const metric of gameOverviewMetrics(games, input.comparisons)) {
    const hitting = metric.source === "qpa_fall_2026";
    if (hitting ? !profileShowsHitting(season) : !profileShowsPitching(season)) continue;
    // A comparison spanning a refreshed snapshot must not match, even on the same calendar date.
    metrics.push({ key: partition(metric.metric, metric.source, metric.unit, metric.eventId, metric.updatedAt), label: metric.label,
      category: hitting ? "game-hitting" : "game-pitching", value: metric.value, formatted: gameValue(metric.value, metric.unit), unit: metric.unit,
      source: gameSource(metric.source), context: "Fall 2026 · To date", date: gameDate(metric.updatedAt),
      sample: gameSample(metric.source, metric.metric, metric.opportunities), percentile: metric.comparison?.percentile ?? null, direction: metric.direction });
  }
  const arsenals = profileShowsPitching(season) ? fallArsenalPitches(readings, today).map(pitch => ({
    source: pitch.source, label: pitchTypeLabel(pitch.pitchType), pitchType: pitch.pitchType, category: pitch.category,
    averageVelocity: pitch.averageVelocity, maxVelocity: pitch.maxVelocity, averageSpin: pitch.averageSpin, maxSpin: pitch.maxSpin,
    velocityCount: pitch.velocityReadings, spinCount: pitch.spinReadings, firstDate: pitch.firstDate, lastDate: pitch.lastDate,
    velocityBasis: pitch.velocityBasis, spinBasis: pitch.spinBasis,
    velocityFirstDate: pitch.velocityAverageFirstDate, velocityLastDate: pitch.velocityAverageLastDate,
    spinFirstDate: pitch.spinAverageFirstDate, spinLastDate: pitch.spinAverageLastDate,
    maxVelocityDate: pitch.maxVelocityDate, maxSpinDate: pitch.maxSpinDate,
    basis: `Velocity: ${pitch.velocityBasis === "fall" ? "Fall weighted average" : pitch.velocityBasis === "latest" ? "latest verified average" : "average unavailable"}; spin: ${pitch.spinBasis === "fall" ? "Fall weighted average" : pitch.spinBasis === "latest" ? "latest verified average" : "average unavailable"}; maximums: Fall best`,
  })) : [];
  const trends = cards.flatMap(card => profileTrends([card]).map(trend => ({
    key: partition(card.metric.key, card.latest.source, card.latest.unit, card.latest.period), label: trend.label, unit: trend.unit, source: trend.source,
    context: `${trend.period} · Recorded results`, points: trend.points.map(point => ({ date: point.date, value: point.value })),
  })));
  return { player: { id: athlete.id, name: athleteName(athlete), code: athlete.athlete_code, position: season.primary_position ?? "", secondaryPosition: season.secondary_position ?? "",
    academicClass: formatClassYear(season.academic_class), bats: season.bats ?? "", throws: season.throws ?? "" }, metrics, arsenals, trends };
}

/** The effective presentation role is checked before roster lookup, including Admin-as-Player. */
export async function loadGraphicsPlayer(access: Access, athleteId: string): Promise<GraphicsPlayerData> {
  if (!UUID_PATTERN.test(athleteId)) throw new GraphicsError("Choose a rostered player.", 400);
  if (!canReadPresentedAthlete(access, athleteId)) throw new GraphicsError("Choose your linked player profile.", 403);
  const { data, error } = await access.supabase.from("athletes")
    .select("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons(*)").eq("id", athleteId).maybeSingle();
  if (error) throw new GraphicsError("This player could not be loaded. Try again.", 503);
  if (!data || data.id.toLowerCase() !== athleteId.toLowerCase() || !data.athlete_seasons?.some((s: { season: string }) => s.season === "2026-27")) throw new GraphicsError("This player is not on the current roster.", 404);
  const athlete = data as RosterAthlete;
  const [performance, games, comparisons] = await Promise.all([loadAthletePerformance(access, athlete), loadGameStats(access, athlete.id), loadGameComparisons(access, athlete.id)]);
  const fallSummaries = await loadPlayerFallSummaries(access, athlete.athlete_code, performance.measurements).catch(() => []);
  return buildGraphicsPlayerData({ athlete, ...performance, games, comparisons, fallSummaries });
}

function gameBoards(rows: readonly GameLeaderboardRow[], today: string): GraphicsLeaderboard[] {
  const groups = new Map<string, GameLeaderboardRow[]>();
  for (const row of rows) {
    if (row.eventId !== "" && row.eventId !== "fall-2026-cumulative") continue;
    const key = partition(row.metric, row.source, row.unit, row.eventId);
    const group = groups.get(key) ?? []; group.push(row); groups.set(key, group);
  }
  return [...groups].flatMap(([key, group]): GraphicsLeaderboard[] => {
    if (group.some(row => Date.parse(row.updatedAt) > Date.now() + 300000 || !Number.isFinite(Date.parse(row.updatedAt)) || pacificTestingDate(new Date(row.updatedAt)) > today)) return [];
    const row = group[0];
    return [{ key, label: GAME_METRIC_LABELS[row.metric] ?? ({ strike_pct: "Strike %", k: "Strikeouts", bb_outcome: "Walks Allowed", pitches: "Pitches" }[row.metric] ?? row.metric),
      category: row.source === "qpa_fall_2026" ? "game-hitting" : "game-pitching", unit: row.unit, source: gameSource(row.source), context: "Fall 2026 · To date", period: "Fall 2026",
      date: gameDate(group.map(item => item.updatedAt).sort().at(-1)!),
      rows: [...group].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)).map(item => ({ name: item.name, rank: item.rank, value: item.value, formatted: gameValue(item.value, item.unit), sample: gameSample(item.source, item.metric, item.opportunities), date: gameDate(item.updatedAt) })),
    }];
  });
}

/** Team graphics are staff-only. These existing readers already validate eligibility, ties and source partitions. */
export async function loadGraphicsLeaderboards(access: Access): Promise<GraphicsLeaderboard[]> {
  if (!canImportPresentedAccess(access)) throw new GraphicsError("Team graphics are available to coaches and admins.", 403);
  const [options, games] = await Promise.all([loadLeaderboardComparisons(access), loadGameLeaderboards(access)]);
  const selected = [...new Map(LEADERBOARD_GROUPS.flatMap(group => group === "physicality" ? visibleLeaderboardComparisons(group, options) : ["in_game", "practice"].flatMap(session => visibleLeaderboardComparisons(group, options, session as "in_game" | "practice")))
    .map(option => [partition(option.metricKey, option.source, option.unit, option.period), option])).values()];
  const panels = await loadLeaderboardPanels(selected, selection => loadLeaderboard(access, selection));
  const today = pacificTestingDate();
  const boards: GraphicsLeaderboard[] = panels.flatMap(({ comparison, rows }) => {
    // Do not remove a future row and leave ranks that depended on it: withhold that entire board.
    if (!rows.length || rows.some(row => row.measuredAt > today)) return [];
    const metric = LEADERBOARD_METRICS.find(metric => metric.key === comparison.metricKey)!;
    const group = leaderboardGroup(metric), category: GraphicsCategory = group === "throwing" ? "pitching" : group;
    return [{ key: partition(comparison.metricKey, comparison.source, comparison.unit, comparison.period), label: isPitchLeaderboardMetric(metric.key) ? pitchLeaderboardLabel(metric, comparison.source) : leaderboardMetricLabel(metric), category,
      unit: comparison.unit, source: leaderboardSourceLabel(comparison.source), context: `${periodLabel(comparison.period)} · Team ranking`, period: periodLabel(comparison.period),
      date: rows.map(row => row.measuredAt).sort().at(-1)!, rows: rows.map(row => ({ name: row.name, rank: row.rank, value: row.value,
        formatted: coachingValue(row.value, comparison.metricKey, comparison.unit, comparison.source), sample: row.sampleCount != null && row.sampleUnit ? `${row.sampleCount} ${row.sampleUnit}` : "Sample not recorded", date: row.measuredAt })),
    }];
  });
  return [...boards, ...gameBoards(games, today)];
}

/** Every linked player and staff account: the same weekly leaders as Home, without codes or profile ids. */
export async function loadGraphicsWeekly(access: Awaited<ReturnType<typeof requireAccess>>): Promise<GraphicsWeek[]> {
  const weekly = await loadGameWeeks(access);
  if (!weekly) throw new GraphicsError("Players of the Week needs a linked player or staff account.", 403);
  const card = (item: SpotlightCard | null): GraphicsWeekCard | null => item && { name: item.name, headlineValue: item.headline.value, headlineLabel: item.headline.label, stats: item.stats, sample: item.sample ?? "", early: item.early, tied: item.tied };
  return playersOfTheWeek(weekly.players, weekly.weeks).map(week => ({ week: week.week, label: week.label, date: week.date, hitting: card(week.hitting), pitching: card(week.pitching) }));
}
