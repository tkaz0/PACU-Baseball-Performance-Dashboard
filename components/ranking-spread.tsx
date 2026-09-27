import { rankingSpread } from "@/lib/ranking-spread";
import styles from "./ranking-spread.module.css";
export function RankingSpread({ values, format, label }: { values: number[]; format: (value: number) => string; label: string }) {
  const spread = rankingSpread(values);
  if (!spread) return null;
  return <div className={styles.spread}>
    <div className={styles.caption}><span>Team Spread</span><span>Median <b>{format(spread.median)}</b></span></div>
    <svg viewBox="0 0 320 42" role="img" aria-label={`${label}: ${spread.count} displayed results, from ${format(spread.min)} to ${format(spread.max)}; median ${format(spread.median)}`}>
      <title>Nearby results share a dot; its area shows the number of players, printed above when more than one. The dashed line marks the median, not a target.</title>
      <line x1="8" y1="33" x2="312" y2="33" className={styles.track}/>
      <line x1={8 + spread.medianFraction * 304} x2={8 + spread.medianFraction * 304} y1="2" y2="39" className={styles.median}/>
      {spread.dots.map((dot, index) => <g key={index}><circle cx={8 + dot.fraction * 304} cy="26" r={dot.radius} className={styles.dot}><title>{dot.count} {dot.count === 1 ? "player" : "players"}: {format(dot.min)}{dot.min !== dot.max ? ` to ${format(dot.max)}` : ""}</title></circle>{dot.count > 1 && <text x={8 + dot.fraction * 304} y={23 - dot.radius} textAnchor="middle" className={styles.clusterCount}>{dot.count}</text>}</g>)}
    </svg><div className={styles.range}><span>{format(spread.min)}</span><span>{format(spread.max)}</span></div>
  </div>;
}
