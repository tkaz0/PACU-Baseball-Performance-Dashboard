import { pitchTypeLabel } from "@/lib/imports/pitch-assignments";
import { leaderboardTestDate } from "@/lib/leaderboards";
import type { Measurement } from "@/lib/imports/engine";
import { formatSourceNumber } from "@/lib/measurement-display";
import { fallArsenalPitches, type FallArsenalPitch } from "@/lib/pitch-arsenal";
import { PitchArsenalChart } from "@/components/pitch-arsenal-chart";
import { PitchSeparationChart } from "@/components/pitch-separation-chart";
import { StatInfo } from "@/components/stat-info";
import styles from "./classified-pitch-results.module.css";

const dateRange = (first: string | null, last: string | null) => !first || !last ? "Date unavailable" : first === last ? leaderboardTestDate(first) : `${leaderboardTestDate(first)} – ${leaderboardTestDate(last)}`;
function Average({ pitch, family }: { pitch: FallArsenalPitch; family: "velocity" | "spin" }) {
  const velocity = family === "velocity", value = velocity ? pitch.averageVelocity : pitch.averageSpin;
  const basis = velocity ? pitch.velocityBasis : pitch.spinBasis, count = velocity ? pitch.velocityReadings : pitch.spinReadings;
  const first = velocity ? pitch.velocityAverageFirstDate : pitch.spinAverageFirstDate, last = velocity ? pitch.velocityAverageLastDate : pitch.spinAverageLastDate;
  return <td data-label={velocity ? "Avg Velocity · mph" : "Avg Spin · RPM"}><strong>{value === null ? "—" : formatSourceNumber(value, pitch.source)}</strong><StatInfo metric={velocity ? "classified_avg_velocity" : "classified_avg_spin"} label={`${pitchTypeLabel(pitch.pitchType)} Average ${velocity ? "Velocity" : "Spin"}`} source={pitch.source} unit={velocity ? "mph" : "rpm"} value={value}/><small>{value === null ? "Needs complete readings" : basis === "fall" ? "Fall average" : "Latest session"}</small>{value !== null && <small>{dateRange(first, last)} · n={count ?? "—"}</small>}</td>;
}
function Maximum({ pitch, family }: { pitch: FallArsenalPitch; family: "velocity" | "spin" }) {
  const value = family === "velocity" ? pitch.maxVelocity : pitch.maxSpin, date = family === "velocity" ? pitch.maxVelocityDate : pitch.maxSpinDate;
  const count = family === "velocity" ? pitch.maxVelocityReadings : pitch.maxSpinReadings;
  return <td data-label={family === "velocity" ? "Max Velocity · mph" : "Max Spin · RPM"}><strong>{value === null ? "—" : formatSourceNumber(value, pitch.source)}</strong><small>{value === null ? "Not recorded" : "Fall best"}</small>{date && <small>{leaderboardTestDate(date)}{count === null || count === undefined ? "" : ` · n=${count}`}</small>}</td>;
}

/** Own-athlete readings supplied by the authorized profile route, never a peer lookup. */
export function ClassifiedPitchResults({ readings, pitches, context = "in_game", showChart = true }: { readings?: readonly Measurement[]; pitches?: readonly FallArsenalPitch[]; context?: "in_game" | "practice"; showChart?: boolean }) {
  const selected = (pitches ?? fallArsenalPitches(readings ?? [])).filter(pitch => (pitch.category === "Practice" ? "practice" : "in_game") === context);
  if (!selected.length) return null;
  return <section aria-label={`${context === "practice" ? "Practice" : "In-Game"} pitch arsenal`} className={styles.section}>
    <header className={styles.heading}><div><p>{context === "practice" ? "Practice" : "In-Game"} · Fall 2026</p><h2>Full Pitch Arsenal</h2></div><span>{selected.length} recorded pitch {selected.length === 1 ? "type" : "types"}</span></header>
    {(["Game", "Intrasquad", "Practice"] as const).map(category => {
      const group = selected.filter(pitch => pitch.category === category);
      if (!group.length) return null;
      return <div key={category} className={styles.sourceGroup}>
        <div className={styles.sourceHeading}><h3>Full Swing · {category}</h3><p>Every recorded pitch type · Averages and bests across saved Fall sessions</p></div>
        <div className={styles.tableWrap}><table><caption className="sr-only">All {category.toLowerCase()} pitch types with average and maximum velocity and spin</caption><thead><tr><th scope="col">Pitch Type</th><th scope="col">Avg Velocity <small>mph</small></th><th scope="col">Max Velocity <small>mph</small></th><th scope="col">Avg Spin <small>RPM</small></th><th scope="col">Max Spin <small>RPM</small></th></tr></thead><tbody>{group.map(pitch => <tr key={pitch.source}>
          <th scope="row"><strong>{pitchTypeLabel(pitch.pitchType)}</strong><small>{pitch.sessionCount} {pitch.sessionCount === 1 ? "session" : "sessions"}{pitch.count === null ? "" : ` · ${pitch.count} pitches`}</small><small>{dateRange(pitch.firstDate, pitch.lastDate)}</small></th>
          <Average pitch={pitch} family="velocity"/><Maximum pitch={pitch} family="velocity"/><Average pitch={pitch} family="spin"/><Maximum pitch={pitch} family="spin"/>
        </tr>)}</tbody></table></div>
        {showChart && <PitchArsenalChart pitches={group} scope="fall"/>}
        {showChart && <PitchSeparationChart pitches={group} category={category}/>}
      </div>;
    })}
    <p className={styles.note}>Fall averages use each session’s matching speed or spin reading count. If counts are incomplete, an available latest-session average is labeled separately. Maxima are the best saved Fall readings. Spin is descriptive; higher is not automatically better.</p>
  </section>;
}
