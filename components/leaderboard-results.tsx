import { StatInfo } from "@/components/stat-info";
import Link from "next/link";
import { leaderboardMetricLabel, pitchLeaderboardLabel, isPitchLeaderboardMetric, leaderboardOrderLabel, leaderboardSourceLabel, leaderboardTestDate, type LeaderboardMetricDefinition, type LeaderboardRow } from "@/lib/leaderboards";
import { isFallBestMetric, isTimedMetric, type PlayerPerformancePeriod } from "@/lib/player-performance";
import { formatHeight, formatMetricNumber } from "@/lib/measurement-display";
import styles from "./leaderboard.module.css";

function ResultValue({ row, metric, unit }: { row: LeaderboardRow; metric: LeaderboardMetricDefinition; unit: string }) {
  if (metric.key === "body_score") return <><span>{row.value}</span><span className={styles.unit}>/100</span></>;
  const height = metric.key === "height" ? formatHeight(row.value, unit) : null;
  if (height) return <span className="whitespace-nowrap" title={`Recorded: ${String(row.value)} ${unit}`}>{height}</span>;
  return <>{row.derived
    ? <span title={`Exact calculated value: ${String(row.value)} ${unit}; calculated from same-report muscle and weight`}>≈{row.value.toLocaleString("en-US", { maximumFractionDigits: 1 })}</span>
    : <span className="break-all">{formatMetricNumber(row.value,metric.key,row.source,unit === "s" ? row.value.toFixed(2) : String(row.value))}</span>}{unit !== "ratio" && <span className={styles.unit}>{unit}</span>}</>;
}

function RankingTable({ rows, metric, unit, continued = false, tiedRanks, barMax }: { rows: LeaderboardRow[]; metric: LeaderboardMetricDefinition; unit: string; continued?: boolean; tiedRanks: ReadonlySet<number>; barMax?: number }) {
  return <div className={styles.tableWrap}><table>
    <caption className="sr-only">{leaderboardMetricLabel(metric)} team results{continued ? ", continued" : ""}; recorded in {unit}</caption>
    <thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Result</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.athleteCode} className={row.rank === 1 ? styles.leading : undefined}>
      <td><span aria-label={`${tiedRanks.has(row.rank) ? "Tied for rank" : "Rank"} ${row.rank}`} title={tiedRanks.has(row.rank) ? `Tied for rank ${row.rank}` : undefined} className={`${styles.rank} ${row.rank === 1 ? styles.first : ""}`}>{row.rank}</span></td>
      <th scope="row"><span className={styles.player}>{row.profileId ? <Link href={`/athletes/${row.profileId}`} prefetch={false}>{row.name}</Link> : row.name}</span>
        <span className={styles.playerMeta}>{row.jerseyNumber !== null ? `#${row.jerseyNumber}` : row.athleteCode}{row.position ? ` · ${row.position}` : ""}<span className={styles.date}><time dateTime={row.measuredAt}>{leaderboardTestDate(row.measuredAt)}</time></span></span>
        {barMax !== undefined && <span aria-hidden="true" className={styles.barTrack}><span className={unit === "rpm" ? styles.spinBar : styles.valueBar} style={{ width: `${barMax > 0 ? Math.max(0, Math.min(100, row.value / barMax * 100)) : 0}%` }} /></span>}
      </th>
      <td className={styles.result}><ResultValue row={row} metric={metric} unit={unit} />{row.sampleCount && row.sampleUnit ? <span className="muted mt-1 block whitespace-nowrap text-[11px] font-medium">{row.sampleCount} {row.sampleUnit}</span> : row.source.startsWith("full swing") && metric.group === "hitting" ? <span className="muted mt-1 block text-[11px] font-medium">Swing count not saved</span> : null}</td>
    </tr>)}</tbody>
  </table></div>;
}

export function LeaderboardResults({ rows, metric, unit, source, period }: { rows: LeaderboardRow[]; metric: LeaderboardMetricDefinition; unit: string; source?: string; period?: PlayerPerformancePeriod }) {
  const showBars = isPitchLeaderboardMetric(metric.key) || (metric.group === "hitting" && !isTimedMetric(metric.key)) || metric.key === "infield_velocity" || metric.key === "outfield_velocity";
  const barMax = showBars ? Math.max(0, ...rows.map(row => row.value)) : undefined;
  const rankCounts = new Map<number, number>();
  for (const row of rows) rankCounts.set(row.rank, (rankCounts.get(row.rank) ?? 0) + 1);
  const tiedRanks = new Set([...rankCounts].filter(([, count]) => count > 1).map(([rank]) => rank));
  return <section className={`panel leaderboard-card ${styles.card}`}>
    <header className={styles.heading}>
      <div className={styles.eyebrow}><span>{source ? leaderboardSourceLabel(isPitchLeaderboardMetric(metric.key) ? source.split(" · ").slice(0, -1).join(" · ") : source) : "Team Testing"}{period ? ` · ${period === "fall_2026" ? "Fall 2026" : "Jun–Aug 2026"}` : ""}</span><span>{rows.length} {rows.length === 1 ? "Player" : "Players"}</span></div>
      <h2>{isPitchLeaderboardMetric(metric.key) && source ? pitchLeaderboardLabel(metric, source) : leaderboardMetricLabel(metric)}<StatInfo metric={metric.key} label={isPitchLeaderboardMetric(metric.key) && source ? pitchLeaderboardLabel(metric, source) : leaderboardMetricLabel(metric)} /></h2>
      <p title={isTimedMetric(metric.key) ? "Fastest comparable Fall trial per athlete; equal values share a rank." : isFallBestMetric(metric.key) ? "Best recorded Fall result within this source and session type; equal values share a rank." : metric.direction === "neutral" ? "Numerical comparisons, not a health or performance rating." : "Latest comparable result per athlete; equal values share a rank."}>{isFallBestMetric(metric.key) ? `Fall Best · ${leaderboardOrderLabel(metric)}` : leaderboardOrderLabel(metric)}</p>
    </header>
    {rows.length ? <><RankingTable rows={rows.slice(0, 5)} metric={metric} unit={unit} tiedRanks={tiedRanks} barMax={barMax} />{rows.length > 5 && <details className={styles.more}><summary>Show {rows.length - 5} More</summary><RankingTable rows={rows.slice(5)} metric={metric} unit={unit} tiedRanks={tiedRanks} barMax={barMax} continued /></details>}</>
      : <p className="muted m-0 p-6 text-sm">Results will appear after testing data is added.</p>}
  </section>;
}
