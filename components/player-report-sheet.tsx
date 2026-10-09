import type { requireRenderAccess as requireAccess } from "@/lib/render-access";
import { athleteName, display, formatClassYear, type RosterAthlete } from "@/lib/types";
import { loadAthletePerformance } from "@/lib/performance-server";
import { loadPlayerFallSummaries } from "@/lib/player-fall-summaries-server";
import { getPlayerPerformance, type PlayerMetricCard } from "@/lib/player-performance";
import { profileSessionContext, profileShowsHitting, profileShowsPitching, withoutUnclassifiedPitchVelocity, withoutWeeklyBlastCards } from "@/lib/player-profile-layout";
import { reportTestingSelection, reportHasPercentile } from "@/lib/player-report";
import { blastFallSummary } from "@/lib/blast-fall";
import { loadBlastBatSpeedPercentile } from "@/lib/blast-speed-percentile-server";
import { profileMetricLabel } from "@/lib/profile-metric-label";
import { leaderboardMetricLabel, leaderboardTestDate } from "@/lib/leaderboards";
import { formatHeight, formatMetricNumber, formatSpin } from "@/lib/measurement-display";
import { profileTrends } from "@/lib/profile-trends";
import { recentPersonalBest } from "@/lib/personal-bests";
import { pacificTestingDate } from "@/lib/testing-checklist";
import { parseBlastSource, formatBlastValue, blastUnit } from "@/lib/blast-metrics";
import { loadGameStats } from "@/lib/game-server";
import { loadGameComparisons } from "@/lib/game-comparison-server";
import { gameOverviewMetrics } from "@/lib/game-overview";
import { gameValue } from "@/lib/game-metrics";
import { gameSampleText, isEarlyGameSample } from "@/lib/game-opportunities";
import { loadAthleteHeadshot } from "@/lib/headshots-server";
import { percentileColor } from "@/lib/percentile-color";
import { PlayerAvatar } from "@/components/player-avatar";
import { PacificLogo } from "@/components/pacific-brand";
import { PercentileRing } from "@/components/charts/percentile-ring";
import { Sparkline } from "@/components/charts/sparkline";
import { fallArsenalPitches } from "@/lib/pitch-arsenal";
import { pitchTypeLabel } from "@/lib/imports/pitch-assignments";
import styles from "./player-report.module.css";
import { ScoutsTake } from "@/components/report-customizer";

const REPORT_TESTS = 10;
const REPORT_PITCHES = 8;
const REPORT_GAME_KEYS = ["batting_production_plus", "batting_avg", "batting_obp", "batting_est_iso", "qpa_pct", "batting_bb_pct", "batting_k_pct", "pitching_whip", "pitching_k_bb", "pitching_r9", "pitching_k9", "pitching_bb9", "strike_pct"];

const Pctl = ({ value, neutral }: { value: number | null; neutral: boolean }) => value === null ? <span className={styles.muted}>—</span>
  : <span className={`${styles.pctl} ${neutral ? styles.pctlNeutral : ""}`} style={neutral ? undefined : percentileColor(value)}>{value}</span>;

