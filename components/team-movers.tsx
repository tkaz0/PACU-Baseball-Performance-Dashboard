import Link from "next/link";
import { coachingValue } from "@/lib/coaching-tools";
import { leaderboardTestDate } from "@/lib/leaderboards";
import { pitchSourceLabel } from "@/lib/pitch-display";
import type { MoverBoard } from "@/lib/team-movers";
import styles from "./team-movers.module.css";

export function TeamMovers({ boards }: { boards: MoverBoard[] }) {
  if (!boards.length) return <p className="muted text-sm">No repeat tests show an improvement yet. Biggest Jumps fills in as players are retested.</p>;
  const categories = [...new Set(boards.map(b => b.category))];
  return <div className={styles.wrap}>
    {categories.map(category => <section key={category} aria-label={category}><h2 className={styles.heading}>{category}</h2>
      <div className={styles.grid}>{boards.filter(b => b.category === category).map(board => <article key={board.key} className={styles.card}>
        <header><h3>{board.label}</h3><small>{pitchSourceLabel(board.source)} · {board.compared} repeat {board.compared === 1 ? "test" : "tests"}</small></header>
        <ol>{board.movers.map(m => <li key={m.athleteId}>
          <Link prefetch={false} href={`/athletes/${m.athleteId}`}>{m.name}</Link>
          <strong>{m.raw || m.percent === null ? `${m.delta > 0 ? "+" : "−"}${coachingValue(Math.abs(m.delta), board.metric, board.unit, board.source)}` : `${m.percent > 0 ? "+" : "−"}${Math.abs(m.percent).toFixed(1)}%`}</strong>
          <small>{coachingValue(m.previous, board.metric, board.unit, board.source)} → {coachingValue(m.latest, board.metric, board.unit, board.source)} · {leaderboardTestDate(m.previousDate)} to {leaderboardTestDate(m.latestDate)}</small>
        </li>)}</ol>
      </article>)}</div></section>)}
    <p className="muted text-sm">Each player&apos;s latest test compared with their previous test of the same measurement, source and unit, as on Team Progress. Changes under 1% count as steady. Body and spin measurements are not ranked. Single-best maximums (exit velocity, bat speed, distance, velocity) show the raw change instead of a percent.</p>
  </div>;
}
