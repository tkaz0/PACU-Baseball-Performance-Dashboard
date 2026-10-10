import { contactPitchSplits, type PitchContact } from "@/lib/contact-pitch-splits";
import { pitchTypeLabel } from "@/lib/imports/pitch-assignments";
import { StatInfo } from "@/components/stat-info";
import styles from "./contact-pitch-splits.module.css";

export function ContactPitchSplits({ contacts, against = false }: { contacts: readonly PitchContact[]; against?: boolean }) {
  const splits = contactPitchSplits(contacts);
  if (!splits.length) return null;
  const classified = splits.filter(row=>row.pitchType).reduce((sum,row)=>sum+row.count,0);
  return <section className={styles.panel} aria-label={against ? "Contact allowed by pitch type" : "Contact by pitch type"} data-testid="contact-pitch-splits">
    <div className={styles.heading}><h3>{against ? "Contact Allowed by Pitch" : "Contact by Pitch Type"}<StatInfo metric="contact_by_pitch" label="Contact by Pitch Type"/></h3><span>{classified} of {contacts.length} balls classified</span></div>
    <p className={styles.note}>{against ? "Batted balls against each staff-classified pitch. Likely fouls are excluded." : "See which pitches you’re driving. Uses the same session and contact selection as the map."}</p>
    <p className={styles.swipe}>Swipe the table to see every stat →</p>
    <div className={styles.scroll}><table className={styles.table}><thead><tr><th>Pitch</th><th>Balls</th><th>Avg EV</th><th>Max EV</th><th>Hard Hit</th><th>Launch Window</th><th>Avg Launch</th><th>Squared Up</th></tr></thead><tbody>{splits.map(row=><tr key={`${row.category}:${row.pitchType}`}>
      <th scope="row"><strong>{row.pitchType ? pitchTypeLabel(row.pitchType) : "Unclassified"}</strong><small>{row.category === "game" ? "Game" : row.category === "intrasquad" ? "Intrasquad" : "Practice"}</small></th>
      <td>{row.count}<small>{row.count<10?"Early sample":"balls"}</small></td>
      <td>{row.avgEv.toFixed(1)}<small>mph</small></td><td>{row.maxEv.toFixed(1)}<small>mph</small></td>
      <td><strong>{row.quality.hardHitPct.toFixed(1)}%</strong><span className={styles.track} aria-hidden="true"><i style={{width:`${row.quality.hardHitPct}%`}}/></span><small>{row.quality.hardHit} of {row.count} · 90+ mph</small></td>
      <td>{row.quality.sweetSpotPct.toFixed(1)}%<small>{row.quality.sweetSpot} of {row.count} · 8–32°</small></td>
      <td>{row.avgLaunch.toFixed(1)}°</td><td>{row.squared.avgSquaredUp === null ? "—" : `${row.squared.avgSquaredUp.toFixed(1)}%`}<small>{row.squared.count} of {row.count} recorded</small></td>
    </tr>)}</tbody></table></div>
    <p className={styles.note}>Labels come from staff review of each exact pitch. Unclassified balls stay visible; small samples are an early look, not a pitch-strength grade.</p>
  </section>;
}
