import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StatInfo } from "@/components/stat-info";
import { TEAM_HISTORY_SPAN } from "@/lib/stat-benchmarks";
import type { ReportCardArea } from "@/lib/team-report-card";
import styles from "./team-report-card.module.css";

const FIFTH_NAMES = ["Bottom fifth", "Fourth fifth", "Middle fifth", "Second fifth", "Top fifth"];

function Radar({ areas }: { areas: ReportCardArea[] }) {
  const cx = 150, cy = 140, radius = 92;
  const polar = (index: number, value: number) => { const angle = -Math.PI / 2 + index * 2 * Math.PI / areas.length; return [cx + Math.cos(angle) * radius * value, cy + Math.sin(angle) * radius * value] as const; };
  const ring = (value: number) => areas.map((_, i) => polar(i, value).join(",")).join(" ");
  const point = (area: ReportCardArea) => (area.level + 1) / 5;
  return <svg viewBox="0 0 300 280" className={styles.radar} role="img" aria-label={areas.map(a => `${a.label} ${a.grade}`).join(", ")}>
    {[.2, .4, .6, .8, 1].map(level => <polygon key={level} points={ring(level)} fill="none" stroke="var(--line-subtle)"/>)}
    {areas.map((_, i) => { const [x, y] = polar(i, 1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line-subtle)"/>; })}
    <polygon points={areas.map((a, i) => polar(i, point(a)).join(",")).join(" ")} fill="color-mix(in srgb, var(--accent-readable) 22%, transparent)" stroke="var(--accent-readable)" strokeWidth="2.5"/>
    {areas.map((a, i) => { const [x, y] = polar(i, 1.2); return <text key={a.key} x={x} y={y + 4} textAnchor={Math.abs(x - cx) < 8 ? "middle" : x > cx ? "start" : "end"} fill="var(--text-primary)" fontSize="12" fontWeight="700">{a.label} <tspan fill="var(--text-secondary)">{a.grade}</tspan></text>; })}
  </svg>;
}

export function TeamReportCard({ areas, compact = false, href, id }: { areas: readonly ReportCardArea[]; compact?: boolean; href?: string; id?: string }) {
  if (!areas.length) return null;
  const strengths = areas.filter(a => a.level >= 3), focus = areas.filter(a => a.level <= 1);
  return <section id={id} className={styles.panel} aria-label="Team report card" data-testid="team-report-card">
    <header className={styles.header}><div><p className={styles.eyebrow}>Fall 2026 · vs NWC teams {TEAM_HISTORY_SPAN}</p><h2>Team Report Card</h2></div>{href && <Link prefetch={false} href={href} className={styles.link}>Full report card<ArrowRight size={14}/></Link>}</header>
    <div className={compact ? styles.compact : styles.layout}>
      <ul className={styles.grades}>{areas.map(area => <li key={area.key} data-grade={area.grade} data-area={area.key}>
        <span className={styles.letter}>{area.grade}</span>
        <span className={styles.detail}><strong>{area.label}<StatInfo metric={area.metric} label={area.statLabel} scope="team"/></strong><small>{area.statLabel} {area.value} · {area.band}{area.sample ? ` · ${area.sample}` : ""}</small>
          <span className={styles.fifths} role="img" aria-label={`${FIFTH_NAMES[area.level]} of NWC team-seasons`}>{[0, 1, 2, 3, 4].map(level => <i key={level} data-on={level === area.level || undefined} />)}</span></span>
      </li>)}</ul>
      {!compact && areas.length >= 3 && <Radar areas={[...areas]}/>}
    </div>
    {!compact && (strengths.length > 0 || focus.length > 0) && <div className={styles.notes}>
      {strengths.length > 0 && <div><h3>What&apos;s Working</h3><ul>{strengths.map(a => <li key={a.key}>{a.label}: {a.statLabel} {a.value} is in the {a.level === 4 ? "top fifth" : "second fifth"} of NWC team-seasons since {TEAM_HISTORY_SPAN.slice(0, 4)}.</li>)}</ul></div>}
      {focus.length > 0 && <div><h3>Focus Areas</h3><ul>{focus.map(a => <li key={a.key}>{a.label}: {a.statLabel} {a.value} is in the {a.level === 0 ? "bottom fifth" : "fourth fifth"} of NWC team-seasons since {TEAM_HISTORY_SPAN.slice(0, 4)}.</li>)}</ul></div>}
    </div>}
    {!compact && <p className={styles.note}>Each letter is the fifth of the published Northwest Conference team distribution ({TEAM_HISTORY_SPAN}, 90 team-seasons; 2020 left out as COVID-shortened) that Pacific&apos;s pooled Fall rate falls in: A top fifth, F bottom fifth. These are dashboard bands, not official grades, and there is no overall grade. Fall intrasquads face Pacific pitching and hitting, not conference opponents.</p>}
  </section>;
}
