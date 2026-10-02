import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRenderAccess as requireAccess } from "@/lib/render-access";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { athleteName, display, formatClassYear, UUID_PATTERN, type RosterAthlete } from "@/lib/types";
import { loadAthletePerformance } from "@/lib/performance-server";
import { getPlayerPerformance } from "@/lib/player-performance";
import { getPlayerProfileLayout, profileShowsPitching } from "@/lib/player-profile-layout";
import { profileMetricLabel } from "@/lib/profile-metric-label";
import { leaderboardMetricLabel, leaderboardTestDate } from "@/lib/leaderboards";
import { formatHeight, formatMetricNumber } from "@/lib/measurement-display";
import { profileTrends } from "@/lib/profile-trends";
import { recentPersonalBest } from "@/lib/personal-bests";
import { loadGameStats } from "@/lib/game-server";
import { loadGameComparisons } from "@/lib/game-comparison-server";
import { gameOverviewMetrics } from "@/lib/game-overview";
import { gameValue } from "@/lib/game-metrics";
import { countLabel } from "@/lib/game-opportunities";
import { loadAthleteHeadshot } from "@/lib/headshots-server";
import { percentileColor } from "@/lib/percentile-color";
import { PlayerAvatar } from "@/components/player-avatar";
import { PacificLogo } from "@/components/pacific-brand";
import { PercentileRing } from "@/components/charts/percentile-ring";
import { Sparkline } from "@/components/charts/sparkline";
import { ClassifiedPitchResults } from "@/components/classified-pitch-results";
import { PrintButton } from "@/components/print-button";
import styles from "./report.module.css";

export const metadata = { title: "Player Report" };
const REPORT_TESTS = 10;
const REPORT_GAME_KEYS = ["batting_production_plus", "batting_avg", "batting_obp", "batting_est_slg", "batting_bb_pct", "batting_k_pct", "pitching_whip", "pitching_k_bb", "pitching_k9", "pitching_bb9", "strike_pct"];

