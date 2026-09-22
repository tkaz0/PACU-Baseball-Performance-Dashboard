import type { PlayerMetricCard } from "@/lib/player-performance";
import styles from "./physicality-radar.module.css";

const metrics = [
  { key: "muscle_mass", label: "Muscle mass" },
  { key: "body_score", label: "Body score" },
  { key: "body_fat_pct", label: "Body fat %" },
] as const;

export function physicalityRadarPoints(cards: readonly PlayerMetricCard[]) {
  return metrics.flatMap(metric => {
    const card = cards.find(item => item.metric.key === metric.key && item.latest && item.percentileStatus === "available" && item.percentile && item.percentile.sampleSize >= 5 && item.percentile.unit === item.latest.unit && item.percentile.period === item.latest.period && Number.isFinite(item.percentile.value) && item.percentile.value >= 0 && item.percentile.value <= 100);
    return card?.percentile ? [{ ...metric, percentile: card.percentile.value, sampleSize: card.percentile.sampleSize }] : [];
  });
}

export function PhysicalityRadar({ cards }: { cards: readonly PlayerMetricCard[] }) {
  const points = physicalityRadarPoints(cards);
  if (points.length !== 3) return null;
  const cx=150, cy=145, radius=103;
  const polar=(index:number,value:number)=>{
    const angle=-Math.PI/2 + index*2*Math.PI/points.length;
    return [cx+Math.cos(angle)*radius*value/100,cy+Math.sin(angle)*radius*value/100] as const;
  };
  const vertices=(value:number)=>points.map((_,index)=>polar(index,value).join(",")).join(" ");
  return <figure className={styles.panel} aria-label="Physicality percentile radar">
    <figcaption><h3>Physicality at a Glance</h3><p>Three separate Pacific team percentiles · Fall 2026</p></figcaption>
    <div className={styles.layout}><svg viewBox="0 0 300 290" role="img" aria-label={`Muscle mass ${Math.round(points[0].percentile)}th percentile, body score ${Math.round(points[1].percentile)}th percentile, body fat ${Math.round(points[2].percentile)}th percentile. Lower body fat ranks higher.`}>
      {[25,50,75,100].map(level=><polygon key={level} points={vertices(level)} fill="none" stroke="var(--line-subtle)" strokeWidth="1"/>)}
      {points.map((_,index)=>{const [x,y]=polar(index,100);return <line key={index} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line-subtle)"/>;})}
      <polygon points={points.map((point,index)=>polar(index,point.percentile).join(",")).join(" ")} fill="color-mix(in srgb, var(--accent-readable) 20%, transparent)" stroke="var(--accent-readable)" strokeWidth="2.5"/>
      {points.map((point,index)=>{const [x,y]=polar(index,point.percentile);return <circle key={point.key} cx={x} cy={y} r="5" fill="var(--accent-readable)" stroke="var(--surface-panel)" strokeWidth="2"><title>{`${point.label}: ${Math.round(point.percentile)}th percentile among ${point.sampleSize} comparable players`}</title></circle>;})}
      <text x="150" y="17" textAnchor="middle" fill="var(--text-secondary)" fontSize="11">100 = higher rank</text>
      <text x="150" y="280" textAnchor="middle" fill="var(--text-secondary)" fontSize="11">Team percentiles</text>
    </svg><ol>{points.map(point=><li key={point.key}><span>{point.label}</span><strong>{Math.round(point.percentile)}<small> PCTL</small></strong><small>n={point.sampleSize} comparable players</small></li>)}</ol></div>
    <p className={styles.note}>Each axis uses its own comparable team cohort. Lower body fat ranks higher. Muscle mass and body score ranks are descriptive, not health or performance ratings.</p>
  </figure>;
}
