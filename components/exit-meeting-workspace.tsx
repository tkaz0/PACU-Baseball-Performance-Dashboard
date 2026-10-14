"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, FileText, LoaderCircle, Printer, Save, History, Search, TrendingUp, Trophy, Users } from "lucide-react";
import type { StaffAthleteChoice } from "@/lib/staff-athlete-search";
import { matchesStaffAthlete } from "@/lib/staff-athlete-search";
import { EXIT_MEETING_NOTES_LIMIT, type ExitMeetingReport } from "@/lib/exit-meeting";
import { ExitMeetingHandout } from "@/components/exit-meeting-handout";
import { HandoutFit } from "@/components/exit-meeting-handout-fit";
import { parseSaveExitMeetingCommand, type SavedExitMeeting, type ExitMeetingHistory, type SaveExitMeetingCommand } from "@/lib/exit-meeting-history";
import { UUID_PATTERN } from "@/lib/types";
import styles from "./exit-meeting.module.css";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date());
export function ExitMeetingWorkspace({ players, selectedId, report, saved = null, history = {items:[],hasMore:false}, headshot = null }: { players: StaffAthleteChoice[]; selectedId: string; report: ExitMeetingReport | null; saved?: SavedExitMeeting | null; history?: ExitMeetingHistory; headshot?: string | null }) {
  const router = useRouter(), [navigating, startTransition] = useTransition();
  const [search, setSearch] = useState(""), [meetingDate, setMeetingDate] = useState(saved?.meetingDate ?? today), [talkingPoints, setTalkingPoints] = useState(saved?.talkingPoints ?? "");
  const [saving,setSaving]=useState(false),[reviewed,setReviewed]=useState(false),[attempt,setAttempt]=useState<SaveExitMeetingCommand|null>(null),[saveError,setSaveError]=useState("");
  const locked=!!saved||!!attempt||saving;
  const visible = players.filter(p => matchesStaffAthlete(p, search));
  async function saveMeeting(){
    if(!report||saved||saving||!reviewed)return;
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
  return <div className={styles.workspace}>
    <header className={styles.hero}><div><span className={styles.eyebrow}>COACHING / PLAYER DEVELOPMENT</span><h1>Exit Meetings</h1><p>A front-and-back handout of the player&apos;s Fall: ranks, strengths, game stats, Pitch+ and testing.</p></div><div className={styles.heroIcon}><FileText size={48} strokeWidth={1.1}/><span>ONE PLAYER.<br/>A CLEAR PLAN.</span></div></header>
    <div className={styles.layout}>
      <aside className={styles.setup} aria-label="Prepare an exit meeting"><div className={styles.step}><span>01</span><h2>Choose a Player</h2></div><label className={styles.search}><Search size={16}/><input aria-label="Search roster for exit meeting" placeholder="Search name or PAC ID" value={search} onChange={e=>setSearch(e.target.value)}/></label><label className={styles.selectLabel}>Player<select value={selectedId} disabled={navigating||saving||!!attempt} onChange={e=>{setTalkingPoints("");const id=e.target.value;startTransition(()=>router.push(id?`/exit-meetings?athlete=${encodeURIComponent(id)}`:"/exit-meetings"));}}><option value="">Select a player</option>{visible.map(p=><option key={p.id} value={p.id}>{p.name} · {p.athleteCode}</option>)}{selectedId&&!visible.some(p=>p.id===selectedId)&&players.filter(p=>p.id===selectedId).map(p=><option key={p.id} value={p.id}>{p.name} · {p.athleteCode}</option>)}</select></label>{search&&<small>{visible.length} matching players</small>}
        <div className={styles.divider}/><div className={styles.step}><span>02</span><h2>Prepare the Meeting</h2></div><label className={styles.selectLabel}><span><CalendarDays size={14}/> Meeting Date</span><input type="date" value={meetingDate} onChange={e=>{setMeetingDate(e.target.value);setReviewed(false);}} disabled={locked}/></label><label className={styles.selectLabel}>Coach Talking Points<textarea rows={6} placeholder="What went well? What should we focus on next?" maxLength={EXIT_MEETING_NOTES_LIMIT} value={talkingPoints} disabled={navigating||locked} onChange={e=>{setTalkingPoints(e.target.value);setReviewed(false);}}/></label><small>Optional · {talkingPoints.length}/{EXIT_MEETING_NOTES_LIMIT}<br/>{saved?"Saved with this meeting. Read-only.":"Printed on the back of the sheet. Stored only when you save a snapshot."}</small>
        <div className={styles.divider}/><button className={styles.download} disabled={!report||!meetingDate||navigating||saving} onClick={()=>window.print()}><Printer size={18}/> Print Handout</button><p className={styles.downloadHint}>{saved?"Prints the exact numbers and notes captured in this saved meeting.":"Uses the latest saved results. In the print window choose “Save as PDF” to keep a file, or print double-sided (flip on the long edge)."}</p>
        {report&&!saved&&<div className={styles.historySave}><h3><Save size={15}/> Save Meeting Snapshot</h3><p>Keep the latest saved results, meeting date, and these talking points in staff history.</p><><label className={styles.saveReview}><input type="checkbox" checked={reviewed} disabled={saving||!!attempt} onChange={event=>setReviewed(event.target.checked)}/><span>Save a permanent snapshot for coaches and admins.</span></label><button type="button" className={styles.saveButton} disabled={!reviewed||!meetingDate||saving||navigating} onClick={saveMeeting}>{saving?<LoaderCircle className={styles.spin} size={16}/>:<Save size={16}/>} {saving?"Saving…":attempt?"Retry Same Save":"Save Snapshot"}</button>{attempt&&saveError&&<small>The meeting options are locked so this retry cannot create a different snapshot.</small>}</>{saveError&&<p role="alert" className={styles.error}>{saveError}</p>}</div>}
        {selectedId&&<section className={styles.historyList} aria-label="Saved meeting history"><h3><History size={15}/> Saved Meetings</h3><Link prefetch={false} className={styles.currentMeeting} href={`/exit-meetings?athlete=${encodeURIComponent(selectedId)}`}>Current Results</Link>{history.items.length?<ul>{history.items.map(item=><li key={item.id}><Link prefetch={false} aria-current={saved?.id===item.id?"page":undefined} href={`/exit-meetings?athlete=${encodeURIComponent(selectedId)}&meeting=${item.id}`}><strong>{item.meetingDate}</strong><span>{item.metricCount} results{item.hasNotes?" · Talking points":""}</span><small>Saved {new Date(item.createdAt).toLocaleDateString("en-US",{timeZone:"America/Los_Angeles",month:"short",day:"numeric",year:"numeric"})}</small></Link></li>)}</ul>:<p>No saved meetings yet.</p>}{history.hasMore&&<small>Showing the 50 most recently saved meetings.</small>}</section>}
      </aside>
      <section aria-label="Exit meeting handout" className={styles.preview} aria-busy={navigating}>{navigating?<div className={styles.empty}><LoaderCircle className={styles.spin} size={30}/><h2>Gathering the Player’s Results</h2><p>Checking every source and team comparison.</p></div>:!report?<div className={styles.empty}><div className={styles.emptyBadge}><Users size={34}/></div><h2>Start With a Player</h2><p>Build a front-and-back handout: photo and headline numbers, where they rank on the team, strengths and focus areas, game stats with week-by-week trends, Pitch+ and arsenal, testing, and space for your talking points and winter goals.</p><div className={styles.previewFeatures}><span><Trophy size={16}/> Team percentiles</span><span><TrendingUp size={16}/> Week-by-week trends</span><span><FileText size={16}/> Prints front &amp; back</span></div></div>:<>
        {saved&&<div className={styles.savedBanner}><History size={18}/><div><strong>Saved Meeting · {saved.meetingDate}</strong><span>Snapshot captured {new Date(saved.generatedAt).toLocaleDateString("en-US",{timeZone:"America/Los_Angeles",month:"short",day:"numeric",year:"numeric"})}. These results and notes do not change when new data arrives.</span></div></div>}
        <header className={styles.playerHeader}><div><span className={styles.eyebrow}>{report.code} / {report.season}</span><h2>{report.name} <span>{report.jersey}</span></h2><p>{report.position} · {report.academicClass} · {report.batsThrows}</p></div><Link href={`/athletes/${selectedId}`} aria-label={`Open ${report.name}'s profile`}>Open Profile <ArrowUpRight size={15}/></Link></header>
        <HandoutFit><ExitMeetingHandout report={report} meetingDate={meetingDate} talkingPoints={talkingPoints} headshot={headshot}/></HandoutFit>
      </>}</section>
    </div>
  </div>;
}
