import styles from "./movement-screening.module.css";
import { MOVEMENT_LABELS, isMovementRom, movementTone, type MovementReading, type MovementReport } from "@/lib/movement-screening";
const tones = { green: styles.green, yellow: styles.yellow, red: styles.red, none: styles.neutral };
const toneLabels = { green:"Good", yellow:"Middle", red:"Watch", none:"" };
function Reading({ reading }: { reading: MovementReading }) {
  const tone=movementTone(reading), numeric=reading.value!==null && Number.isFinite(Number(reading.value));
  return <span className={`inline-flex flex-wrap items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-bold tabular-nums ${tones[tone]}`}>
    {reading.value===null ? "—" : <>{reading.value}{isMovementRom(reading.row) ? "°" : numeric ? <span className="text-xs font-normal">/ 5</span> : null}{tone!=="none" && <span className="text-[10px] font-semibold uppercase tracking-wide">{toneLabels[tone]}</span>}</>}
  </span>;
}
const pairs: [string,number,number][] = [["Shoulder Internal Rotation",4,6],["Shoulder External Rotation",5,7],["Hip External Rotation",8,10],["Hip Internal Rotation",9,11],["Hip Flexion",12,14],["Hip Extension",13,15],["Ankle Flexion",16,18],["Ankle Extension",17,19]];
export function MovementScreening({ report, showReferences=false }: { report?: MovementReport|null; showReferences?:boolean }) {
  if(!report)return null;
  const checks=report.readings.filter(r=>!isMovementRom(r.row)&&r.value!==null);
  const date=new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(`${report.screenedOn}T12:00:00Z`));
  return <section className="space-y-4" aria-labelledby="movement-heading" data-testid="movement-screening">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow mb-1">Capstone</p><h2 id="movement-heading" className="m-0 text-xl font-bold">Movement Screening</h2><p className="muted mb-0 mt-1 text-xs">Last Screened: <time dateTime={report.screenedOn}>{date}</time></p></div><p className="muted m-0 text-xs">1–5 rating · 5 is best</p></div>
    <div className="grid gap-4 xl:grid-cols-2"><div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-4"><h3 className="mb-3 mt-0 text-sm font-bold">Movement Checks</h3><ul className="m-0 list-none divide-y divide-[var(--line-subtle)] p-0">{checks.map(r=><li key={r.row} className="flex items-center justify-between gap-3 py-2"><span className="text-sm">{MOVEMENT_LABELS[r.row-2]}</span><Reading reading={r}/></li>)}</ul>{!checks.length&&<p className="muted text-sm">No movement ratings recorded.</p>}</div>
    <div className="min-w-0 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-4"><h3 className="mb-3 mt-0 text-sm font-bold">Range of Motion <span className="muted font-normal">· Degrees</span></h3><table className={`w-full text-sm ${styles.table}`}><caption className="sr-only">Right and left range of motion</caption><thead><tr><th scope="col">Movement</th><th scope="col">Right</th><th scope="col">Left</th></tr></thead><tbody>{pairs.map(([name,right,left])=><tr key={name}><th scope="row" className="text-left font-medium">{name}</th><td><Reading reading={report.readings[right-2]}/></td><td><Reading reading={report.readings[left-2]}/></td></tr>)}</tbody></table></div></div>
    <p className="muted m-0 text-xs leading-5">Green: Good · Yellow: Middle · Red: Watch. Source flags take priority; unflagged ratings use 1–2 Watch, 3 Middle, 4–5 Good. Unflagged range-of-motion readings stay neutral.</p>
    {showReferences&&<details className="rounded-lg border border-[var(--line-subtle)] p-4 text-sm"><summary className="cursor-pointer font-semibold">Assessor’s Reference Values</summary><dl className="grid gap-3 pt-3 sm:grid-cols-2">{report.readings.filter(r=>r.reference).map(r=><div key={r.row}><dt className="muted text-xs">{MOVEMENT_LABELS[r.row-2]}</dt><dd className="m-0 mt-1">{r.reference}</dd></div>)}</dl></details>}
  </section>;
}
