"use client";
import { ChartDisclosure } from "@/components/chart-disclosure";
import previewStyles from "./chart-disclosure.module.css";
import { useId, useState } from "react";
import { StatInfo } from "@/components/stat-info";
import { pitchArsenalColor } from "@/components/pitch-arsenal-chart";
import { formatSpin } from "@/lib/measurement-display";
import type { PitchDevelopmentDay, PitchDevelopmentGroup } from "@/lib/pitch-development";
import styles from "./pitch-development.module.css";

const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"});
type Metric = "velocity" | "spin" | "avgEv" | "hardHit";
const definitions = {
  velocity: {label:"Average Velocity",unit:"mph",sample:"velocityCount"},
  spin: {label:"Average Spin",unit:"RPM",sample:"spinCount"},
  avgEv: {label:"Average EV Against",unit:"mph",sample:"balls"},
  hardHit: {label:"Hard Hit Against",unit:"%",sample:"balls"},
} as const;
const number = (value: number, metric: Metric) => metric === "spin" ? formatSpin(value) : value.toFixed(1);

function DailyChart({ days, metric, color }: { days: PitchDevelopmentDay[]; metric: Metric; color: string }) {
  const id=useId(), definition=definitions[metric];
  const [activeDate,setActiveDate]=useState("");
  const points=days.filter(d=>d[metric]!==null);
  if(!points.length) return <article className={styles.chart}><h4>{definition.label}</h4><p className={styles.empty}>{metric==="avgEv"||metric==="hardHit"?"No classified balls in play recorded for this pitch yet.":"Needs a recorded average and matching reading count."}</p></article>;
  const active=points.find(p=>p.date===activeDate)??points.at(-1)!;
  const values=points.map(p=>p[metric]!),min=Math.min(...values),max=Math.max(...values),pad=Math.max((max-min)*.2,metric==="spin"?50:1);
  const lo=metric==="hardHit"?0:Math.max(0,min-pad),hi=metric==="hardHit"?100:max+pad;
  const first=Date.parse(days[0].date),last=Date.parse(days.at(-1)!.date);
  const x=(date:string)=>44+(last===first?.5:(Date.parse(date)-first)/(last-first))*244;
  const y=(value:number)=>108-(value-lo)/(hi-lo)*72;
  const path=days.map((p,index)=>{const value=p[metric];if(value===null)return "";const command=index>0&&days[index-1][metric]!==null?"L":"M";return `${command}${x(p.date)},${y(value)}`;}).join(" ");
  const sample=active[definition.sample];
  return <article className={styles.chart}>
    <h4>{definition.label}</h4><p className={styles.value}>{number(active[metric]!,metric)} <small>{definition.unit}</small></p>
    <p className={styles.sample} aria-live="polite">{dateLabel(active.date)} · {sample} {definition.sample==="balls"?"balls in play":"readings"}</p>
    <svg viewBox="0 0 320 142" role="group" aria-labelledby={id} className={styles.plot}>
      <title id={id}>{definition.label} by date. Tab to each dot for its value and sample.</title>
      {[lo,(lo+hi)/2,hi].map(value=><g key={value}><line x1="44" x2="288" y1={y(value)} y2={y(value)} stroke="var(--line-subtle)" strokeDasharray="3 4"/><text x="38" y={y(value)+4} textAnchor="end" fontSize="12" fill="var(--text-secondary)">{metric==="spin"?Math.round(value):value.toFixed(metric==="hardHit"?0:1)}</text></g>)}
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round"/>
      {points.map(p=><circle key={p.date} cx={x(p.date)} cy={y(p[metric]!)} r={p.date===active.date?5.5:4} fill={color} stroke="var(--surface-panel)" strokeWidth="2" tabIndex={0} role="button"
        aria-label={`${dateLabel(p.date)}: ${number(p[metric]!,metric)} ${definition.unit}, ${p[definition.sample]} ${definition.sample==="balls"?"balls in play":"readings"}`}
        onMouseEnter={()=>setActiveDate(p.date)} onFocus={()=>setActiveDate(p.date)} onClick={()=>setActiveDate(p.date)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setActiveDate(p.date);}}}/>)}
      <text x={first===last?166:44} y="134" textAnchor={first===last?"middle":"start"} fontSize="12" fill="var(--text-secondary)">{dateLabel(days[0].date)}</text>
      {first!==last&&<text x="288" y="134" textAnchor="end" fontSize="12" fill="var(--text-secondary)">{dateLabel(days.at(-1)!.date)}</text>}
    </svg>
  </article>;
}

