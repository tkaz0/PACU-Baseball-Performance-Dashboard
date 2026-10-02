import { ordinal, percentileColor } from "@/lib/percentile-color";

/** Team percentile as a ring. Neutral measurements (body size, spin) use a gray ring: a position, not a grade. */
export function PercentileRing({ value, size = 52, neutral = false, label }: { value: number; size?: number; neutral?: boolean; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = 42, circumference = 2 * Math.PI * r;
  const stroke = neutral ? "var(--text-secondary)" : percentileColor(pct).backgroundColor;
  return <svg className="percentile-ring" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={neutral ? `${label}: team position ${ordinal(pct)} of 100, descriptive, not a grade` : `${label}: ${ordinal(pct)} percentile on the team`}>
    <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-raised)" strokeWidth="9"/>
    <circle cx="50" cy="50" r={r} fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${circumference * pct / 100} ${circumference}`} transform="rotate(-90 50 50)"/>
    <text x="50" y={neutral ? 45 : 50} textAnchor="middle" dominantBaseline="central" fontSize="30" fontWeight="800" fill="currentColor">{pct}</text>{neutral && <text x="50" y="68" textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="800" letterSpacing="1" fill="var(--text-secondary)">POS</text>}
  </svg>;
}
