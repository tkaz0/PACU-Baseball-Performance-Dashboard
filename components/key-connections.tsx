import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { chanceCutoff, connectionStrength, GAME_MINIMUMS, type ConnectionResult, type ConnectionSnapshot } from "@/lib/key-connections";
import styles from "./key-connections.module.css";

const signed = (r: number) => `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(2)}`;
const weekLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Weekly r on a fixed −1…+1 scale with a zero line, so trends compare across pairs. */
function RTrend({ points }: { points: readonly ConnectionSnapshot[] }) {
  const values = points.filter(p => p.r !== null) as (ConnectionSnapshot & { r: number })[];
  if (values.length < 2) return <span className={styles.trendEmpty}>Trend starts after next week</span>;
  const w = 120, h = 36, x = (i: number) => 4 + i * (w - 8) / (values.length - 1), y = (r: number) => h / 2 - r * (h / 2 - 4);
  return <svg className={styles.trend} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Weekly r: ${values.map(v => `${weekLabel(v.weekStart)} ${signed(v.r)}`).join(", ")}`}>
    <line x1="0" x2={w} y1={h / 2} y2={h / 2} className={styles.zero} />
    <polyline points={values.map((v, i) => `${x(i)},${y(v.r)}`).join(" ")} fill="none" className={styles.line} />
    {values.map((v, i) => <circle key={v.weekStart} cx={x(i)} cy={y(v.r)} r={i === values.length - 1 ? 3 : 2} className={styles.dot} />)}
  </svg>;
}

export function KeyConnections({ results, history, historyAvailable }: { results: readonly ConnectionResult[]; history: Record<string, ConnectionSnapshot[]>; historyAvailable: boolean }) {
  return <section className={`panel ${styles.panel}`} aria-label="Key connections" data-testid="key-connections">
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Fall 2026 · Tracked weekly</p><h2>Key Connections</h2></div>
      <p className={styles.legend}>r runs from −1 to +1. Game stats count hitters with {GAME_MINIMUMS.pa}+ PA and pitchers with {GAME_MINIMUMS.outs / 3}+ IP.</p>
    </header>
    <ul className={styles.grid}>{results.map(result => {
      const points = history[result.pair.key] ?? [], previous = [...points].reverse().find((p, i) => i > 0 && p.r !== null);
      const change = result.r !== null && previous?.r != null ? result.r - previous.r : null;
      const chance = result.r !== null && Math.abs(result.r) < chanceCutoff(result.n);
      const href = result.xKey && result.yKey ? `/analytics?${new URLSearchParams({ x: result.xKey, y: result.yKey, window: "366" }).toString()}` : null;
      return <li key={result.pair.key} className={styles.card} data-status={result.pair.status} data-sign={result.r === null ? "none" : result.r >= 0 ? "pos" : "neg"}>
        <div className={styles.top}><h3>{result.pair.title}</h3><span className={styles.status}>{result.pair.status === "strong" ? "Strong link" : "Watching"}</span></div>
        <p className={styles.why}>{result.pair.why}</p>
        <div className={styles.numbers}>
          <strong className={styles.r}>{result.r === null ? "—" : signed(result.r)}</strong>
          <span className={styles.meta}><b>{connectionStrength(result.r)}</b>{result.n ? ` · ${result.n} players` : ""}{chance ? " · could be chance" : ""}{change !== null && Math.abs(change) >= 0.005 ? <span className={styles.change}> · {change > 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)} vs {weekLabel(previous!.weekStart)}</span> : null}</span>
        </div>
        {historyAvailable ? <RTrend points={points} /> : <span className={styles.trendEmpty}>Weekly history is unavailable right now</span>}
        {href ? <Link prefetch={false} className={styles.link} href={href}>Open scatterplot<ArrowRight size={13} aria-hidden="true" /></Link> : <span className={styles.trendEmpty}>Waiting for both stats</span>}
      </li>;
    })}</ul>
    <p className={styles.note}>Each pair uses the same Fall results as the scatterplot (any test date). The scatterplot shows every player; these scores leave out small game samples. A connection doesn’t prove cause, and “could be chance” means the score is inside the range that random noise often produces for this many players.</p>
  </section>;
}
