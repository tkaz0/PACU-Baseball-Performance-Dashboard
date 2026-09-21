import { blastPeriodLabel, blastUnit, formatBlastValue } from "@/lib/blast-metrics";
import { blastFallSummary } from "@/lib/blast-fall";
import type { Measurement } from "@/lib/imports/engine";
import { StatInfo } from "@/components/stat-info";
import styles from "./blast-reports.module.css";
export function BlastPracticeReports({readings,compact=false}:{readings:readonly Measurement[];compact?:boolean}) {
  const summary=blastFallSummary(readings);
  if(!summary)return null;
  const period=summary.firstDate&&summary.lastDate?blastPeriodLabel(summary.firstDate,summary.lastDate):null;
  return <section className="card mt-5" aria-label={compact?"Fall practice snapshot":"Cumulative Fall practice hitting"}>
    <div className={styles.reportHeader}><div><p className={styles.eyebrow}>Practice · Blast Motion</p><h3 className="text-lg font-bold">Fall 2026 · Cumulative</h3></div>{summary.totalSwings!==null&&<span className={styles.swingTotal}><strong>{summary.totalSwings.toLocaleString("en-US")}</strong> Swings</span>}</div>
    <p className={styles.count}>{summary.reportCount} {summary.reportCount===1?"Average Report":"Average Reports"}{period?` · ${period}`:""}</p>
    {!!summary.issues.length&&<p className="notice">Fall averages need staff review: {summary.issues.includes("overlapping_periods")?"report dates overlap.":"a report is duplicated or missing valid swing counts."} Existing report measurements are preserved.</p>}
    {!summary.reportCount&&<p className="muted text-sm">Add an average report to build Fall results.</p>}
    {compact?<div className={styles.mainMetrics}>{summary.metrics.map(m=><div key={m.key}><h4>{m.label} <StatInfo metric={m.key} label={m.label}/></h4><p>{m.average!==null?<><strong>{formatBlastValue(m.average,m.unit)}</strong> <span>{blastUnit(m.unit)}</span></>:<span>—</span>}</p><span className={styles.count}>{m.missingReports?"Incomplete report coverage":"Fall Average"}</span></div>)}</div>:<>
      <div className={styles.tableWrap}><table><thead><tr><th>Measurement</th><th>Fall Average</th><th>Latest Week<br/>Peak · 95th</th></tr></thead><tbody>{summary.metrics.map(m=><tr key={m.key}><th scope="row">{m.label} <StatInfo metric={m.key} label={m.label}/>{m.missingReports>0&&<span className={styles.coverage}>Missing from {m.missingReports} {m.missingReports===1?"average report":"average reports"}</span>}</th><td>{m.average===null?"—":`${formatBlastValue(m.average,m.unit)} ${blastUnit(m.unit)}`}</td><td>{m.peak===null?"—":`${formatBlastValue(m.peak,m.unit)} ${blastUnit(m.unit)}`}</td></tr>)}</tbody></table></div>
      {summary.peakPeriod&&<p className={styles.count}>Peak report: {blastPeriodLabel(summary.peakPeriod.start,summary.peakPeriod.end)}. These are weekly 95th percentiles, not cumulative peaks or maximums.</p>}
    </>}
    <p className={styles.count}>Fall averages are weighted by each report’s swing count. Each swing is counted once.</p>
  </section>;
}