/** One-page printable summary of the same results the profile already shows to this viewer. */
export async function buildPlayerReportSheet(access: Awaited<ReturnType<typeof requireAccess>>, athlete: RosterAthlete) {
  const season = athlete.athlete_seasons.find(item => item.season === "2026-27") ?? [...athlete.athlete_seasons].sort((a, b) => b.season.localeCompare(a.season))[0];
  const [shared, gameStats, gameComparisons, headshot] = await Promise.all([
    loadAthletePerformance(access, athlete, { includePercentiles: true }), loadGameStats(access, athlete.id), loadGameComparisons(access, athlete.id), loadAthleteHeadshot(access, athlete.id),
  ]);
  const fallSummaries = await loadPlayerFallSummaries(access, athlete.athlete_code, shared.measurements).catch(() => []);
  const today = pacificTestingDate();
  const performance = getPlayerPerformance({ readings: shared.measurements, batches: shared.batches, athleteCode: athlete.athlete_code, cohortAthleteCodes: [], percentileOverrides: shared.percentileOverrides, fallSummaries });
  // Same filters as the profile so printed numbers match what the player sees there.
  const fullArsenal = profileShowsPitching(season) ? fallArsenalPitches(shared.measurements, today) : [];
  const coverage = (["Game", "Intrasquad", "Practice"] as const).map(category => ({ category, average: fullArsenal.some(p => p.category === category && p.averageVelocity !== null), maximum: fullArsenal.some(p => p.category === category && p.maxVelocity !== null) }));
  const classified = withoutUnclassifiedPitchVelocity(performance, coverage);
  const display_ = shared.measurements.some(r => parseBlastSource(r.source)) ? withoutWeeklyBlastCards(classified) : classified;
  const blast = profileShowsHitting(season) ? blastFallSummary(shared.measurements) : null;
  const blastPercentile = blast ? await loadBlastBatSpeedPercentile(access, athlete.id) : null;
  const batAverage = blast?.metrics.find(metric => metric.key === "avg_bat_speed")?.average;
  const blastPct = blastPercentile && batAverage != null && Math.abs(blastPercentile.observedValue - batAverage) < 1e-8 && blastPercentile.swingCount === blast?.totalSwings && blastPercentile.reportCount === blast?.reportCount && blastPercentile.firstDate === blast?.firstDate && blastPercentile.lastDate === blast?.lastDate ? blastPercentile.percentile : null;
  const { chosen, shownGroups, hiddenTests } = reportTestingSelection(display_, season, blast ? 8 : REPORT_TESTS);
  const hasPct = reportHasPercentile;
  const trends = new Map(profileTrends([...chosen]).map(trend => [trend.key, trend]));
  const showTrend = [...chosen].some(card => trends.has(card.metric.key));
  const label = (card: PlayerMetricCard) => {
    const base = profileMetricLabel(card.metric.key, leaderboardMetricLabel(card.metric), card.latest!.source);
    return card.metric.group === "body" ? base : `${base} (${profileSessionContext(card.latest!.source) === "in_game" ? "In-Game" : "Practice"})`;
  };
  const unit = (u: string) => u === "ratio" ? "" : u === "%" ? "%" : ` ${u}`;
  const value = (card: PlayerMetricCard) => card.metric.key === "height" ? formatHeight(card.latest!.value, card.latest!.unit) ?? "" : `${formatMetricNumber(card.latest!.value, card.metric.key, card.latest!.source)}${unit(card.latest!.unit)}`;
  const games = REPORT_GAME_KEYS.flatMap(key => gameOverviewMetrics(gameStats, gameComparisons).filter(game => game.metric === key));
  const gameGroups = [{ label: "Hitting", rows: games.filter(g => g.source === "qpa_fall_2026") }, { label: "Pitching", rows: games.filter(g => g.source !== "qpa_fall_2026") }].filter(g => g.rows.length);
  const arsenal = fullArsenal.slice(0, REPORT_PITCHES), hiddenPitches = fullArsenal.length - arsenal.length;
  const latestFallback = arsenal.some(p => p.velocityBasis === "latest" || p.spinBasis === "latest");
  const heroes = [
    ...[...chosen].filter(card => hasPct(card) && card.metric.direction !== "neutral").map(card => ({ key: `t-${card.metric.key}-${card.latest!.source}`, label: label(card), value: card.percentile!.value, early: false })),
    ...games.filter(game => game.direction !== "neutral" && game.comparison && game.comparison.sampleSize >= 5 && game.comparison.percentile !== null).map(game => ({ key: `g-${game.metric}`, label: `${game.label} (In-Game)`, value: game.comparison!.percentile!, early: isEarlyGameSample(game.source, game.metric, game.opportunities) })),
  ].sort((a, b) => b.value - a.value).slice(0, 4);
  const identity = [[season?.primary_position, season?.secondary_position].filter((p, i, list) => p && list.indexOf(p) === i).join(" / ") || "Position to be added",
    season?.jersey_number != null ? `#${season.jersey_number}` : null, season?.bats || season?.throws ? `B/T ${display(season?.bats)}/${display(season?.throws)}` : null, formatClassYear(season?.academic_class) || null].filter(Boolean).join(" · ");
  return <article className={styles.report} data-report-sheet aria-label={`${athleteName(athlete)} Fall 2026 player report`}>
      <header className={styles.header}>
        <PlayerAvatar name={athleteName(athlete)} path={headshot} size={72} eager className={styles.photo}/>
        <div className={styles.identity}><p className={styles.kicker}>PACU Baseball Performance · Fall 2026 Player Report</p><h1>{athleteName(athlete)}</h1><p>{identity}</p></div>
        <div className={styles.brand}><PacificLogo className="w-12" decorative/><small>Generated {leaderboardTestDate(today)}</small></div>
      </header>
      {heroes.length > 0 && <section data-block="percentiles" className={styles.heroes} aria-label="Top team percentiles">{heroes.map(item => <div key={item.key}><PercentileRing value={item.value} label={item.label} size={44}/><span>{item.label}{item.early && <em className={styles.early}>Early sample</em>}</span></div>)}</section>}
      <div className={styles.columns}>
        <section data-block="testing" aria-label="Testing results"><h2>Testing Results</h2>{shownGroups.length ? <table className={styles.table}><thead><tr><th>Measurement</th><th className={styles.right}>Result</th>{showTrend && <th>Trend</th>}<th className={styles.center}>Pctl</th></tr></thead>
          {shownGroups.map(group => <tbody key={group.label}><tr className={styles.groupRow}><th colSpan={showTrend ? 4 : 3} scope="colgroup">{group.label}</th></tr>{group.cards.map(card => {
            const trend = trends.get(card.metric.key), best = recentPersonalBest(card, today), pct = hasPct(card) ? Math.round(card.percentile!.value) : null;
            const change = trend ? trend.points.at(-1)!.value - trend.points[0].value : null;
            return <tr key={`${card.metric.key}-${card.latest!.source}`}><td><strong>{label(card)}</strong>{best && <span className={styles.best}>Fall Best</span>}<small>{leaderboardTestDate(card.latest!.measuredAt)}</small></td><td className={styles.num}>{value(card)}</td>
              {showTrend && <td>{trend ? <span className={styles.trend}><Sparkline points={trend.points} width={56} height={16} label={`${card.metric.label} trend`} direction={card.metric.direction}/><small>{change! > 0 ? "+" : change! < 0 ? "−" : ""}{formatMetricNumber(Math.abs(change!), card.metric.key, card.latest!.source, Math.abs(change!).toFixed(1))}</small></span> : null}</td>}
              <td className={styles.center}><Pctl value={pct} neutral={card.metric.direction === "neutral"}/></td></tr>;
          })}</tbody>)}</table> : <p className={styles.muted}>No Fall testing results yet.</p>}{hiddenTests > 0 && <p className={styles.more}>+{hiddenTests} more testing measurements on the full profile</p>}
          {blast && <section data-block="blast" className={styles.blast} aria-label="Blast practice averages"><h2>Blast Practice · Fall Averages</h2><p className={styles.more}>{blast.totalSwings !== null ? `${blast.totalSwings} swings · ${blast.reportCount} reports` : "Fall averages pending report review"}{blast.lastDate ? ` · Through ${leaderboardTestDate(blast.lastDate)}` : ""}</p><table className={styles.table}><thead><tr><th>Measurement</th><th className={styles.right}>Average</th><th className={styles.center}>Pctl</th></tr></thead><tbody>{blast.metrics.map(metric => <tr key={metric.key}><td><strong>{metric.label.replace(" (Practice)", "")}</strong></td><td className={styles.num}>{metric.average === null ? "—" : `${formatBlastValue(metric.average, metric.unit)} ${blastUnit(metric.unit)}`}</td><td className={styles.center}><Pctl value={metric.key === "avg_bat_speed" && blastPct !== null ? Math.round(blastPct) : null} neutral={metric.key !== "avg_bat_speed"}/></td></tr>)}</tbody></table><p className={styles.more}>Swing-weighted averages; weekly peaks remain on the profile.</p></section>}
        </section>
        <section data-block="games" aria-label="Game stats"><h2>Game Stats · Fall 2026</h2>{gameGroups.length ? <table className={styles.table}><thead><tr><th>Stat</th><th className={styles.right}>Value</th><th className={styles.center}>Pctl</th></tr></thead>{gameGroups.map(group => <tbody key={group.label}><tr className={styles.groupRow}><th colSpan={3} scope="colgroup">{group.label}</th></tr>{group.rows.map(game => {
          const pct = game.comparison && game.comparison.sampleSize >= 5 && game.comparison.percentile !== null ? Math.round(game.comparison.percentile) : null, sample = gameSampleText(game.source, game.metric, game.opportunities);
          return <tr key={`${game.source}-${game.metric}`}><td><strong>{game.label}</strong><small>{sample}{isEarlyGameSample(game.source, game.metric, game.opportunities) ? " · Early sample" : ""}</small></td><td className={styles.num}>{gameValue(game.value, game.unit)}</td><td className={styles.center}><Pctl value={pct} neutral={game.direction === "neutral"}/></td></tr>;
        })}</tbody>)}</table> : <p className={styles.muted}>No game stats yet.</p>}</section>
      </div>
      {arsenal.length > 0 && <section data-block="arsenal" className={styles.arsenal} aria-label="Pitch arsenal"><h2>Pitch Arsenal · Fall 2026</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Pitch</th><th>Setting</th><th className={styles.right}>Avg Velo</th><th className={styles.right}>Max Velo</th><th className={styles.right}>Avg Spin</th><th className={styles.right}>Max Spin</th><th className={styles.right}>Pitches</th></tr></thead><tbody>{arsenal.map(pitch => <tr key={pitch.source}><td><strong>{pitchTypeLabel(pitch.pitchType)}</strong></td><td>{pitch.category}</td><td className={styles.num}>{pitch.averageVelocity === null ? "—" : `${pitch.averageVelocity.toFixed(1)} mph${pitch.velocityBasis === "latest" ? "†" : ""}`}</td><td className={styles.num}>{pitch.maxVelocity === null ? "—" : `${pitch.maxVelocity.toFixed(1)} mph`}</td><td className={styles.num}>{pitch.averageSpin === null ? "—" : `${formatSpin(pitch.averageSpin)} rpm${pitch.spinBasis === "latest" ? "†" : ""}`}</td><td className={styles.num}>{pitch.maxSpin === null ? "—" : `${formatSpin(pitch.maxSpin)} rpm`}</td><td className={styles.num}>{pitch.count ?? "—"}</td></tr>)}</tbody></table></div>
        {(hiddenPitches > 0 || latestFallback) && <p className={styles.more}>{latestFallback ? "† Latest-session average (a session count could not be verified). " : ""}{hiddenPitches > 0 ? `+${hiddenPitches} more on the full profile.` : ""}</p>}</section>}
      <ScoutsTake/>
      <footer className={styles.footer}>Percentiles compare with at least five Pacific teammates on the same test, source and unit; red is the top of the team. Outlined values are body or spin positions, not grades. Small game samples can swing widely. PACU Baseball Performance is an independent project for Pacific Baseball; it is not an official university application.</footer>
    </article>;
}
