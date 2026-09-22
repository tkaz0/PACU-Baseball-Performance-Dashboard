import { HittingTeamAverageLine } from "@/components/hitting-team-average";
import { hittingTeamAverage, type HittingTeamAverage } from "@/lib/hitting-team-averages";
import { blastPeriodLabel, blastUnit, formatBlastValue } from "@/lib/blast-metrics";
import { blastFallSummary } from "@/lib/blast-fall";
import type { Measurement } from "@/lib/imports/engine";
import { StatInfo } from "@/components/stat-info";
import styles from "./blast-reports.module.css";
export function BlastPracticeReports({readings,compact=false,teamAverages=[]}:{readings:readonly Measurement[];compact?:boolean;teamAverages?:readonly HittingTeamAverage[]}) {
  const summary=blastFallSummary(readings);
  if(!summary)return null;
  const period=summary.firstDate&&summary.lastDate?blastPeriodLabel(summary.firstDate,summary.lastDate):null;
  return <section className="card mt-5" aria-label={compact?"Fall practice snapshot":"Cumulative Fall practice hitting"}>
    <div className={styles.reportHeader}><div><p className={styles.eyebrow}>Practice · Blast Motion</p><h3 className="text-lg font-bold">Fall 2026 · Cumulative</h3></div>{summary.totalSwings!==null&&<span className={styles.swingTotal}><strong>{summary.totalSwings.toLocaleString("en-US")}</strong> Swings</span>}</div>
    <p className={styles.count}>{summary.reportCount} {summary.reportCount===1?"Average Report":"Average Reports"}{period?` · ${period}`:""}</p>
    {!!summary.issues.length&&<p className="notice">Fall averages need staff review: {summary.issues.includes("overlapping_periods")?"report dates overlap.":"a report is duplicated or missing valid swing counts."} Existing report measurements are preserved.</p>}
    {!summary.reportCount&&<p className="muted text-sm">Add an average report to build Fall results.</p>}
    <div className={`${styles.hittingCards} ${compact?styles.compactCards:""}`}>
      {summary.metrics.map((m,index)=><article className={styles.hittingCard} key={m.key} aria-label={m.label}>
        <div className={styles.metricTop}><span className={styles.metricNumber} aria-hidden="true">{String(index+1).padStart(2,"0")}</span><span className={styles.metricContext}>Practice</span></div>
        <h4>{m.label} <StatInfo metric={m.key} label={m.label}/></h4>
        <p className={styles.primaryValue}><strong>{m.average===null?"—":formatBlastValue(m.average,m.unit)}</strong><span>{blastUnit(m.unit)}</span></p>
        <p className={styles.averageLabel}>Fall Average</p>
        <HittingTeamAverageLine average={hittingTeamAverage(teamAverages,m.key,m.unit,"blast_fall")}/>
        {m.missingReports>0&&<p className={styles.coverage}>Missing from {m.missingReports} {m.missingReports===1?"average report":"average reports"}</p>}
        {!compact&&<div className={styles.peakValue}><span>Latest Week<span>Peak · 95th</span></span><strong>{m.peak===null?"—":`${formatBlastValue(m.peak,m.unit)} ${blastUnit(m.unit)}`}</strong></div>}
      </article>)}
    </div>
    {!compact&&summary.peakPeriod&&<p className={styles.count}>Strong-swing report: {blastPeriodLabel(summary.peakPeriod.start,summary.peakPeriod.end)}. Weekly 95th-percentile results, not the fastest swings of the Fall.</p>}
    <p className={styles.count}>Fall averages are weighted by each report’s swing count. Each swing is counted once.</p>
  </section>;
}
