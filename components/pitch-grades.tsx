import Link from "next/link";
import { PlayerAvatar } from "@/components/player-avatar";
import { pitchTypeLabel } from "@/lib/imports/pitch-assignments";
import { MIN_BALLS_IN_PLAY, MIN_FAMILY_PITCHES, MIN_STUFF_PITCHERS, PLAYER_BASELINE_MIN_PITCHERS, PITCH_GRADE_WEIGHTS, type PitchGradeRow } from "@/lib/pitch-grades";
import styles from "./pitch-grades.module.css";

/** Shade runs blue (below 100) to red (above 100), full strength at the 50/150 caps. */
const shade = (v: number) => { const t = Math.max(-1, Math.min(1, (v - 100) / 50)); return { "--heat": `${Math.round(Math.abs(t) * 55)}%`, "--heat-color": t >= 0 ? "#c8102e" : "#367ea3" } as React.CSSProperties; };
const score = (v: number | null) => v === null ? <span className={styles.na}>—</span> : <span className={styles.score} data-band={v >= 110 ? "high" : v <= 90 ? "low" : "mid"} style={shade(v)}>{Math.round(v)}</span>;
const one = (v: number | null, suffix = "") => v === null ? "—" : `${v.toFixed(1)}${suffix}`;

export function PitchGradesMethod({ stuffMinimum = MIN_STUFF_PITCHERS }: { stuffMinimum?: number } = {}) {
  return <p className={styles.note}>Pitch+ (Team) is a Pacific-only outcome grade, not Stuff+: there is no movement, release or run-value model. 100 is the team average. Strike+ ({PITCH_GRADE_WEIGHTS.strike * 100}%) compares the game sheet&apos;s strike rate for that pitch family (fastball, breaking ball or changeup) with the team rate, so pitches in one family share it ({MIN_FAMILY_PITCHES}+ family pitches). Contact+ ({PITCH_GRADE_WEIGHTS.contact * 100}%) compares average exit velocity, hard-hit rate (90+ mph) and Squared Up against this pitch with every linked in-game ball against Pacific pitchers (likely fouls left out). A pitch uses its own balls in play once it has {MIN_BALLS_IN_PLAY}+; until then Contact+ uses all of the pitcher&apos;s balls in play ({MIN_BALLS_IN_PLAY}+), marked &ldquo;all pitches&rdquo;, so those pitches share one contact score. Stuff-lite ({PITCH_GRADE_WEIGHTS.stuff * 100}%) scores velocity and spin against teammates throwing the same pitch type; changeups and splitters use their speed gap below the pitcher&apos;s main fastball ({stuffMinimum}+ pitchers with that pitch). Parts are capped at 50–150. The overall grade appears only when all three parts meet their minimums. Cutters count in the fastball family. Swing-and-miss is not recorded, so strikeout stuff is not graded. Small samples move quickly.</p>;
}

export function PitchGradesTable({ rows, showPitcher = true, headshots = {} }: { rows: readonly PitchGradeRow[]; showPitcher?: boolean; headshots?: Readonly<Record<string, string>> }) {
  if (!rows.length) return <p className="muted text-sm">No classified in-game pitches yet.</p>;
  // Keep each pitcher's pitches together (first-appearance order) so an arsenal reads as one block.
  const order = [...new Set(rows.map(row => row.player.id))];
  const grouped = order.flatMap(id => rows.filter(row => row.player.id === id));
  return <div className="table-wrap"><table className={styles.table}><thead><tr>{showPitcher && <th>Pitcher</th>}<th>Pitch</th><th className="text-right">Pitch+</th><th className="text-right">Strike+</th><th className="text-right">Contact+</th><th className="text-right">Stuff-lite</th><th className="text-right">Velo</th><th className="text-right">Spin</th><th className="text-right">Family Strike %</th><th className="text-right">Balls in Play</th><th className="text-right">EV Against</th><th className="text-right">Hard Hit</th><th className="text-right">Squared Up</th></tr></thead>
    <tbody>{grouped.map((row, index) => { const first = index === 0 || grouped[index - 1].player.id !== row.player.id, span = grouped.filter(r => r.player.id === row.player.id).length;
      return <tr key={`${row.player.id}:${row.pitchType}`} data-pitch-grade={`${row.player.code}:${row.pitchType}`} className={showPitcher && first && index > 0 ? styles.groupStart : undefined}>
      {showPitcher && first && <th scope="rowgroup" rowSpan={span} className={styles.pitcher}><Link prefetch={false} href={`/athletes/${row.player.id}?tab=pitching`}><PlayerAvatar name={row.player.name} path={headshots[row.player.code]} size={36}/><span>{row.player.name}<small>{span} {span === 1 ? "pitch" : "pitches"}</small></span></Link></th>}
      <td><span className={styles.pitchChip}>{pitchTypeLabel(row.pitchType)}</span></td>
      <td className="text-right">{row.grade === null ? <span className={styles.na} title={`Needs ${row.missing.join(", ")}`}>Needs data</span> : <strong>{score(row.grade)}</strong>}</td>
      <td className="text-right">{score(row.strike)}</td><td className="text-right">{score(row.contact)}{row.contactBasis === "pitcher" && <small className={styles.sub}>all pitches</small>}</td><td className="text-right">{score(row.stuff)}</td>
      <td className="text-right tabular-nums">{one(row.velocity, " mph")}</td><td className="text-right tabular-nums">{row.spin === null ? "—" : `${Math.round(row.spin).toLocaleString("en-US")} rpm`}{row.velocityGap !== null && <small className={styles.sub}>{row.velocityGap.toFixed(1)} mph off FB</small>}</td>
      <td className="text-right tabular-nums">{one(row.strikePct, "%")}{row.familyPitches !== null && <small className={styles.sub}>{row.familyPitches} family pitches</small>}</td>
      <td className="text-right tabular-nums">{row.ballsInPlay}{row.contactBasis === "pitcher" && <small className={styles.sub}>all pitches</small>}</td><td className="text-right tabular-nums">{one(row.avgEvAgainst, " mph")}</td><td className="text-right tabular-nums">{one(row.hardHitAgainst, "%")}</td><td className="text-right tabular-nums">{one(row.squaredAgainst, "%")}</td>
    </tr>; })}</tbody></table></div>;
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

/** A player's own Pitch+ against the published aggregate team baselines; no other pitcher's values are read. */
export async function OwnPitchGrades({ load }: { load: Promise<{ rows: PitchGradeRow[]; computedAt: string; contactUnavailable: boolean } | null> }) {
  let result: Awaited<typeof load>;
  try { result = await load; } catch { return <p role="status" className="muted text-sm">Pitch grades are temporarily unavailable.</p>; }
  if (!result || !result.rows.length) return null;
  const updated = new Date(result.computedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" });
  return <section className={styles.panel} aria-label="Pitch grades" data-testid="own-pitch-grades">
    <header><h2>Pitch+ (Team)</h2><p>100 = Pacific average · Team baselines updated {updated}</p></header>
    {result.contactUnavailable && <p role="status" className="muted text-sm">Contact against is temporarily unavailable, so Contact+ is missing.</p>}
    <PitchGradesTable rows={result.rows} showPitcher={false}/><PitchGradesMethod stuffMinimum={PLAYER_BASELINE_MIN_PITCHERS}/>
  </section>;
}
