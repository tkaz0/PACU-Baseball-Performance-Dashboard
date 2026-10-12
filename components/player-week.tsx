import { formatTeamGameMetric, type TeamGameSummary } from "@/lib/team-game-stats";
import type { TeamGameTrends } from "@/lib/game-trends";
import type { VisitBest } from "@/lib/dashboard-visit-digest";
import { biggestWeekJump } from "@/lib/player-week";
import { classifiedPitchSource } from "@/lib/imports/classified-pitch-results";
import { pitchTypeLabel } from "@/lib/imports/pitch-assignments";
import { pitchSourceLabel } from "@/lib/pitch-display";
import { formatMetricNumber } from "@/lib/measurement-display";
import styles from "./player-week.module.css";

const day = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** A linked player's own week: most-improved game rate since the previous game week plus Fall bests added in seven days. */
export function PlayerWeekDisplay({ trends, batting, pitching, bests }: { trends: TeamGameTrends; batting: TeamGameSummary; pitching: TeamGameSummary; bests: readonly VisitBest[] | null }) {
  const jump = biggestWeekJump(trends, batting, pitching);
  if (!jump && !bests?.length) return null;
  return <section className={styles.card} aria-label="Your week" data-testid="player-week">
    <div><p className={styles.kicker}>This Week</p><h2>Your Week</h2></div>
    <div className={styles.grid}>
      {jump && <div className={styles.jump} data-testid="player-week-jump"><span>Biggest jump · {jump.metric.label}</span><strong>↑ {Math.abs(jump.change.percent) < .05 ? "<0.1" : Math.abs(jump.change.percent).toFixed(1)}%</strong>
        <small>{formatTeamGameMetric({ ...jump.metric, value: jump.change.previousValue })} → {formatTeamGameMetric(jump.metric)} vs {jump.since}</small></div>}
      {bests && bests.length > 0 && <div><p className={styles.kicker}>New Fall Bests · last 7 days</p><ul className={styles.bests}>{bests.map(b => { const pitch = classifiedPitchSource(b.source); return <li key={JSON.stringify([b.metric, b.source, b.unit])}>
        <div>{pitch ? `${pitchTypeLabel(pitch.pitchType)} ${b.label.replace(/^Pitch Type /, "")}` : b.label}<small>{pitchSourceLabel(b.source)} · Tested {day(b.measuredAt)}</small></div>
        <div><strong>{formatMetricNumber(b.value, b.metric, b.source)} {b.unit}</strong><small>Previous {formatMetricNumber(b.previous, b.metric, b.source)}</small></div></li>; })}</ul></div>}
    </div>
    <p className={styles.note}>Your own Fall-to-date rates compared with the previous game week, and your newly added results that beat your earlier saved results from the same test, source and units.</p>
  </section>;
}

export async function PlayerWeek({ trends, activity, batting, pitching }: { trends: Promise<TeamGameTrends>; activity: Promise<{ ok: boolean; weekBests?: VisitBest[] }>; batting: TeamGameSummary; pitching: TeamGameSummary }) {
  const [history, result] = await Promise.all([trends, activity]);
  return <PlayerWeekDisplay trends={history} batting={batting} pitching={pitching} bests={result.ok ? result.weekBests ?? null : null}/>;
}
