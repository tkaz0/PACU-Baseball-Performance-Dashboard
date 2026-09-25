import { ArrowRight, CircleDot, Diamond } from "lucide-react";
import type { Measurement } from "@/lib/imports/engine";
import type { PlayerPerformance, PlayerMetricCard } from "@/lib/player-performance";
import { getSessionPerformance } from "@/lib/player-profile-layout";
import { blastFallSummary } from "@/lib/blast-fall";
import { blastPeriodLabel } from "@/lib/blast-metrics";
import { StatInfo } from "@/components/stat-info";
import styles from "./practice-game-bridge.module.css";

const labelDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function latestGameBatSpeed(performance: PlayerPerformance): PlayerMetricCard | undefined {
  return getSessionPerformance(performance, "in_game").hitting
    .filter(card => card.metric.key === "avg_bat_speed" && card.latest?.source.startsWith("Full Swing ·") && card.latest.unit === "mph")
    .sort((a, b) => b.latest!.measuredAt.localeCompare(a.latest!.measuredAt) || a.latest!.source.localeCompare(b.latest!.source))[0];
}

export function PracticeGameBridge({ performance, blastReadings = [] }: { performance: PlayerPerformance; blastReadings?: readonly Measurement[] }) {
  const fall = blastFallSummary(blastReadings);
  const blastBatSpeed = fall?.metrics.find(metric => metric.key === "avg_bat_speed");
  const practice = fall?.issues.length === 0 && fall.totalSwings && blastBatSpeed?.average !== null && blastBatSpeed?.average !== undefined
    ? blastBatSpeed.average : null;
  const game = latestGameBatSpeed(performance)?.latest;
  if (practice === null && !game) return null;
  return <section className={styles.bridge} aria-label="Practice and in-game bat speed">
    <div className={styles.heading}><div><p className={styles.eyebrow}>Hitting · Two Settings</p><h2>Bat Speed: Practice &amp; In-Game <StatInfo metric="avg_bat_speed" label="Average Bat Speed" /></h2></div><span className={styles.unit}>mph</span></div>
    <div className={styles.lanes}>
      <div className={`${styles.lane} ${styles.practice}`}><span className={styles.icon}><CircleDot size={18} aria-hidden="true" /></span><div className={styles.laneCopy}><h3>Practice <span>Blast</span></h3><p>Fall swing-weighted average</p>{fall?.firstDate && fall.lastDate && <small>{blastPeriodLabel(fall.firstDate, fall.lastDate)}{fall.totalSwings ? ` · ${fall.totalSwings} swings` : ""}</small>}</div><strong className={styles.value}>{practice === null ? "—" : practice.toFixed(1)}</strong></div>
      <ArrowRight className={styles.arrow} size={18} aria-hidden="true" />
      <div className={`${styles.lane} ${styles.game}`}><span className={styles.icon}><Diamond size={18} aria-hidden="true" /></span><div className={styles.laneCopy}><h3>In-Game <span>Full Swing</span></h3><p>Latest game or intrasquad session</p>{game && <small>{labelDate(game.measuredAt)}</small>}</div><strong className={styles.value}>{game ? game.value.toFixed(1) : "—"}</strong></div>
    </div>
    <p className={styles.note}>Separate devices and samples; these numbers are shown side by side, without a calculated gap. A missing or overlapping Blast report is withheld until reviewed.</p>
  </section>;
}
