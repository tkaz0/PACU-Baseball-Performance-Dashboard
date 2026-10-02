import Link from "next/link";
import { DEPTH_POSITIONS, type DepthPlayer, type DepthPosition } from "@/lib/depth-chart";
import { PlayerAvatar } from "@/components/player-avatar";
import styles from "./depth-chart.module.css";

const TITLES: Record<DepthPosition, string> = { P: "Pitchers", C: "Catchers", "1B": "First Base", "2B": "Second Base", "3B": "Third Base", SS: "Shortstop", OF: "Outfield" };

export function DepthChart({ chart, headshots = {} }: { chart: Record<DepthPosition, DepthPlayer[]>; headshots?: Readonly<Record<string, string>> }) {
  return <div className={styles.grid}>{DEPTH_POSITIONS.map(slot => <section key={slot} className={styles.slot} data-slot={slot} aria-label={TITLES[slot]}>
    <header><span className={styles.badge}>{slot}</span><h2>{TITLES[slot]}</h2><small>{chart[slot].filter(p => !p.secondary).length} primary · {chart[slot].filter(p => p.secondary).length} secondary</small></header>
    {chart[slot].length ? <ol>{chart[slot].map((player, index) => <li key={`${player.id}-${player.secondary}`} data-secondary={player.secondary || undefined}>
      <span className={styles.order}>{index + 1}</span>
      <PlayerAvatar name={player.name} path={headshots[player.code]} size={36}/>
      <div className={styles.who}><Link prefetch={false} href={`/athletes/${player.id}`}>{player.name}</Link><small>{player.academicClass || "Class to be added"}{player.secondary && <span className={styles.secondaryTag}>Secondary</span>}</small></div>
      <dl className={styles.stats}>{player.stats.length ? player.stats.map(s => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd>{s.sample && <small>{s.sample}</small>}</div>) : <div><dt>Results</dt><dd className={styles.none}>Not yet recorded</dd></div>}</dl>
    </li>)}</ol> : <p className={styles.none}>No players listed at this position.</p>}
  </section>)}</div>;
}