export function PitchDevelopment({ groups, context, contactsAvailable=true }: { groups: PitchDevelopmentGroup[]; context: "in_game" | "practice"; contactsAvailable?: boolean }) {
  const [selected,setSelected]=useState(groups[0]?.key??""),[contactMetric,setContactMetric]=useState<"avgEv"|"hardHit">("avgEv");
  if(!groups.length)return null;
  const group=groups.find(g=>g.key===selected)??groups[0],color=pitchArsenalColor(group.pitchType);
  const points=group.days.filter(day=>day.velocity!==null),latest=points.at(-1);
  const velocities=points.map(day=>day.velocity!),lo=Math.min(...velocities),hi=Math.max(...velocities),span=Math.max(hi-lo,2);
  const firstDate=Date.parse(group.days[0].date),lastDate=Date.parse(group.days.at(-1)!.date);
  return <ChartDisclosure title="Pitch Development" description={`${group.label} · ${group.category} · ${group.days.length} recorded dates`} preview={<>
    <div className={previewStyles.previewRow}><span>Latest daily average velocity</span><strong>{latest?`${latest.velocity!.toFixed(1)} mph`:"No complete velocity average"}</strong></div>
    {points.length>0&&<svg viewBox="0 0 320 100" className={previewStyles.plot} role="img" aria-label={`${group.label} daily average velocity, ${points.length} dates. Zoomed scale.`}><line x1="14" x2="306" y1="86" y2="86" stroke="var(--line-subtle)"/>{points.map((day,index)=>{const x=14+(lastDate===firstDate?.5:(Date.parse(day.date)-firstDate)/(lastDate-firstDate))*292,y=78-(day.velocity!-lo)/span*56;return <g key={day.date}>{index>0&&group.days.indexOf(day)===group.days.indexOf(points[index-1])+1&&<line x1={14+(lastDate===firstDate?.5:(Date.parse(points[index-1].date)-firstDate)/(lastDate-firstDate))*292} y1={78-(points[index-1].velocity!-lo)/span*56} x2={x} y2={y} stroke={color} strokeWidth="2.5"/>}<circle cx={x} cy={y} r="4" fill={color}/></g>;})}</svg>}
    <p className={previewStyles.caption}>{latest?`${dateLabel(latest.date)} · ${latest.velocityCount} readings · Zoomed scale · `:""}Explore velocity, spin{context==="in_game"&&contactsAvailable?" & contact allowed":""} by date.</p>
  </>}><section className={styles.panel} aria-label={`${context==="practice"?"Practice":"In-Game"} pitch development`} data-testid="pitch-development">
    <header className={styles.heading}><div><h2>Pitch Development<StatInfo metric="pitch_development" label="Pitch Development"/></h2><p>Fall 2026 · Daily averages · {group.category}</p></div>
      <div className={styles.controls}><label>Pitch<select aria-label="Pitch" value={group.key} onChange={e=>setSelected(e.target.value)}>{groups.map(g=><option key={g.key} value={g.key}>{g.label} ({g.category})</option>)}</select></label>
        {context==="in_game"&&contactsAvailable&&<label>Contact Against<select aria-label="Contact Against" value={contactMetric} onChange={e=>setContactMetric(e.target.value as "avgEv"|"hardHit")}><option value="avgEv">Average EV Against</option><option value="hardHit">Hard Hit Against (90+ mph)</option></select></label>}
      </div></header>
    <div className={styles.charts}><DailyChart key={`${group.key}:v`} days={group.days} metric="velocity" color={color}/><DailyChart key={`${group.key}:s`} days={group.days} metric="spin" color={color}/>
      {context==="in_game"&&contactsAvailable&&<DailyChart key={`${group.key}:${contactMetric}`} days={group.days} metric={contactMetric} color={color}/>}
    </div>
    {context==="in_game"&&!contactsAvailable&&<p role="status" className={styles.note}>Contact-against trends are temporarily unavailable. Velocity and spin remain available.</p>}
    <p className={styles.note}>{group.days.length===1?"One recorded date so far; more dates will show a trend. ":""}Same-day files are combined using each stat’s reading count. Game, intrasquad and practice stay separate. Spin is descriptive; higher is not always better.{context==="in_game"?" Contact uses staff-classified balls against this pitch, with likely fouls left out. These are date totals, not individual game lines.":" Practice contact-against data is not recorded in this view."}</p>
    <details className={styles.details}><summary>Daily Numbers</summary><div className={styles.scroll}><table><caption className="sr-only">{group.label} daily averages, {group.category}</caption><thead><tr><th>Date</th><th>Avg mph</th><th>Readings</th><th>Avg RPM</th><th>Readings</th>{context==="in_game"&&<><th>EV Against</th><th>Hard Hit</th><th>Balls in Play</th></>}</tr></thead><tbody>{group.days.map(d=><tr key={d.date}><th scope="row">{dateLabel(d.date)}</th><td>{d.velocity===null?"—":d.velocity.toFixed(1)}</td><td>{d.velocityCount??"—"}</td><td>{d.spin===null?"—":formatSpin(d.spin)}</td><td>{d.spinCount??"—"}</td>{context==="in_game"&&<><td>{d.avgEv===null?"—":`${d.avgEv.toFixed(1)} mph`}</td><td>{d.hardHit===null?"—":`${d.hardHit.toFixed(1)}%`}</td><td>{d.balls||"—"}</td></>}</tr>)}</tbody></table></div></details>
  </section></ChartDisclosure>;
}
