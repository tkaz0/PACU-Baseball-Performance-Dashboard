import type { ArsenalComparison, ArsenalComparisonValue, ArsenalComparisonMetric } from "@/lib/player-comparison-arsenal";
import { leaderboardTestDate } from "@/lib/leaderboards";
import { StatInfo } from "@/components/stat-info";
import styles from "./coaching-tools.module.css";

function Result({ result, name, unit, maximum, side, leading, eligible, review }: { result: ArsenalComparisonValue | null; name: string; unit: "mph" | "rpm"; maximum: number; side: "a" | "b"; leading: boolean; eligible: boolean; review: boolean }) {
 return <div className={`${styles.arsenalValue} ${side === "a" ? styles.a : styles.b} ${leading ? styles.leading : ""}`} aria-label={name}>
  <strong>{result ? `${result.value.toFixed(1)} ${unit}` : "—"}</strong>
  {result ? <><div className={styles.arsenalBar} aria-hidden="true"><i style={{width:`${maximum > 0 ? 100 * result.value / maximum : 0}%`}}/></div><p className={styles.meta}>{result.basis}{leading && <span className={styles.arsenalHigher}> · Higher</span>}<br/>{leaderboardTestDate(result.firstDate)}{result.firstDate !== result.lastDate ? ` – ${leaderboardTestDate(result.lastDate)}` : ""}{(result.count !== null || result.basis !== "Fall best") && <><br/>{result.count === null ? "Reading count unavailable" : `${result.count.toLocaleString("en-US")} ${unit === "mph" ? "velocity" : "spin"} readings`}</>}</p></> : <p className={styles.meta}>{!eligible ? "Not applicable" : review ? "Needs review" : "Not recorded"}</p>}
 </div>;
}
function PitchRow({ metric, row, first, second }: {metric: ArsenalComparisonMetric; row: ArsenalComparison; first: string; second: string}) {
 const maximum = Math.max(metric.first?.value ?? 0, metric.second?.value ?? 0);
 return <div className={styles.arsenalRow}>
  <Result result={metric.first} name={first} unit={metric.unit} maximum={maximum} side="a" leading={metric.lead === "a"} eligible={row.eligibleA} review={row.reviewA}/>
  <div className={styles.compareLabel}><h4>{metric.label}<StatInfo metric={metric.key} label={`${row.pitchType} ${metric.label}`}/></h4><p className={styles.compareNote}>{metric.lead === "tie" ? "Equal result" : metric.note}</p></div>
  <Result result={metric.second} name={second} unit={metric.unit} maximum={maximum} side="b" leading={metric.lead === "b"} eligible={row.eligibleB} review={row.reviewB}/>
 </div>;
}
/** Full visible arsenals; exact Game/Intrasquad/Practice partitions never share a comparison row. */
export function PitchArsenalComparison({ comparisons, first, second }: {comparisons: ArsenalComparison[]; first: string; second: string}) {
 if (!comparisons.length) return null;
 const categories = ["Game","Intrasquad","Practice"] as const;
 return <section className={styles.arsenalComparison} aria-label="Pitch arsenal comparison">
  <header className={styles.arsenalHeading}><div><span className={styles.arsenalEyebrow}>THROWING / FULL SWING</span><h2>Pitch Arsenal</h2><p className={styles.meta}>Every classified pitch · Fall 2026</p></div><p className={styles.meta}>Fall averages use matching reading counts.<br/>Spin shows how the pitches differ, without a winner.</p></header>
  {categories.map(category=>{const rows=comparisons.filter(row=>row.category===category);return rows.length?<section className={styles.arsenalContext} key={category} aria-label={`${category} pitch comparison`}><h3>{category === "Practice" ? "Practice" : `In-Game · ${category}`}</h3><div className={styles.arsenalPlayerHead}><span className={styles.a}>{first}</span><span>Pitch / Result</span><span className={styles.b}>{second}</span></div>{rows.map(row=><section className={styles.arsenalPitch} key={row.key} aria-label={`${row.pitchType} · ${category}`}><header><strong>{row.pitchType}</strong><span>Full Swing · {category}</span></header>{row.metrics.map(metric=><PitchRow key={metric.key} metric={metric} row={row} first={first} second={second}/>)}</section>)}</section>:null;})}
 </section>;
}
