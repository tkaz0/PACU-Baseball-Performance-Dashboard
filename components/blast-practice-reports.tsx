import { BLAST_REPORT_METRICS, blastMetricFor, blastPeriodLabel, blastPracticeReports, blastUnit, formatBlastValue } from "@/lib/blast-metrics";
import type { Measurement } from "@/lib/imports/engine";
import { StatInfo } from "@/components/stat-info";
import styles from "./blast-reports.module.css";
export function BlastPracticeReports({readings}:{readings:readonly Measurement[]}) {
  const reports=blastPracticeReports(readings).slice(0,1);
  if(!reports.length)return null;
  return <section className="card mt-5"><div className={styles.reportHeader}><div><p className={styles.eyebrow}>Practice · Blast Motion</p><h3>Weekly Swing Report</h3></div></div><p className="muted text-sm">Average and Peak (95th Percentile) · Peak is not a maximum.</p>
    {reports.map((report,i)=>{
      const duplicate=[report.average,report.p95].some(rows=>new Set(rows.map(r=>r.file_hash)).size>1);
      const counts=[report.average,report.p95].map(rows=>rows.find(r=>r.metric==="Blast Swing Count")?.value);
      const content=<><p className={styles.count}>{counts[0]===counts[1]&&counts[0]!==undefined?`${counts[0]} Swings`:`Average: ${counts[0]??"—"} Swings · Peak: ${counts[1]??"—"} Swings`}</p>{duplicate?<p className="notice">More than one export was saved for this reporting period. Staff should review the reports before comparing these values.</p>:<div className={styles.tableWrap}><table><thead><tr><th>Measurement</th><th>Average</th><th>Peak · 95th</th></tr></thead><tbody>{BLAST_REPORT_METRICS.filter(m=>m.column!==2).map(metric=>{
        const values=(["average","p95"] as const).map(kind=>report[kind].find(r=>r.metric===blastMetricFor(metric.column,kind).label));
        if(values.every(v=>!v))return null;
        return <tr key={metric.key}><th scope="row">{metric.column===3?"Bat Speed":metric.label} <StatInfo metric={metric.key} label={metric.column===3?"Bat Speed":metric.label}/></th>{values.map((row,index)=><td key={index}>{row?`${formatBlastValue(row.value,row.unit)} ${blastUnit(row.unit)}`:"—"}</td>)}</tr>;
      })}</tbody></table></div>}</>;
      return i===0?<div key={`${report.start}:${report.end}`} className="mt-4"><h4>{blastPeriodLabel(report.start,report.end)}</h4>{content}</div>:<details className="mt-3" key={`${report.start}:${report.end}`}><summary>{blastPeriodLabel(report.start,report.end)}</summary>{content}</details>;
    })}
  </section>;
}
