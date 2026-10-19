import type { CommandRow } from "@/lib/development-focus";
import styles from "./command-scatter.module.css";

const lastName = (name: string) => name.trim().split(/\s+/).at(-1) ?? name;
/** Strike % against BB/9 per pitcher, with the team BB/9 line. Descriptive; dots follow the table filter. */
export function CommandScatter({ rows, teamBb9 }: { rows: readonly CommandRow[]; teamBb9: number | null }) {
  const points = rows.filter((row): row is CommandRow & { strikePct: number; bb9: number } => row.strikePct !== null && row.bb9 !== null);
  if (points.length < 3) return null;
  const W = 640, H = 300, L = 56, R = 16, T = 18, B = 38;
  // Scale to pitchers with 3+ IP so one tiny sample can't squash the chart; higher values sit at the top edge.
  const steady = points.filter(p => p.outs >= 9), basis = steady.length >= 3 ? steady : points;
  const xs = points.map(p => p.strikePct);
  const xMin = Math.floor(Math.min(...xs) / 5) * 5, xMax = Math.max(xMin + 5, Math.ceil(Math.max(...xs) / 5) * 5);
  const rawMax = Math.max(...basis.map(p => p.bb9), teamBb9 ?? 0) * 1.1;
  const step = [1, 2, 3, 5, 10, 15, 20].find(st => rawMax / st <= 6) ?? 30, yMax = Math.max(step, Math.ceil(rawMax / step) * step);
  const x = (v: number) => L + (v - xMin) / (xMax - xMin) * (W - L - R), y = (v: number) => T + (1 - Math.min(v, yMax) / yMax) * (H - T - B);
  const xTicks = Array.from({ length: Math.round((xMax - xMin) / 5) + 1 }, (_, i) => xMin + i * 5), yTicks = Array.from({ length: yMax / step + 1 }, (_, i) => i * step);
  // Label the most-used arms first and skip labels that would collide.
  const placed: { x: number; y: number }[] = [], labeled = new Set<string>();
  for (const p of [...points].sort((a, b) => b.outs - a.outs)) {
    const px = x(p.strikePct) + 8, py = y(p.bb9) + 4;
    if (placed.every(q => Math.abs(q.y - py) > 13 || Math.abs(q.x - px) > 70)) { placed.push({ x: px, y: py }); labeled.add(p.player.id); }
  }
  return <figure className={styles.figure} data-testid="command-scatter">
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-label={`Strike percentage against walks per nine for ${points.length} pitchers`}>
      {yTicks.map(t => <g key={`y${t}`}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className={styles.grid} /><text x={L - 8} y={y(t) + 4} textAnchor="end" className={styles.tick}>{t}</text></g>)}
      {xTicks.map(t => <text key={`x${t}`} x={x(t)} y={H - B + 18} textAnchor="middle" className={styles.tick}>{t}%</text>)}
      <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" className={styles.axis}>Strike % (more strikes →)</text>
      <text x={14} y={(T + H - B) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(T + H - B) / 2})`} className={styles.axis}>BB/9 (lower is better)</text>
      {teamBb9 !== null && <g><line x1={L} x2={W - R} y1={y(teamBb9)} y2={y(teamBb9)} className={styles.team} /><text x={W - R} y={y(teamBb9) - 5} textAnchor="end" className={styles.teamLabel}>Team BB/9 {teamBb9.toFixed(2)}</text></g>}
      {points.map(p => <g key={p.player.id} className={p.aboveTeam ? styles.above : styles.below}>
        <circle cx={x(p.strikePct)} cy={y(p.bb9)} r={Math.max(4, Math.min(9, 3 + p.outs / 9))} data-off={p.bb9 > yMax || undefined}><title>{`${p.player.name}: ${p.strikePct.toFixed(1)}% strikes, ${p.bb9.toFixed(2)} BB/9, ${p.innings} IP`}</title></circle>
        {labeled.has(p.player.id) && <text x={x(p.strikePct) + 8} y={y(p.bb9) + 4} className={styles.label}>{lastName(p.player.name)}{p.bb9 > yMax ? ` ↑ ${p.bb9.toFixed(1)}` : ""}</text>}
      </g>)}
    </svg>
    <figcaption className={styles.caption}>Each dot is a pitcher; bigger dots have thrown more innings, and hover shows the line. Red dots walk more than the team rate. The scale fits pitchers with 3+ IP; an arrow marks a smaller sample above the top. Across the staff, more strikes has gone with fewer walks (see Key Connections in Analytics).</figcaption>
  </figure>;
}
