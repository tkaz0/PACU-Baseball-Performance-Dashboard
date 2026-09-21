import { useId } from "react";
import styles from "./movement-screening.module.css";
import { MOVEMENT_LABELS, isMovementRom, movementTone, type MovementReading, type MovementReport } from "@/lib/movement-screening";
const tones = { green: styles.green, yellow: styles.yellow, red: styles.red, none: styles.neutral };
const toneLabels = { green:"Good", yellow:"Middle", red:"Watch", none:"" };
function Reading({ reading }: { reading: MovementReading }) {
  const tone=movementTone(reading), numeric=reading.value!==null && Number.isFinite(Number(reading.value));
  return <span className={`${styles.reading} ${tones[tone]}`}>
    <span>{reading.value===null ? "—" : <>{reading.value}{isMovementRom(reading.row) ? "°" : numeric ? <span className={styles.unit}> / 5</span> : null}</>}</span>
    {reading.value!==null&&tone!=="none" && <span className={styles.status}>{toneLabels[tone]}</span>}
  </span>;
}
type Pair = [string,number,number];
const shoulder: Pair[] = [["Internal Rotation",4,6],["External Rotation",5,7]];
const hip: Pair[] = [["External Rotation",8,10],["Internal Rotation",9,11],["Flexion",12,14],["Extension",13,15]];
const ankle: Pair[] = [["Flexion",16,18],["Extension",17,19]];
function PairedReadings({ report, pairs, caption }: { report:MovementReport; pairs:Pair[]; caption:string }) {
  return <table className={styles.table}><caption className="sr-only">{caption}</caption><thead><tr><th scope="col">Movement</th><th scope="col">Right</th><th scope="col">Left</th></tr></thead><tbody>{pairs.map(([name,right,left])=><tr key={name}><th scope="row">{name}</th><td><Reading reading={report.readings[right-2]}/></td><td><Reading reading={report.readings[left-2]}/></td></tr>)}</tbody></table>;
}
export function MovementScreening({ report, showReferences=false }: { report?: MovementReport|null; showReferences?:boolean }) {
  const headingId=useId();
  if(!report)return null;
  const checks=report.readings.filter(r=>!isMovementRom(r.row)&&!(r.row>=16&&r.row<=19)&&r.value!==null);
  const date=new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(`${report.screenedOn}T12:00:00Z`));
  return <section className={styles.screening} aria-labelledby={headingId} data-testid="movement-screening">
    <div className={styles.heading}><div><p className="eyebrow mb-1">Capstone</p><h2 id={headingId}>Movement Screening</h2><p className="muted mb-0 mt-1 text-xs">Last Screened: <time dateTime={report.screenedOn}>{date}</time></p></div><div className={styles.legend} aria-label="Screening colors"><span className={styles.green}>Good</span><span className={styles.yellow}>Middle</span><span className={styles.red}>Watch</span></div></div>
    <div className={styles.columns}><div className={styles.column}>
      <section className={styles.panel}><div className={styles.panelHeading}><h3>Movement Checks</h3><span>1–5 · 5 is best</span></div><ul className={styles.checks}>{checks.map(r=><li key={r.row}><span>{MOVEMENT_LABELS[r.row-2]}</span><Reading reading={r}/></li>)}</ul>{!checks.length&&<p className="muted text-sm">No movement ratings recorded.</p>}</section>
      <section className={styles.panel} data-testid="ankle-ratings"><div className={styles.panelHeading}><h3>Ankle Ratings</h3><span>1–5 · 5 is best</span></div><PairedReadings report={report} pairs={ankle} caption="Right and left ankle ratings out of 5"/></section>
    </div><section className={styles.panel} data-testid="movement-rom"><div className={styles.panelHeading}><h3>Range of Motion</h3><span>Degrees</span></div><h4 className={styles.joint}>Shoulders</h4><PairedReadings report={report} pairs={shoulder} caption="Right and left shoulder range of motion in degrees"/><h4 className={styles.joint}>Hips</h4><PairedReadings report={report} pairs={hip} caption="Right and left hip range of motion in degrees"/></section></div>
    <p className="muted m-0 text-xs leading-5">Source flags take priority. Unflagged ratings: 1–2 Watch, 3 Middle, 4–5 Good. Unflagged mobility readings stay neutral.</p>
    {showReferences&&<details className="rounded-lg border border-[var(--line-subtle)] p-4 text-sm"><summary className="cursor-pointer font-semibold">Assessor’s Reference Values</summary><dl className="grid gap-3 pt-3 sm:grid-cols-2">{report.readings.filter(r=>r.reference).map(r=><div key={r.row}><dt className="muted text-xs">{MOVEMENT_LABELS[r.row-2]}</dt><dd className="m-0 mt-1">{r.reference}</dd></div>)}</dl></details>}
  </section>;
}
