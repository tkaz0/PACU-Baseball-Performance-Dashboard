import type { ReactNode } from "react";
import { ordinal, percentileColor } from "@/lib/percentile-color";
import type { RankingRow } from "@/components/percentile-rankings";
import styles from "./skill-profile.module.css";

type Axis = { key: string; label: string; percentile: number; sampleSize: number };
const inGame = (row: RankingRow) => row.game || /^Full Swing · (Game|Intrasquad)$/.test(row.guide.source);
/** First verified row for each axis, preferring In-Game Full Swing over Practice for testing metrics. */
function pick(rows: readonly RankingRow[], axes: readonly { metric: string; label: string }[]): Axis[] {
  return axes.flatMap(axis => {
    const matches = rows.filter(row => row.metric === axis.metric).sort((a, b) => Number(inGame(b)) - Number(inGame(a)));
    return matches[0] ? [{ key: axis.metric, label: axis.label, percentile: matches[0].percentile, sampleSize: matches[0].sampleSize }] : [];
  });
}
const HITTING = [
  { metric: "batting_production_plus", label: "PAC Prod+" }, { metric: "qpa_pct", label: "QPA%" }, { metric: "batting_obp", label: "OBP" },
  { metric: "batting_est_iso", label: "ISO" }, { metric: "max_exit_velocity", label: "Max EV" }, { metric: "avg_bat_speed", label: "Bat Speed" },
];
const PITCHING = [
  { metric: "pitching_whip", label: "WHIP" }, { metric: "pitching_k_bb", label: "K/BB" }, { metric: "pitching_r9", label: "Runs/9" },
  { metric: "strike_pct", label: "Strike %" }, { metric: "pitching_k9", label: "K/9" }, { metric: "max_pitch_velocity", label: "Velocity" },
];

function Radar({ title, axes }: { title: string; axes: Axis[] }) {
  const cx = 150, cy = 140, radius = 92;
  const polar = (index: number, value: number) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / axes.length;
    return [cx + Math.cos(angle) * radius * value / 100, cy + Math.sin(angle) * radius * value / 100] as const;
  };
  const ring = (value: number) => axes.map((_, index) => polar(index, value).join(",")).join(" ");
  return <figure className={styles.radar} aria-label={`${title} skill profile`}>
    <figcaption><h3>{title}</h3><p>{axes.length} team percentiles · Fall 2026</p></figcaption>
    <svg viewBox="0 0 300 280" role="img" aria-label={axes.map(axis => `${axis.label} ${ordinal(axis.percentile)} percentile`).join(", ")}>
      {[25, 50, 75, 100].map(level => <polygon key={level} points={ring(level)} fill="none" stroke="var(--line-subtle)" strokeWidth="1" />)}
      {axes.map((_, index) => { const [x, y] = polar(index, 100); return <line key={index} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line-subtle)" />; })}
      <polygon points={axes.map((axis, index) => polar(index, axis.percentile).join(",")).join(" ")} fill="color-mix(in srgb, var(--accent-readable) 22%, transparent)" stroke="var(--accent-readable)" strokeWidth="2.5" />
      {axes.map((axis, index) => { const [x, y] = polar(index, axis.percentile); return <circle key={axis.key} cx={x} cy={y} r="5" fill={percentileColor(axis.percentile).backgroundColor} stroke="var(--surface-panel)" strokeWidth="2"><title>{`${axis.label}: ${ordinal(axis.percentile)} percentile of ${axis.sampleSize} players`}</title></circle>; })}
      {axes.map((axis, index) => { const [x, y] = polar(index, 122); return <text key={`${axis.key}-label`} x={x} y={y + 4} textAnchor={Math.abs(x - cx) < 8 ? "middle" : x > cx ? "start" : "end"} fill="var(--text-primary)" fontSize="12" fontWeight="700">{axis.label} <tspan fill="var(--text-secondary)" fontWeight="600">{Math.round(axis.percentile)}</tspan></text>; })}
    </svg>
  </figure>;
}

/** Hitting and pitching radars from existing verified percentiles; descriptive, not a composite score. */
export function SkillProfile({ rows, extra }: { rows: readonly RankingRow[]; extra?: ReactNode }) {
  const hitting = pick(rows, HITTING), pitching = pick(rows, PITCHING);
  const radars = [hitting.length >= 3 && <Radar key="hitting" title="Hitting" axes={hitting} />, pitching.length >= 3 && <Radar key="pitching" title="Pitching" axes={pitching} />].filter(Boolean);
  if (!radars.length && !extra) return null;
  return <section className={styles.panel} aria-label="Skill profile" data-testid="skill-profile">
    <header><p className={styles.eyebrow}>Fall 2026 · vs Pacific</p><h2>Skill Profile</h2></header>
    <div className={styles.grid}>{radars}{extra}</div>
    <p className={styles.note}>Each axis is a separate team percentile with its own comparable cohort (at least five players); larger shapes are better on every axis. It is a picture of the rankings, not a combined score.</p>
  </section>;
}

/** Team best = sole leader (100th percentile); Top 10% = 90th percentile and up. Exact from verified percentiles. */
export function AwardBadges({ rows }: { rows: readonly RankingRow[] }) {
  const badges = rows.filter(row => row.percentile >= 90)
    .sort((a, b) => b.percentile - a.percentile || a.label.localeCompare(b.label)).slice(0, 6);
  if (!badges.length) return null;
  return <ul className={styles.badges} aria-label="Team awards" data-testid="award-badges">
    {badges.map(row => <li key={row.key} data-best={row.percentile === 100 || undefined}>
      <span aria-hidden="true">{row.percentile === 100 ? "★" : "▲"}</span>{row.percentile === 100 ? "Team best" : "Top 10%"} · {row.label}
    </li>)}
  </ul>;
}
