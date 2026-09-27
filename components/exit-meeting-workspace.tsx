"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Check, ChevronDown, Download, FileText, LoaderCircle, Search, Target, TrendingUp, Trophy, Users } from "lucide-react";
import type { StaffAthleteChoice } from "@/lib/staff-athlete-search";
import { matchesStaffAthlete } from "@/lib/staff-athlete-search";
import { EXIT_MEETING_NOTES_LIMIT, type ExitMeetingReport, type ExitMeetingRow } from "@/lib/exit-meeting";
import { percentileColor } from "@/lib/percentile-color";
import styles from "./exit-meeting.module.css";

function Metric({ row }: { row: ExitMeetingRow }) {
  return <div className={styles.metric} data-tone={row.tone}>
    <div><span className={styles.metricName}>{row.label}</span><strong className={styles.metricValue}>{row.value}</strong></div>
    <div className={styles.metricComparison}>{row.percentile !== null ? <><div className={styles.rank}><span>Team Percentile</span><strong>{Math.round(row.percentile)}</strong></div><div className={styles.percentileTrack}><i style={{ left: `${row.percentile}%`, ...percentileColor(row.percentile) }} /></div><small>{row.peers} teammates</small></> : <span className={styles.missingRank}>No team percentile</span>}</div>
    <p className={styles.metricMeta}>{row.source} · {row.date}<span>{row.basis}{row.sample ? ` · ${row.sample}` : ""}</span></p>
  </div>;
}
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date());
export function ExitMeetingWorkspace({ players, selectedId, report }: { players: StaffAthleteChoice[]; selectedId: string; report: ExitMeetingReport | null }) {
  const router = useRouter(), [navigating, startTransition] = useTransition();
  const [search, setSearch] = useState(""), [meetingDate, setMeetingDate] = useState(today), [talkingPoints, setTalkingPoints] = useState("");
  const [downloading, setDownloading] = useState(false), [status, setStatus] = useState(""), [downloaded, setDownloaded] = useState(false);
  const visible = players.filter(p => matchesStaffAthlete(p, search));
  async function download() {
    if (!selectedId || downloading) return;
    setDownloading(true); setStatus(""); setDownloaded(false);
    try {
      const response = await fetch("/exit-meetings/download", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({athleteId:selectedId,meetingDate,talkingPoints}) });
      if(!response.ok){const result=await response.json().catch(()=>null);throw new Error(typeof result?.error==="string"?result.error:"The report could not be downloaded. Please try again; if it still fails, sign in again.");}
      if(!response.headers.get("content-type")?.startsWith("application/pdf"))throw new Error("The PDF response could not be verified. Sign in again and retry.");
      const blob=await response.blob();
      if(await blob.slice(0,5).text()!=="%PDF-")throw new Error("The PDF download was interrupted. Please try again.");
      const url=URL.createObjectURL(blob), a=document.createElement("a");
      a.href=url;a.download=`PACU-Exit-Meeting-${report?.code??"Player"}-${meetingDate}.pdf`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);setDownloaded(true);
    } catch(error) { setStatus(error instanceof Error?error.message:"The report could not be generated. Please try again."); }
    finally { setDownloading(false); }
  }
  const metricCount=report?.sections.reduce((n,s)=>n+s.rows.length,0)??0;
  return <div className={styles.workspace}>
    <header className={styles.hero}><div><span className={styles.eyebrow}>COACHING TOOLS / PLAYER DEVELOPMENT</span><h1>Exit Meetings</h1><p>Turn a player’s Fall into a clear conversation.</p></div><div className={styles.heroIcon}><FileText size={48} strokeWidth={1.1}/><span>ONE PLAYER.<br/>THE COMPLETE PICTURE.</span></div></header>
    <div className={styles.layout}>
      <aside className={styles.setup} aria-label="Prepare an exit meeting"><div className={styles.step}><span>01</span><h2>Choose a Player</h2></div><label className={styles.search}><Search size={16}/><input aria-label="Search roster for exit meeting" placeholder="Search name or PAC ID" value={search} onChange={e=>setSearch(e.target.value)}/></label><label className={styles.selectLabel}>Player<select value={selectedId} disabled={navigating||downloading} onChange={e=>{setStatus("");setTalkingPoints("");setDownloaded(false);const id=e.target.value;startTransition(()=>router.push(id?`/exit-meetings?athlete=${encodeURIComponent(id)}`:"/exit-meetings"));}}><option value="">Select a player</option>{visible.map(p=><option key={p.id} value={p.id}>{p.name} · {p.athleteCode}</option>)}{selectedId&&!visible.some(p=>p.id===selectedId)&&players.filter(p=>p.id===selectedId).map(p=><option key={p.id} value={p.id}>{p.name} · {p.athleteCode}</option>)}</select></label>{search&&<small>{visible.length} matching players</small>}
        <div className={styles.divider}/><div className={styles.step}><span>02</span><h2>Prepare the Meeting</h2></div><label className={styles.selectLabel}><span><CalendarDays size={14}/> Meeting Date</span><input type="date" value={meetingDate} onChange={e=>setMeetingDate(e.target.value)} disabled={downloading}/></label><label className={styles.selectLabel}>Coach Talking Points<textarea rows={6} placeholder="What went well? What should we focus on next?" maxLength={EXIT_MEETING_NOTES_LIMIT} value={talkingPoints} disabled={downloading||navigating} onChange={e=>setTalkingPoints(e.target.value)}/></label><small>Optional · {talkingPoints.length}/{EXIT_MEETING_NOTES_LIMIT}<br/>Added to this PDF only. Notes are not saved.</small>
        <div className={styles.divider}/><button className={styles.download} disabled={!report||!meetingDate||downloading||navigating} onClick={download}>{downloading?<LoaderCircle className={styles.spin} size={18}/>:downloaded?<Check size={18}/>:<Download size={18}/>} {downloading?"Building Full Report…":"Download Meeting PDF"}</button><p className={styles.downloadHint}>Uses the latest saved results when generated. In-Game and Practice stay separate.</p>{status&&<p role="alert" className={styles.error}>{status}</p>}{downloaded&&<p role="status" className={styles.success}>PDF ready. Check your browser’s downloads.</p>}
      </aside>
      <section aria-label="Exit meeting preview" className={styles.preview} aria-busy={navigating}>{navigating?<div className={styles.empty}><LoaderCircle className={styles.spin} size={30}/><h2>Gathering the Player’s Results</h2><p>Checking every source and team comparison.</p></div>:!report?<div className={styles.empty}><div className={styles.emptyBadge}><Users size={34}/></div><h2>Start With a Player</h2><p>The report pulls together game results, testing, body composition, pitch types, Blast practice and movement screening.</p><div className={styles.previewFeatures}><span><Trophy size={16}/> Team percentiles</span><span><TrendingUp size={16}/> Strengths &amp; progress</span><span><FileText size={16}/> Print-ready PDF</span></div></div>:<>
        <header className={styles.playerHeader}><div><span className={styles.eyebrow}>{report.code} / {report.season}</span><h2>{report.name} <span>{report.jersey}</span></h2><p>{report.position} · {report.academicClass} · {report.batsThrows}</p></div><Link href={`/athletes/${selectedId}`} aria-label={`Open ${report.name}'s profile`}>Open Profile <ArrowUpRight size={15}/></Link></header>
        <div className={styles.facts}><div><strong>{metricCount}</strong><span>Recorded Results</span></div><div><strong>{report.sections.flatMap(s=>s.rows).filter(r=>r.percentile!==null).length}</strong><span>Team Comparisons</span></div><div><strong>{report.lastTested??"—"}</strong><span>Last Tested</span></div></div>
        <div className={styles.insights}>{[{title:"Strengths",icon:Trophy,items:report.strengths,empty:"More comparable results are needed to identify a top-quarter strength.",tone:"strong"},{title:"Development Areas",icon:Target,items:report.development,empty:"No recorded directional stats currently fall in the bottom team quarter.",tone:"focus"},{title:"Biggest Jumps",icon:TrendingUp,items:report.jumps,empty:"Another comparable testing date will help show progress.",tone:"progress"}].map(group=><section className={styles.insight} key={group.title} data-tone={group.tone}><h3><group.icon size={16}/>{group.title}</h3>{group.items.length?<ul>{group.items.map((item,i)=><li key={`${item.label}-${i}`}><div><strong>{item.label}</strong>{item.percentile!==null&&<span>{Math.round(item.percentile)}<small> PCTL</small></span>}</div><p>{item.detail}</p></li>)}</ul>:<p className={styles.insightEmpty}>{group.empty}</p>}</section>)}</div>
        <div className={styles.contents}><h3>In This Report</h3><div>{report.sections.map(section=><a href={`#exit-${section.id}`} key={section.id} onClick={()=>{const target=document.getElementById(`exit-${section.id}`);if(target instanceof HTMLDetailsElement)target.open=true;}}>{section.title}<span>{section.rows.length}</span></a>)}</div></div>
        {report.sections.map((section,index)=><details className={styles.section} key={section.id} id={`exit-${section.id}`} open={index<2}><summary><div><span>{section.title}</span><small>{section.subtitle}</small></div><div><b>{section.rows.length}</b><ChevronDown size={17}/></div></summary><div className={styles.sectionBody}>{section.rows.map((r,i)=><Metric key={`${r.label}-${i}`} row={r}/>)}{section.note&&<p className={styles.sectionNote}>{section.note}</p>}</div></details>)}
        {report.missing.length>0&&<section className={styles.pending}><h3>Still to Add</h3><p>{report.missing.join(" · ")}</p></section>}
        <details className={styles.guide}><summary>How Percentiles and Highlights Work</summary>{report.notes.map(note=><p key={note}>{note}</p>)}</details>
      </>}</section>
    </div>
  </div>;
}
