import { percentileColor } from "@/lib/percentile-color";
import styles from "./percentile-bar.module.css";

export function PercentileBar({ value, sampleSize, label, descriptive = false, testId }: { value: number; sampleSize: number; label: string; descriptive?: boolean; testId?: string }) {
  if (!Number.isFinite(value) || value < 0 || value > 100 || !Number.isSafeInteger(sampleSize) || sampleSize < 5) return null;
  const color = percentileColor(value);
  return <div className={styles.meter} role="meter" aria-label={`${label} Pacific percentile`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-valuetext={`${Math.round(value)} percentile among ${sampleSize} comparable Pacific players${descriptive ? "; measured value, not a rating" : ""}`} data-testid={testId}>
    <div className={styles.track} aria-hidden="true"><span className={styles.fill} style={{ width: `${value}%`, backgroundColor: color.backgroundColor }} /><span className={styles.midpoint} /><span className={styles.marker} style={{ left: `${value}%`, ...color }}>{Math.round(value)}</span></div>
  </div>;
}
export function PercentileLegend() {
  return <div className={styles.legend}><span>0 · Lower percentile</span><span className={styles.key} aria-hidden="true" /><span>Higher percentile · 100</span><span>Midpoint: 50</span></div>;
}
