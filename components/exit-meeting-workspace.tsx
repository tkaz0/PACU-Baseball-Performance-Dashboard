"use client";

import { pitchSourceLabel } from "@/lib/pitch-display";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Check, ChevronDown, Download, FileText, LoaderCircle, Save, History, Search, Target, TrendingUp, Trophy, Users } from "lucide-react";
import type { StaffAthleteChoice } from "@/lib/staff-athlete-search";
import { matchesStaffAthlete } from "@/lib/staff-athlete-search";
import { EXIT_MEETING_NOTES_LIMIT, type ExitMeetingReport, type ExitMeetingRow, type ExitMeetingFormat } from "@/lib/exit-meeting";
import { percentileColor } from "@/lib/percentile-color";
import { parseSaveExitMeetingCommand, type SavedExitMeeting, type ExitMeetingHistory, type SaveExitMeetingCommand } from "@/lib/exit-meeting-history";
import { UUID_PATTERN } from "@/lib/types";
import styles from "./exit-meeting.module.css";

function Metric({ row }: { row: ExitMeetingRow }) {
  return <div className={styles.metric} data-tone={row.tone}>
    <div><span className={styles.metricName}>{row.label}</span><strong className={styles.metricValue}>{row.value}</strong></div>
    <div className={styles.metricComparison}>{row.percentile !== null ? <><div className={styles.rank}><span>Team Percentile</span><strong>{Math.round(row.percentile)}</strong></div><div className={styles.percentileTrack}><i style={{ left: `${row.percentile}%`, ...percentileColor(row.percentile) }} /></div><small>{row.peers} teammates</small></> : <span className={styles.missingRank}>No team percentile</span>}</div>
    <p className={styles.metricMeta}>{pitchSourceLabel(row.source)} · {row.date}<span>{row.basis}{row.sample ? ` · ${row.sample}` : ""}</span></p>
  </div>;
}
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date());
export function ExitMeetingWorkspace({ players, selectedId, report, format = "meeting", saved = null, history = {items:[],hasMore:false} }: { players: StaffAthleteChoice[]; selectedId: string; report: ExitMeetingReport | null; format?: ExitMeetingFormat; saved?: SavedExitMeeting | null; history?: ExitMeetingHistory }) {
  const router = useRouter(), [navigating, startTransition] = useTransition();
  const [search, setSearch] = useState(""), [meetingDate, setMeetingDate] = useState(saved?.meetingDate ?? today), [talkingPoints, setTalkingPoints] = useState(saved?.talkingPoints ?? "");
  const [downloading, setDownloading] = useState(false), [status, setStatus] = useState(""), [downloaded, setDownloaded] = useState(false);
  const [saving,setSaving]=useState(false),[reviewed,setReviewed]=useState(false),[attempt,setAttempt]=useState<SaveExitMeetingCommand|null>(null),[saveError,setSaveError]=useState("");
  const locked=!!saved||!!attempt||saving;
  const visible = players.filter(p => matchesStaffAthlete(p, search));
  async function download() {
    if (!selectedId || downloading) return;
    setDownloading(true); setStatus(""); setDownloaded(false);
    try {
      const response = await fetch(saved?"/exit-meetings/history/download":"/exit-meetings/download", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(saved?{athleteId:selectedId,snapshotId:saved.id}:{athleteId:selectedId,meetingDate,talkingPoints,format}) });
      if(!response.ok){const result=await response.json().catch(()=>null);throw new Error(typeof result?.error==="string"?result.error:"The report could not be downloaded. Please try again; if it still fails, sign in again.");}
      if(!response.headers.get("content-type")?.startsWith("application/pdf"))throw new Error("The PDF response could not be verified. Sign in again and retry.");
      const blob=await response.blob();
      if(await blob.slice(0,5).text()!=="%PDF-")throw new Error("The PDF download was interrupted. Please try again.");
      const url=URL.createObjectURL(blob), a=document.createElement("a");
      a.href=url;a.download=`PACU-${saved ? "Saved-Meeting" : format === "meeting" ? "Exit-Meeting" : "Detailed-Report"}-${report?.code??"Player"}-${meetingDate}.pdf`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);setDownloaded(true);
    } catch(error) { setStatus(error instanceof Error?error.message:"The report could not be generated. Please try again."); }
    finally { setDownloading(false); }
  }
  async function saveMeeting(){
    if(!report||saved||format!=="meeting"||saving||!reviewed)return;
    setSaving(true);setSaveError("");
    try{
      const command=attempt??parseSaveExitMeetingCommand({athleteId:selectedId,requestId:crypto.randomUUID(),meetingDate,talkingPoints,reviewed:true});
      setAttempt(command);
      const response=await fetch("/exit-meetings/history",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(command)});
      const receipt=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(typeof receipt?.error==="string"?receipt.error:"The save was not confirmed. Retry this same save after reconnecting.");
      if(!receipt||!UUID_PATTERN.test(String(receipt.id))||receipt.athleteId!==selectedId||receipt.meetingDate!==command.meetingDate)throw new Error("The save receipt could not be verified. Retry this same save.");
      startTransition(()=>router.push(`/exit-meetings?athlete=${encodeURIComponent(selectedId)}&meeting=${encodeURIComponent(receipt.id)}`));
    }catch(error){setSaveError(error instanceof Error?error.message:"The save was not confirmed. Retry this same save.");}
    finally{setSaving(false);}
  }
  const metricCount=report?.sections.reduce((n,s)=>n+s.rows.length,0)??0;
  return <div className={styles.workspace}>
    <header className={styles.hero}><div><span className={styles.eyebrow}>COACHING TOOLS / PLAYER DEVELOPMENT</span><h1>Exit Meetings</h1><p>Turn a player’s Fall into a clear conversation.</p></div><div className={styles.heroIcon}><FileText size={48} strokeWidth={1.1}/><span>ONE PLAYER.<br/>A CLEAR PLAN.</span></div></header>
    <div className={styles.layout}>
      <aside className={styles.setup} aria-label="Prepare an exit meeting"><div className={styles.step}><span>01</span><h2>Choose a Player</h2></div><label className={styles.search}><Search size={16}/><input aria-label="Search roster for exit meeting" placeholder="Search name or PAC ID" value={search} onChange={e=>setSearch(e.target.value)}/></label><label className={styles.selectLabel}>Player<select value={selectedId} disabled={navigating||downloading||saving||!!attempt} onChange={e=>{setStatus("");setTalkingPoints("");setDownloaded(false);const id=e.target.value;startTransition(()=>router.push(id?`/exit-meetings?athlete=${encodeURIComponent(id)}&format=${format}`:"/exit-meetings"));}}><option value="">Select a player</option>{visible.map(p=><option key={p.id} value={p.id}>{p.name} · {p.athleteCode}</option>)}{selectedId&&!visible.some(p=>p.id===selectedId)&&players.filter(p=>p.id===selectedId).map(p=><option key={p.id} value={p.id}>{p.name} · {p.athleteCode}</option>)}</select></label>{search&&<small>{visible.length} matching players</small>}
        <div className={styles.divider}/><div className={styles.step}><span>02</span><h2>Prepare the Meeting</h2></div><label className={styles.selectLabel}>Report Format<select value={format} disabled={navigating||downloading||locked} onChange={e=>{const next=e.target.value;setStatus("");setDownloaded(false);startTransition(()=>router.push(`/exit-meetings?format=${next}${selectedId?`&athlete=${encodeURIComponent(selectedId)}`:""}`));}}><option value="meeting">Meeting Summary</option><option value="detailed">Detailed Report</option></select></label><small>{format === "meeting" ? "Key results and coaching priorities. Usually 2–4 pages." : "All report details, weekly exports, and supporting counts."}</small><label className={styles.selectLabel}><span><CalendarDays size={14}/> Meeting Date</span><input type="date" value={meetingDate} onChange={e=>{setMeetingDate(e.target.value);setReviewed(false);}} disabled={downloading||locked}/></label><label className={styles.selectLabel}>Coach Talking Points<textarea rows={6} placeholder="What went well? What should we focus on next?" maxLength={EXIT_MEETING_NOTES_LIMIT} value={talkingPoints} disabled={downloading||navigating||locked} onChange={e=>{setTalkingPoints(e.target.value);setReviewed(false);}}/></label><small>Optional · {talkingPoints.length}/{EXIT_MEETING_NOTES_LIMIT}<br/>{saved?"Saved with this meeting. Read-only.":"Included in the PDF. Stored only when you save a snapshot."}</small>
        <div className={styles.divider}/><button className={styles.download} disabled={!report||!meetingDate||downloading||navigating||saving} onClick={download}>{downloading?<LoaderCircle className={styles.spin} size={18}/>:downloaded?<Check size={18}/>:<Download size={18}/>} {downloading?"Building Report…":saved?"Download Saved PDF":format === "meeting" ? "Download Meeting PDF" : "Download Detailed PDF"}</button><p className={styles.downloadHint}>{saved?"Uses the exact numbers and notes captured in this saved meeting.":"Uses the latest saved results when generated. In-Game and Practice stay separate."}</p>{status&&<p role="alert" className={styles.error}>{status}</p>}{downloaded&&<p role="status" className={styles.success}>PDF ready. Check your browser’s downloads.</p>}
        {report&&!saved&&<div className={styles.historySave}><h3><Save size={15}/> Save Meeting Snapshot</h3><p>Keep the latest saved results, meeting date, and these talking points in staff history.</p>{format==="meeting"?<><label className={styles.saveReview}><input type="checkbox" checked={reviewed} disabled={saving||!!attempt} onChange={event=>setReviewed(event.target.checked)}/><span>Save a permanent snapshot for coaches and admins.</span></label><button type="button" className={styles.saveButton} disabled={!reviewed||!meetingDate||saving||downloading||navigating} onClick={saveMeeting}>{saving?<LoaderCircle className={styles.spin} size={16}/>:<Save size={16}/>} {saving?"Saving…":attempt?"Retry Same Save":"Save Snapshot"}</button>{attempt&&saveError&&<small>The meeting options are locked so this retry cannot create a different snapshot.</small>}</>:<small>Choose Meeting Summary to save a snapshot. Detailed PDFs remain available to download.</small>}{saveError&&<p role="alert" className={styles.error}>{saveError}</p>}</div>}
        {selectedId&&<section className={styles.historyList} aria-label="Saved meeting history"><h3><History size={15}/> Saved Meetings</h3><Link prefetch={false} className={styles.currentMeeting} href={`/exit-meetings?athlete=${encodeURIComponent(selectedId)}`}>Current Results</Link>{history.items.length?<ul>{history.items.map(item=><li key={item.id}><Link prefetch={false} aria-current={saved?.id===item.id?"page":undefined} href={`/exit-meetings?athlete=${encodeURIComponent(selectedId)}&meeting=${item.id}`}><strong>{item.meetingDate}</strong><span>{item.metricCount} results{item.hasNotes?" · Talking points":""}</span><small>Saved {new Date(item.createdAt).toLocaleDateString("en-US",{timeZone:"America/Los_Angeles",month:"short",day:"numeric",year:"numeric"})}</small></Link></li>)}</ul>:<p>No saved meetings yet.</p>}{history.hasMore&&<small>Showing the 50 most recently saved meetings.</small>}</section>}
      </aside>
      <section aria-label="Exit meeting preview" className={styles.preview} aria-busy={navigating}>{navigating?<div className={styles.empty}><LoaderCircle className={styles.spin} size={30}/><h2>Gathering the Player’s Results</h2><p>Checking every source and team comparison.</p></div>:!report?<div className={styles.empty}><div className={styles.emptyBadge}><Users size={34}/></div><h2>Start With a Player</h2><p>The meeting summary focuses on key results, team comparisons and the next conversation. Choose Detailed Report only when you need every measurement.</p><div className={styles.previewFeatures}><span><Trophy size={16}/> Team percentiles</span><span><TrendingUp size={16}/> Strengths &amp; progress</span><span><FileText size={16}/> Print-ready PDF</span></div></div>:<>
        {saved&&<div className={styles.savedBanner}><History size={18}/><div><strong>Saved Meeting · {saved.meetingDate}</strong><span>Snapshot captured {new Date(saved.generatedAt).toLocaleDateString("en-US",{timeZone:"America/Los_Angeles",month:"short",day:"numeric",year:"numeric"})}. These results and notes do not change when new data arrives.</span></div></div>}
        <header className={styles.playerHeader}><div><span className={styles.eyebrow}>{report.code} / {report.season}</span><h2>{report.name} <span>{report.jersey}</span></h2><p>{report.position} · {report.academicClass} · {report.batsThrows}</p></div><Link href={`/athletes/${selectedId}`} aria-label={`Open ${report.name}'s profile`}>Open Profile <ArrowUpRight size={15}/></Link></header>
        <div className={styles.facts}><div><strong>{metricCount}</strong><span>{format === "meeting" ? "Key Results" : "Results"}</span></div><div><strong>{report.sections.flatMap(s=>s.rows).filter(r=>r.percentile!==null).length}</strong><span>Team Comparisons</span></div><div><strong>{report.lastTested??"—"}</strong><span>Last Tested</span></div></div>
        <div className={styles.insights}>{[{title:"Strengths",icon:Trophy,items:report.strengths,empty:"More comparable results are needed to identify a top-quarter strength.",tone:"strong"},{title:"Development Areas",icon:Target,items:report.development,empty:"No recorded directional stats currently fall in the bottom team quarter.",tone:"focus"},{title:"Biggest Jumps",icon:TrendingUp,items:report.jumps,empty:"Another comparable testing date will help show progress.",tone:"progress"}].map(group=><section className={styles.insight} key={group.title} data-tone={group.tone}><h3><group.icon size={16}/>{group.title}</h3>{group.items.length?<ul>{group.items.map((item,i)=><li key={`${item.label}-${i}`}><div><strong>{item.label}</strong>{item.percentile!==null&&<span>{Math.round(item.percentile)}<small> PCTL</small></span>}</div><p>{item.detail}</p></li>)}</ul>:<p className={styles.insightEmpty}>{group.empty}</p>}</section>)}</div>
        <div className={styles.contents}><h3>In This Report</h3><div>{report.sections.map(section=><a href={`#exit-${section.id}`} key={section.id} onClick={()=>{const target=document.getElementById(`exit-${section.id}`);if(target instanceof HTMLDetailsElement)target.open=true;}}>{section.title}<span>{section.rows.length}</span></a>)}</div></div>
        {report.sections.map((section,index)=><details className={styles.section} key={section.id} id={`exit-${section.id}`} open={format === "meeting" || index<2}><summary><div><span>{section.title}</span><small>{section.subtitle}</small></div><div><b>{section.rows.length}</b><ChevronDown size={17}/></div></summary><div className={`${styles.sectionBody} ${format === "meeting" ? styles.compactBody : ""}`}>{section.rows.map((r,i)=><Metric key={`${r.label}-${i}`} row={r}/>)}{section.note&&<p className={styles.sectionNote}>{section.note}</p>}</div></details>)}
        {report.missing.length>0&&<section className={styles.pending}><h3>Still to Add</h3><p>{report.missing.join(" · ")}</p></section>}
        <details className={styles.guide}><summary>How Percentiles and Highlights Work</summary>{report.notes.map(note=><p key={note}>{note}</p>)}</details>
      </>}</section>
    </div>
  </div>;
}
