import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { StatInfo } from "@/components/stat-info";
import { Sparkline } from "@/components/charts/sparkline";
import { gameValue } from "@/lib/game-metrics";
import type { TrendingGroup } from "@/lib/home-trending";
import styles from "./home-trending.module.css";

function changeText(change: number, digits: number) {
  const magnitude = Math.abs(change).toFixed(digits);
  return `${change > 0 ? "+" : "−"}${Number(magnitude) === 0 ? `<${(10 ** -digits).toFixed(digits)}` : magnitude}`;
}

/** Receives only the compact staff result, not the underlying weekly observations. */
export function HomeTrending({ groups }: { groups: readonly TrendingGroup[] | null }) {
  return <section className={styles.panel} aria-label="Trending Up" data-testid="home-trending">
    <header className={styles.heading}><div><h2><TrendingUp size={20} aria-hidden="true"/>Trending Up</h2><p>Game results · biggest changes in the latest two available weeks</p></div><Link prefetch={false} href="/game-stats">Game Stats<ArrowRight size={14} aria-hidden="true"/></Link></header>
    {groups === null ? <p className={styles.note} role="status">Weekly changes are temporarily unavailable. Refresh to try again.</p> : <>
      <div className={styles.grid}>{groups.map(group => <article key={group.kind} aria-label={`${group.kind === "hitting" ? "Hitting" : "Pitching"} improvements`}>
        <div className={styles.groupTitle}><h3>{group.kind === "hitting" ? "Hitting · OPS ↑" : "Pitching · WHIP ↓"}<StatInfo metric={group.metric} label={group.label}/></h3>{group.beforeLabel && group.afterLabel && <span title={`${group.beforeDetail} → ${group.afterDetail}`}>{group.beforeLabel} → {group.afterLabel}</span>}</div>
        {group.players.length > 0 ? <ul>{group.players.map(player => <li key={player.code}>
          <div className={styles.player}><strong>{player.profileId ? <Link prefetch={false} href={`/athletes/${player.profileId}?tab=game-stats`}>{player.name}</Link> : player.name}</strong><span className={styles.gain}>{changeText(player.change, group.kind === "hitting" ? 3 : 2)}{player.tied && <small>Tied change</small>}</span></div>
          <div className={styles.values}><span><b>{gameValue(player.before, group.unit)}</b><small>{player.beforeSample}</small></span><ArrowRight size={14} aria-hidden="true"/><span><b>{gameValue(player.after, group.unit)}</b><small>{player.afterSample}</small></span>
            {player.history.length >= 2 && <span className={styles.spark}><Sparkline points={player.history.map(h => ({ date: `Week ${h.week}`, value: h.value }))} width={90} height={24} label={`${player.name} ${group.label} by week`} noun="weeks" direction={group.kind === "hitting" ? "higher" : "lower"} format={value => gameValue(value, group.unit)}/></span>}</div>
        </li>)}</ul> : <p className={styles.empty}>{group.comparable ? `No ${group.kind === "hitting" ? "OPS increases" : "WHIP decreases"} in these weeks.` : "Needs two consecutive weeks with complete results for the same players."}</p>}
      </article>)}</div>
      <p className={styles.note}>Hitting compares added QPA counts between saved updates; pitching compares separate weekly totals. Small samples can move quickly. Changes are in stat points, not percent.</p>
    </>}
  </section>;
}
