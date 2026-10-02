/** Small trend line for repeat readings of one exact metric/source/unit/period. Needs at least two points. */
export function Sparkline({ points, width = 120, height = 34, label, lowerIsBetter = false }: { points: readonly { date: string; value: number }[]; width?: number; height?: number; label: string; lowerIsBetter?: boolean }) {
  if (points.length < 2) return null;
  const values = points.map(p => p.value), min = Math.min(...values), max = Math.max(...values), span = max - min || 1, pad = 4;
  const xy = points.map((p, i) => [pad + (i / (points.length - 1)) * (width - pad * 2), pad + (1 - (p.value - min) / span) * (height - pad * 2)] as const);
  const change = values.at(-1)! - values[0], improving = change === 0 ? null : lowerIsBetter ? change < 0 : change > 0;
  const color = improving === null ? "var(--text-secondary)" : "var(--accent-readable)";
  return <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}: ${points.length} tests from ${values[0]} to ${values.at(-1)}`}>
    <polyline points={xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
    {xy.map(([x, y], i) => <circle key={points[i].date} cx={x} cy={y} r={i === xy.length - 1 ? 3.2 : 2} fill={i === xy.length - 1 ? color : "var(--surface-panel)"} stroke={color} strokeWidth="1.5"/>)}
  </svg>;
}
