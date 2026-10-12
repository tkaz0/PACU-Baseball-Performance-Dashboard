import Link from "next/link";
import { pitchTypeLabel } from "@/lib/imports/pitch-assignments";
import { MIN_BALLS_IN_PLAY, MIN_FAMILY_PITCHES, MIN_STUFF_PITCHERS, PITCH_GRADE_WEIGHTS, type PitchGradeRow } from "@/lib/pitch-grades";
import styles from "./pitch-grades.module.css";

const score = (v: number | null) => v === null ? <span className={styles.na}>—</span> : <span className={styles.score} data-band={v >= 110 ? "high" : v <= 90 ? "low" : "mid"}>{Math.round(v)}</span>;
const one = (v: number | null, suffix = "") => v === null ? "—" : `${v.toFixed(1)}${suffix}`;

export function PitchGradesMethod() {
  return <p className={styles.note}>Pitch+ (Team) is a Pacific-only outcome grade, not Stuff+: there is no movement, release or run-value model. 100 is the team average. Strike+ ({PITCH_GRADE_WEIGHTS.strike * 100}%) compares the game sheet&apos;s strike rate for that pitch family (fastball, breaking ball or changeup) with the team rate, so pitches in one family share it ({MIN_FAMILY_PITCHES}+ family pitches). Contact+ ({PITCH_GRADE_WEIGHTS.contact * 100}%) compares average exit velocity, hard-hit rate (90+ mph) and Squared Up against this pitch with every linked in-game ball against Pacific pitchers ({MIN_BALLS_IN_PLAY}+ balls in play, likely fouls left out). Stuff-lite ({PITCH_GRADE_WEIGHTS.stuff * 100}%) scores velocity and spin against teammates throwing the same pitch type; changeups and splitters use their speed gap below the pitcher&apos;s main fastball ({MIN_STUFF_PITCHERS}+ teammates). Parts are capped at 50–150. The overall grade appears only when all three parts meet their minimums. Cutters count in the fastball family. Swing-and-miss is not recorded, so strikeout stuff is not graded. Small samples move quickly.</p>;
}

export function PitchGradesTable({ rows, showPitcher = true }: { rows: readonly PitchGradeRow[]; showPitcher?: boolean }) {
  if (!rows.length) return <p className="muted text-sm">No classified in-game pitches yet.</p>;
  return <div className="table-wrap"><table className={styles.table}><thead><tr>{showPitcher && <th>Pitcher</th>}<th>Pitch</th><th className="text-right">Pitch+</th><th className="text-right">Strike+</th><th className="text-right">Contact+</th><th className="text-right">Stuff-lite</th><th className="text-right">Velo</th><th className="text-right">Spin</th><th className="text-right">Family Strike %</th><th className="text-right">Balls in Play</th><th className="text-right">EV Against</th><th className="text-right">Hard Hit</th><th className="text-right">Squared Up</th></tr></thead>
    <tbody>{rows.map(row => <tr key={`${row.player.id}:${row.pitchType}`} data-pitch-grade={`${row.player.code}:${row.pitchType}`}>
      {showPitcher && <th scope="row"><Link prefetch={false} href={`/athletes/${row.player.id}?tab=pitching`}>{row.player.name}</Link></th>}
      <td>{pitchTypeLabel(row.pitchType)}</td>
      <td className="text-right">{row.grade === null ? <span className={styles.na} title={`Needs ${row.missing.join(", ")}`}>Needs data</span> : <strong>{score(row.grade)}</strong>}</td>
      <td className="text-right">{score(row.strike)}</td><td className="text-right">{score(row.contact)}</td><td className="text-right">{score(row.stuff)}</td>
      <td className="text-right tabular-nums">{one(row.velocity, " mph")}</td><td className="text-right tabular-nums">{row.spin === null ? "—" : `${Math.round(row.spin).toLocaleString("en-US")} rpm`}{row.velocityGap !== null && <small className={styles.sub}>{row.velocityGap.toFixed(1)} mph off FB</small>}</td>
      <td className="text-right tabular-nums">{one(row.strikePct, "%")}{row.familyPitches !== null && <small className={styles.sub}>{row.familyPitches} family pitches</small>}</td>
      <td className="text-right tabular-nums">{row.ballsInPlay}</td><td className="text-right tabular-nums">{one(row.avgEvAgainst, " mph")}</td><td className="text-right tabular-nums">{one(row.hardHitAgainst, "%")}</td><td className="text-right tabular-nums">{one(row.squaredAgainst, "%")}</td>
    </tr>)}</tbody></table></div>;
}

/** Streamed on a pitcher's Pitching tab for staff; the team computation never blocks the profile. */
export async function PitcherPitchGrades({ athleteId, load }: { athleteId: string; load: () => Promise<{ rows: PitchGradeRow[] }> }) {
  let rows: PitchGradeRow[];
  try { rows = (await load()).rows.filter(row => row.player.id === athleteId); } catch { return <p role="status" className="muted text-sm">Pitch grades are temporarily unavailable.</p>; }
  if (!rows.length) return null;
  return <section className={styles.panel} aria-label="Pitch grades" data-testid="pitcher-pitch-grades">
    <header><h2>Pitch+ (Team)</h2><p>Staff view · 100 = Pacific average · <Link prefetch={false} href="/pitch-grades">All pitchers</Link></p></header>
    <PitchGradesTable rows={rows} showPitcher={false}/><PitchGradesMethod/>
  </section>;
}
