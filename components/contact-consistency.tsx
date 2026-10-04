import { contactConsistency, type ContactDistribution } from "@/lib/contact-consistency";
import type { ContactReading } from "@/lib/contact-quality";
import styles from "./contact-consistency.module.css";
const number=(v:number)=>v.toFixed(1);
function Distribution({data,title,unit}:{data:ContactDistribution;title:string;unit:string}) {
  return <section className={styles.chart} aria-label={`${title} distribution`}>
    <header><h3>{title}</h3><span>{data.count} recorded {data.count===1?"ball":"balls"}</span></header>
    <dl className={styles.numbers}><div><dt>Average</dt><dd>{number(data.mean)} <small>{unit}</small></dd></div><div><dt>Middle 80%</dt><dd>{number(data.p10)}–{number(data.p90)} <small>{unit}</small></dd></div></dl>
    <div className={styles.bars} role="list" aria-label={`${title} bands, percent of recorded contacts`}>
      {data.bins.map(bin=><div role="listitem" key={bin.label} className={styles.row} aria-label={`${bin.label}${unit==="mph"?" mph":""}: ${bin.count} of ${data.count}, ${number(bin.share)} percent`}><span>{bin.label}{unit==="mph"?" mph":""}</span><div className={styles.track} aria-hidden="true"><i style={{width:`${bin.share}%`}}/></div><strong>{number(bin.share)}%</strong><small>{bin.count}</small></div>)}
    </div><p className={styles.range}>Full range {number(data.min)}–{number(data.max)} {unit}</p>
  </section>;
}
export function ContactConsistency({contacts}:{contacts:readonly ContactReading[]}) {
  const data=contactConsistency(contacts);
  if(!data.exitVelocity||!data.launchAngle)return <p role="status" className="muted mt-4 text-sm">No paired exit-speed and launch-angle readings in this selection.</p>;
  return <section className={styles.consistency} aria-label="Contact consistency">
    <div className={styles.heading}><h2>Contact Consistency</h2><details><summary aria-label="About contact consistency">i</summary><p>Bars show the share of recorded contacts in each band. Middle 80% runs from the 10th to the 90th percentile, interpolated between readings. A tighter range describes less variation; it does not automatically mean better contact. These are tracked batted balls, not confirmed hits. The session selector applies to both charts.</p></details></div>
    <div className={styles.grid}><Distribution data={data.exitVelocity} title="Exit Velocity" unit="mph"/><Distribution data={data.launchAngle} title="Launch Angle" unit="°"/></div>
    {data.exitVelocity.count<10&&<p className={styles.note}>Early look · {data.exitVelocity.count} recorded {data.exitVelocity.count===1?"ball":"balls"}. More contacts will make the shape clearer.</p>}
  </section>;
}