/** One-page printable summary of the same results the profile already shows to this viewer. */
export default async function PlayerReport({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireAccess();
  const { id } = await params;
  if (!UUID_PATTERN.test(id) || !canReadPresentedAthlete(access, id)) notFound();
  const { data, error } = await access.supabase.from("athletes").select("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons(*)").eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load this player report.");
  if (!data) notFound();
  const athlete = data as RosterAthlete;
  const season = athlete.athlete_seasons.find(item => item.season === "2026-27") ?? [...athlete.athlete_seasons].sort((a, b) => b.season.localeCompare(a.season))[0];
  const [shared, gameStats, gameComparisons, headshot] = await Promise.all([
    loadAthletePerformance(access, athlete, { includePercentiles: true }), loadGameStats(access, athlete.id), loadGameComparisons(access, athlete.id), loadAthleteHeadshot(access, athlete.id),
  ]);
  const performance = getPlayerPerformance({ readings: shared.measurements, batches: shared.batches, athleteCode: athlete.athlete_code, cohortAthleteCodes: [], percentileOverrides: shared.percentileOverrides });
  const layout = getPlayerProfileLayout(performance, season);
  // One page: the most informative tests first (team percentile available), then the rest, capped.
  const allCards = [...layout.physicality, ...layout.speedAgility, ...(layout.showHitting ? layout.hitting : []), ...layout.fieldThrowing, ...layout.pitching].filter(card => card.latest);
  const cards = [...allCards.filter(card => card.percentile && card.percentile.sampleSize >= 5), ...allCards.filter(card => !(card.percentile && card.percentile.sampleSize >= 5))].slice(0, REPORT_TESTS);
  const hiddenTests = allCards.length - cards.length;
  const trends = new Map(profileTrends(cards).map(trend => [trend.key, trend]));
  const today = new Date().toISOString().slice(0, 10);
  const allGames = gameOverviewMetrics(gameStats, gameComparisons);
  const games = REPORT_GAME_KEYS.flatMap(key => allGames.filter(game => game.metric === key));
  const ranked = [
    ...cards.filter(card => card.percentile && card.percentile.sampleSize >= 5).map(card => ({ key: `t-${card.metric.key}-${card.latest!.source}`, label: profileMetricLabel(card.metric.key, leaderboardMetricLabel(card.metric), card.latest!.source), value: card.percentile!.value, neutral: card.metric.direction === "neutral" })),
    ...games.filter(game => game.comparison && game.comparison.sampleSize >= 5 && game.comparison.percentile !== null).map(game => ({ key: `g-${game.metric}`, label: `${game.label} · In-Game`, value: game.comparison!.percentile!, neutral: game.direction === "neutral" })),
  ].sort((a, b) => b.value - a.value);
  const heroes = ranked.filter(item => !item.neutral).slice(0, 4);
  const value = (card: (typeof cards)[number]) => card.metric.key === "height" ? formatHeight(card.latest!.value, card.latest!.unit) ?? "" : `${formatMetricNumber(card.latest!.value, card.metric.key, card.latest!.source)}${card.latest!.unit === "ratio" ? "" : card.latest!.unit === "%" ? "%" : ` ${card.latest!.unit}`}`;
  const position = [season?.primary_position, season?.secondary_position].filter((p, i, all) => p && all.indexOf(p) === i).join(" / ");
  return <div className={styles.page}>
    <div className={`${styles.actions} no-print`}><Link href={`/athletes/${athlete.id}`} className="profile-back"><ArrowLeft size={15}/>Back to Profile</Link><PrintButton/><p className="muted m-0 text-xs">In the print window, choose “Save as PDF.”</p></div>
    <article className={styles.report} aria-label={`${athleteName(athlete)} Fall 2026 player report`}>
      <header className={styles.header}>
        <PlayerAvatar name={athleteName(athlete)} path={headshot} size={72} eager className={styles.photo}/>
        <div className={styles.identity}><p className={styles.kicker}>Pacific Baseball · Fall 2026 Player Report</p><h1>{athleteName(athlete)}</h1><p>{position || "Position to be added"} · #{display(season?.jersey_number)} · B/T {display(season?.bats)}/{display(season?.throws)}{season?.academic_class ? ` · ${formatClassYear(season.academic_class)}` : ""}</p></div>
        <div className={styles.brand}><PacificLogo className="w-12" decorative/><small>Generated {leaderboardTestDate(today)}</small></div>
      </header>
      {heroes.length > 0 && <section className={styles.heroes} aria-label="Top team percentiles">{heroes.map(item => <div key={item.key}><PercentileRing value={item.value} label={item.label} size={44}/><span>{item.label}</span></div>)}</section>}
      <div className={styles.columns}>
        <section aria-label="Testing results"><h2>Testing Results</h2><table className={styles.table}><thead><tr><th>Measurement</th><th>Result</th><th>Trend</th><th>Pctl</th></tr></thead><tbody>{cards.map(card => {
          const trend = trends.get(card.metric.key), best = recentPersonalBest(card, today), pct = card.percentile && card.percentile.sampleSize >= 5 ? Math.round(card.percentile.value) : null;
          return <tr key={`${card.metric.key}-${card.latest!.source}`}><td><strong>{profileMetricLabel(card.metric.key, leaderboardMetricLabel(card.metric), card.latest!.source)}</strong><small>{leaderboardTestDate(card.latest!.measuredAt)}{best ? " · New Fall Best" : ""}</small></td><td className={styles.num}>{value(card)}</td><td>{trend ? <Sparkline points={trend.points} width={64} height={16} label={`${card.metric.label} trend`} lowerIsBetter={card.metric.direction === "lower"}/> : <span className={styles.muted}>—</span>}</td><td>{pct === null ? <span className={styles.muted}>—</span> : <span className={styles.pctl} style={card.metric.direction === "neutral" ? undefined : percentileColor(pct)}>{pct}</span>}</td></tr>;
        })}</tbody></table>{!cards.length && <p className={styles.muted}>No Fall testing results yet.</p>}{hiddenTests > 0 && <p className={styles.more}>+{hiddenTests} more on the full profile</p>}</section>
        <section aria-label="Game stats"><h2>Game Stats · Fall to Date</h2>{games.length ? <table className={styles.table}><thead><tr><th>Stat</th><th>Value</th><th>Pctl</th></tr></thead><tbody>{games.map(game => {
          const pct = game.comparison && game.comparison.sampleSize >= 5 && game.comparison.percentile !== null ? Math.round(game.comparison.percentile) : null;
          return <tr key={`${game.source}-${game.metric}`}><td><strong>{game.label}</strong><small>{game.source === "qpa_fall_2026" ? "Hitting" : "Pitching"}{game.opportunities != null ? ` · ${countLabel(game.opportunities, "chances")}` : ""}</small></td><td className={styles.num}>{gameValue(game.value, game.unit)}</td><td>{pct === null ? <span className={styles.muted}>—</span> : <span className={styles.pctl} style={game.direction === "neutral" ? undefined : percentileColor(pct)}>{pct}</span>}</td></tr>;
        })}</tbody></table> : <p className={styles.muted}>No game stats yet.</p>}</section>
      </div>
      {profileShowsPitching(season) && <section className={styles.arsenal} aria-label="Pitch arsenal"><h2>Pitch Arsenal</h2><div className={styles.arsenalTable}><ClassifiedPitchResults readings={shared.measurements}/></div></section>}
      <footer className={styles.footer}>Percentiles compare with at least five Pacific teammates on the same test, source and unit; red is the top of the team. Gray values are body or spin positions, not grades. Small game samples can swing widely. An independent project for Pacific Baseball.</footer>
    </article>
  </div>;
}
