import { Sparkline } from "@/components/charts/sparkline";
import { gameDirection } from "@/lib/game-metrics";
import type { SharedGameStat } from "@/lib/game-server";
import type { TeamGameTrends } from "@/lib/game-trends";
import { formatTeamGameMetric, type TeamGameMetric } from "@/lib/team-game-stats";
import { teamWeekChange, weekChangeSince } from "@/lib/team-week-change";
import styles from "./team-game-trend.module.css";

type Props = { trends: TeamGameTrends; source: SharedGameStat["source"]; metric: TeamGameMetric; updatedAt: string | null; compact?: boolean };
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function TeamGameTrendDisplay({ trends, source, metric, updatedAt, compact = false }: Props) {
  const change = teamWeekChange(trends, source, metric, updatedAt);
  const points = trends[source]?.[metric.metric];
  if (!change && (compact || !points || points.length < 2)) return null;
  const amount = change?.percent === null ? "New" : change ? Math.abs(change.percent!) > 0 && Math.abs(change.percent!) < .05 ? "<0.1%" : `${Math.abs(change.percent!).toFixed(1)}%` : "";
  const short = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const { since, byWeek, before, now } = change ? weekChangeSince(change) : { since: "", byWeek: false, before: null, now: null };
  const arrow = change?.direction === "up" ? "↑" : change?.direction === "down" ? "↓" : "→";
  const description = change ? `${metric.label}: ${formatTeamGameMetric({ ...metric, value: change.previousValue })} ${byWeek ? `through Week ${before!.week} (${short(before!.date)} games; sheet saved ${dateLabel(change.previousDate)})` : `on ${dateLabel(change.previousDate)}`} → ${formatTeamGameMetric(metric)} ${byWeek ? `through Week ${now!.week} (${short(now!.date)} games; sheet saved ${dateLabel(change.currentDate)})` : `on ${dateLabel(change.currentDate)}`}. ${change.percent === null ? "New result from a zero baseline; percentage change is undefined." : `${change.direction === "same" ? "Unchanged" : `${amount} ${change.direction}`}. Relative change = (current − previous) ÷ previous × 100; not percentage points.`} ${change.currentWeek !== undefined ? change.fallback ? "The previous Fall Ball week has no comparable saved update; this uses the latest earlier recorded week." : "Fall-to-date totals compared through consecutive recorded Fall Ball weeks, regardless of when the sheets were saved." : change.fallback ? "No update was saved last week, so this compares with the latest earlier saved update." : "Fall-to-date totals compared with the last saved update in the previous Monday–Sunday week."} Green means improvement; red means decline.` : "";
  return <div className={styles.wrap} data-compact={compact}>
    {change && <details className={styles.details}><summary className={styles.badge} data-tone={change.tone} aria-label={`${metric.label}: ${amount} ${change.direction}, versus ${since}. Show comparison details.`}><span aria-hidden="true">{arrow}</span><strong>{amount}</strong><span>vs {since}</span></summary><p className={styles.explanation}>{description}</p></details>}
    {!compact && points && points.length > 1 && <div className={styles.spark}><Sparkline points={points} width={150} height={24} label={`${metric.label} by sheet update`} noun="sheet updates" lowerIsBetter={gameDirection(source, metric.metric) === "lower"}/></div>}
  </div>;
}

/** Reuse the staff history promise without delaying current team numbers. */
export async function TeamGameTrend({ trends, ...props }: Omit<Props, "trends"> & { trends: Promise<TeamGameTrends> }) {
  return <TeamGameTrendDisplay {...props} trends={await trends}/>;
}
