import { StatInfo } from "@/components/stat-info";
import { GameOpportunity } from "@/components/game-opportunity";
import { PercentileBar } from "@/components/percentile-bar";
import { gameValue } from "@/lib/game-metrics";
import { ADVANCED_HITTING_METRICS, ADVANCED_PITCHING_METRICS, ADVANCED_GAME_CUES } from "@/lib/advanced-game-presentation";
import type { GameOverviewMetric } from "@/lib/game-overview";
import styles from "./advanced-game-cards.module.css";
const updatedDate = (value: string) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" });

/** Own-profile projection: never request peer rows or reinterpret an outcome as an expected result. */
export function AdvancedGameCards({ metrics }: { metrics: readonly GameOverviewMetric[] }) {
  const groups = [
    { source: "qpa_fall_2026", title: "Hitting", order: ADVANCED_HITTING_METRICS },
    { source: "pitching_fall_2026", title: "Pitching", order: ADVANCED_PITCHING_METRICS },
  ].map(group => ({ ...group, rows: group.order.flatMap(key => metrics.filter(m => m.source === group.source && m.metric === key)) })).filter(group => group.rows.length);
  if (!groups.length) return null;
  return <section className={styles.section} aria-label="Advanced performance">
    <header className={styles.heading}><div><h2>Advanced Performance</h2><p>Power, contact, and command alongside the results.</p></div><span>In-Game · Fall to Date</span></header>
    {groups.map(group => <section className={styles.discipline} key={group.source} aria-label={`Advanced ${group.title.toLowerCase()} performance`}>
      <div className={styles.groupHeading}><h3>{group.title}</h3><span>Updated <time dateTime={group.rows.map(row => row.updatedAt).sort().at(-1)!}>{updatedDate(group.rows.map(row => row.updatedAt).sort().at(-1)!)}</time></span></div>
      <dl className={styles.cards}>{group.rows.map(item => <div className={styles.card} key={item.metric} data-advanced-metric={item.metric}>
        <dt>{item.label}<StatInfo metric={item.metric} label={item.label}/></dt>
        <dd><strong className={styles.value}>{gameValue(item.value, item.unit)}</strong>
        <p className={styles.cue}>{ADVANCED_GAME_CUES[item.metric]}</p>
        <GameOpportunity source={item.source} metric={item.metric} count={item.opportunities}/>
        {item.comparison ? <div className={styles.percentile}><PercentileBar value={item.comparison.percentile!} sampleSize={item.comparison.sampleSize} label={item.label}/><span>{item.comparison.sampleSize} teammates</span></div> : <p className={styles.missing}>Team percentile needs five comparable players.</p>}</dd>
      </div>)}</dl>
      <p className={styles.note}>{group.source === "qpa_fall_2026" ? "Estimated power stats count doubles/triples as doubles. PAC Production+ compares recorded production with the team; it is not wRC+." : "Strikeouts and walks help explain the approach. WHIP shows the hits and walks allowed."}</p>
    </section>)}
    <p className={styles.note}>These stats still reflect results and sample size; they do not remove luck.</p>
  </section>;
}
