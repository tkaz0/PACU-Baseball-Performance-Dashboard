import styles from "./skeleton.module.css";

/** Gray shapes in place of streamed content, so the page doesn't jump when it fills in. Screen readers hear one status line. */
export function SkeletonCards({ count = 2, label = "Loading", tall = false }: { count?: number; label?: string; tall?: boolean }) {
  return <div className={styles.cards} role="status" aria-label={label}>{Array.from({ length: count }, (_, i) => <div key={i} className={styles.card} data-tall={tall}>
    <span className={styles.line} style={{ width: "40%" }}/><span className={styles.circle}/><span className={styles.line} style={{ width: "70%" }}/><span className={styles.block}/><span className={styles.line} style={{ width: "55%" }}/>
  </div>)}<span className="sr-only">{label}…</span></div>;
}
export function SkeletonPanel({ rows = 4, label = "Loading" }: { rows?: number; label?: string }) {
  return <div className={styles.panel} role="status" aria-label={label}><span className={styles.line} style={{ width: "30%", height: 16 }}/>{Array.from({ length: rows }, (_, i) => <span key={i} className={styles.row}><span className={styles.dot}/><span className={styles.line} style={{ width: `${70 - i * 8}%` }}/></span>)}<span className="sr-only">{label}…</span></div>;
}
