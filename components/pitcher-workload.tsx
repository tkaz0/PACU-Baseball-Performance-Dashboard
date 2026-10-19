import Link from "next/link";
import { pitcherWorkload, WORKLOAD_JUMP, WORKLOAD_MIN_PITCHES } from "@/lib/pitcher-workload";
import { fallBallWeekDate } from "@/lib/game-weeks";
import type { SharedGameStat } from "@/lib/game-server";
import type { CoachingPlayer } from "@/lib/coaching-tools";
import styles from "./pitcher-workload.module.css";

const ip = (outs: number | null) => outs === null ? "" : `${Math.floor(outs / 3)}.${outs % 3} IP`;
const short = (week: number) => { const d = fallBallWeekDate(week); return d ?? null; };

/** Weekly pitches per pitcher with a heat cell per week and a flag for a big jump in the latest week. */
export function PitcherWorkload({ players, stats }: { players: CoachingPlayer[]; stats: SharedGameStat[] }) {
  const { weeks, rows } = pitcherWorkload(players, stats);
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.flatMap(r => r.weeks.map(w => w.pitches ?? 0)));
  const flagged = rows.filter(r => r.flagged).length;
  return <section className={styles.panel} aria-label="Pitcher workload" data-testid="pitcher-workload">
    <header><h2>Pitcher Workload</h2><p>Pitches by Fall Ball week from the pitching sheet. {flagged ? <><strong>{flagged} {flagged === 1 ? "pitcher" : "pitchers"}</strong> threw at least {Math.round(WORKLOAD_JUMP * 100)}% more pitches in the latest week than their previous outing ({WORKLOAD_MIN_PITCHES}+ pitches).</> : "No big week-over-week jumps in the latest week."}</p></header>
    <div className="table-wrap"><table className={styles.table}>
      <thead><tr><th scope="col">Pitcher</th>{weeks.map(w => <th key={w} scope="col" className="text-right">Wk {w}{short(w) && <small>{short(w)}</small>}</th>)}<th scope="col" className="text-right">Fall Total</th><th scope="col" className="text-right">Latest vs Previous</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.player.id} data-flagged={row.flagged || undefined}>
        <th scope="row"><Link prefetch={false} href={`/athletes/${row.player.id}?tab=pitching`}>{row.player.name}</Link></th>
        {row.weeks.map(w => <td key={w.week} className={styles.cell} style={{ "--load": `${Math.round((w.pitches ?? 0) / max * 60)}%` } as React.CSSProperties}>{w.pitches === null ? <span className={styles.na}>—</span> : w.pitches === 0 ? <span className={styles.na}>0</span> : <><strong>{w.pitches}</strong><small>{ip(w.outs)}</small></>}</td>)}
        <td className="text-right tabular-nums"><strong>{row.total}</strong></td>
        <td className={`text-right tabular-nums ${styles.change}`}>{row.jump === null ? <span className={styles.na}>—</span> : <>{row.jump > 0 ? "+" : ""}{Math.round(row.jump * 100)}%{row.flagged && <span className={styles.flag}>Big jump</span>}<small>Wk {row.previous!.week} → Wk {row.latest!.week}</small></>}</td>
      </tr>)}</tbody>
    </table></div>
    <p className={styles.note}>Weekly sheet blocks only, so no pitch is counted twice. Darker cells mean more pitches. &ldquo;Big jump&rdquo; is a heads-up about usage, not a rest or pitch-count rule; previous outings may be in an earlier week.</p>
  </section>;
}
