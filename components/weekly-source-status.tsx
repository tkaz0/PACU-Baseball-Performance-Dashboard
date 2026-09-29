import Link from "next/link";
import { ArrowRight, CircleCheck, CircleAlert, Clock3 } from "lucide-react";
import { WEEKLY_SOURCES, type WeeklySourceStatus } from "@/lib/weekly-source-contract";
import styles from "./weekly-source-status.module.css";

const date=(value:string)=>new Date(value).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"America/Los_Angeles"});
const label={completed:"Checked",needs_review:"Needs review",failed:"Check failed"};
export function WeeklySourceStatus({statuses}:{statuses:WeeklySourceStatus[]}) {
  return <section className={styles.panel} aria-label="Weekly data source status">
    <div className={styles.heading}><div><p>Monday Night · 9 p.m. Pacific</p><h2>Weekly Data Sources</h2></div><Link href="/imports/source-status">Check Details <ArrowRight size={14} aria-hidden="true"/></Link></div>
    <div className={styles.rows}>{WEEKLY_SOURCES.map(source=>{
      const status=statuses.find(item=>item.source===source.key);
      const Icon=status?.outcome==="completed"?CircleCheck:status?.outcome?CircleAlert:Clock3;
      return <div className={styles.row} key={source.key} data-outcome={status?.outcome??"not_recorded"}><div className={styles.name}><Icon size={16} aria-hidden="true"/><strong>{source.label}</strong></div><div className={styles.dates}><span>{status?.checkedAt?<><b>{label[status.outcome!]}</b> <time dateTime={status.checkedAt}>{date(status.checkedAt)}</time></>:"Check not recorded"}</span><span>{status?.savedAt?<><b>Saved</b> <time dateTime={status.savedAt}>{date(status.savedAt)}</time></>:"No saved results yet"}</span></div></div>;
    })}</div>
    <p className={styles.note}>Checked and saved are separate. A source can be checked without changing any player results.</p>
  </section>;
}
