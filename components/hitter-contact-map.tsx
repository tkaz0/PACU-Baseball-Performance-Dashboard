"use client";
import { ContactConsistency } from "@/components/contact-consistency";
import { useState } from "react";
import { Video } from "lucide-react";
import { SwingVideoPanel, type SwingVideoActions } from "@/components/swing-video-panel";
import { swingContactKey, type SwingVideo } from "@/lib/swing-videos";
import type { SavedContact } from "@/lib/full-swing-contacts-server";
import { contactQuality } from "@/lib/contact-quality";
import { HitterSprayMap } from "@/components/hitter-spray-map";
import { BattedBallProfile } from "@/components/batted-ball-profile";
import { StatInfo } from "@/components/stat-info";
import { fullSwingFileLabel } from "@/lib/full-swing-file-label";
import { isLikelyFoul } from "@/lib/likely-foul";

const fmt = (n: number) => n.toFixed(1);
const shortDate = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
function bounds(values: number[], step: number, floor: number, includeZero = false): [number, number] {
  const low = values.length?Math.min(...values, ...(includeZero ? [0] : [])):floor, high = values.length?Math.max(...values, ...(includeZero ? [0] : [])):floor+step;
  const from = Math.max(floor, Math.floor((low - step) / step) * step);
  const to = Math.ceil((high + step) / step) * step;
  return [from, to > from ? to : from + step];
}
function color(speed: number) {
  const fraction = Math.max(0, Math.min(1, (speed - 50) / 70));
  return `hsl(${Math.round(211 - fraction * 207)} 67% ${Math.round(44 + fraction * 2)}%)`;
}

/** The only points are reviewed, row-paired Full Swing batted-ball observations. */
export function HitterContactMap({ contacts, context, bats, athleteId, videos = [], canAttachVideo = false, videoActions, videosAvailable = true }: { contacts: readonly SavedContact[]; context: "in_game" | "practice"; bats?: string | null; athleteId?: string; videos?: readonly SwingVideo[]; canAttachVideo?: boolean; videoActions?:SwingVideoActions; videosAvailable?:boolean }) {
  const eligible = contacts.filter(row => (row.category === "practice" ? "practice" : "in_game") === context);
  const sessions = [...new Map(eligible.map(row => [row.fileHash, { hash: row.fileHash, date: row.playedOn, name: row.sourceFile, category: row.category }])).values()]
    .sort((a,b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  const sessionNumber = new Map(sessions.map((session, index) => [session.hash, sessions.filter(item => item.date === session.date).length > 1 ? sessions.slice(0,index + 1).filter(item => item.date === session.date).length : null]));
  const [selected, setSelected] = useState("all");
  const [chart,setChart] = useState<"contact"|"spray"|"consistency">("contact");
  const [ballsInPlay,setBallsInPlay]=useState(true);
  const [selectedSwing,setSelectedSwing] = useState<string | null>(null);
  const [uploadLocked,setUploadLocked] = useState(false);
  const selectSwing=(key:string|null)=>{if(!uploadLocked)setSelectedSwing(key);};
  if (!sessions.length) return null;
  const selectedContacts = selected === "all" ? eligible : eligible.filter(row => row.fileHash === selected);
  const foulCount=selectedContacts.filter(isLikelyFoul).length;
  const plotted=ballsInPlay?selectedContacts.filter(row=>!isLikelyFoul(row)):selectedContacts;
  const selectedContact=selectedContacts.find(row=>swingContactKey(row.fileHash,row.sourceRow)===selectedSwing);
  const videoKeys=new Set(videos.map(row=>swingContactKey(row.fileHash,row.sourceRow)));
  const quality=contactQuality(plotted,{includeLikelyFouls:!ballsInPlay});
  const [minX,maxX] = bounds(plotted.map(row => row.exitVelocity),10,0);
  const [minY,maxY] = bounds(plotted.map(row => row.launchAngle),10,-90,true);
  const x = (n:number) => 66 + (n-minX)/(maxX-minX)*564;
  const y = (n:number) => 266 - (n-minY)/(maxY-minY)*216;
  const ticks = [0,.25,.5,.75,1];
  return <section className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-4 sm:p-5" aria-label={`${context === "practice" ? "Practice" : "In-game"} hitter contact map`}>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="m-0 text-xl font-bold">Hitter Contact Map<StatInfo metric="hitter_contact_map" label="Hitter Contact Map"/></h2><p className="muted mb-0 mt-1 text-sm">Exit speed and launch angle · {plotted.length} recorded {plotted.length === 1 ? "ball" : "balls"}</p></div>
      <label className="text-sm font-semibold">Session<select aria-label="Contact map session" value={selected} disabled={uploadLocked} onChange={event => {if(!uploadLocked){setSelected(event.target.value);setSelectedSwing(null);}}}><option value="all">All Fall {context === "practice" ? "practice" : "games & intrasquads"}</option>{sessions.map(session => <option key={session.hash} value={session.hash}>{fullSwingFileLabel(session.name,`Full Swing · ${session.category === "practice" ? "Practice" : session.category === "game" ? "Game" : "Intrasquad"}`,session.date)}{sessionNumber.get(session.hash) ? ` · Session ${sessionNumber.get(session.hash)}` : ""}</option>)}</select></label></div>
    <div role="group" aria-label="Contact selection" className="mt-4 flex flex-wrap items-center gap-2">{([true,false] as const).map(value=><button type="button" key={String(value)} aria-pressed={ballsInPlay===value} disabled={uploadLocked} onClick={()=>{if(!uploadLocked)setBallsInPlay(value);}} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${ballsInPlay===value?"border-[var(--accent-readable)] bg-[var(--accent-readable)] text-white":"border-[var(--line-subtle)]"}`}>{value?"Balls in Play":"All Contact"}</button>)}<span className="muted text-xs">{foulCount} likely foul {foulCount===1?"ball":"balls"}{ballsInPlay?" excluded":" shown"}</span></div>
    <p className="muted mb-0 mt-2 text-xs">Likely Foul: below 70 mph and Direction beyond ±45°. This is a review rule, not a confirmed game outcome. Missing direction stays unclassified.</p>
    {!plotted.length&&<p role="status" className="muted mt-3 text-sm">No contacts remain in this selection. Choose All Contact to review the saved readings.</p>}
    <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Contact quality summary">
      <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3"><p className="m-0 text-xs font-semibold text-[var(--text-secondary)]">Recorded Contact</p><strong className="mt-1 block text-2xl tabular-nums">{quality.count}</strong><p className="muted m-0 text-xs">With exit speed and angle</p></div>
      <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3"><p className="m-0 text-xs font-semibold text-[var(--text-secondary)]">Hard Hit</p><strong className="mt-1 block text-2xl tabular-nums">{quality.hardHitPct.toFixed(1)}%</strong><p className="muted m-0 text-xs">90+ mph · {quality.hardHit} of {quality.count}</p></div>
      <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3"><p className="m-0 text-xs font-semibold text-[var(--text-secondary)]">Balls in Launch Window</p><strong className="mt-1 block text-2xl tabular-nums">{quality.sweetSpotPct.toFixed(1)}%</strong><p className="muted m-0 text-xs">8–32° · {quality.sweetSpot} of {quality.count}</p></div>
      <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3"><p className="m-0 text-xs font-semibold text-[var(--text-secondary)]">Hard Hit + Launch Window</p><strong className="mt-1 block text-2xl tabular-nums">{quality.bothPct.toFixed(1)}%</strong><p className="muted m-0 text-xs">90+ mph and 8–32° · {quality.both} of {quality.count}</p></div>
    </div>
    {quality.count<10&&<p className="muted mb-0 mt-2 text-xs">Early look: these percentages use just {quality.count} recorded {quality.count===1?"ball":"balls"}.</p>}
    <BattedBallProfile contacts={plotted} bats={bats}/>
    <div className="mt-4 flex flex-wrap items-center gap-2"><div className="flex flex-wrap gap-2" role="group" aria-label="Batted-ball chart"><button type="button" onClick={()=>setChart("contact")} aria-pressed={chart==="contact"} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${chart==="contact"?"border-[var(--accent-readable)] bg-[var(--accent-readable)] text-white":"border-[var(--line-subtle)]"}`}>Exit Speed / Angle</button><button type="button" onClick={()=>setChart("spray")} aria-pressed={chart==="spray"} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${chart==="spray"?"border-[var(--accent-readable)] bg-[var(--accent-readable)] text-white":"border-[var(--line-subtle)]"}`}>Spray Chart</button><button type="button" onClick={()=>setChart("consistency")} aria-pressed={chart==="consistency"} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${chart==="consistency"?"border-[var(--accent-readable)] bg-[var(--accent-readable)] text-white":"border-[var(--line-subtle)]"}`}>Consistency</button></div>{chart!=="consistency"&&<StatInfo metric={chart==="contact"?"ev_launch_chart":"spray_chart"} label={chart==="contact"?"Exit Speed / Angle chart":"Spray Chart"}/>}</div>
    {chart==="consistency"?<ContactConsistency contacts={plotted} includeLikelyFouls={!ballsInPlay}/>:chart==="spray"?<HitterSprayMap contacts={plotted} bats={bats} onSelect={athleteId&&!uploadLocked ? row=>selectSwing(swingContactKey(row.fileHash,row.sourceRow)) : undefined} videoKeys={videoKeys} selectedKey={selectedSwing}/>:<><div className="mt-4 overflow-x-auto"><svg viewBox="0 0 700 328" role="img" aria-label={`Scatter plot of ${plotted.length} batted ${plotted.length === 1 ? "ball" : "balls"} with exit velocity in miles per hour on the horizontal axis and launch angle in degrees on the vertical axis`} className="min-w-[540px] w-full">
      {ticks.map(fraction => { const ev=minX+(maxX-minX)*fraction, angle=minY+(maxY-minY)*fraction;
        return <g key={fraction}><line x1={x(ev)} x2={x(ev)} y1="50" y2="266" stroke="var(--line-subtle)"/><text x={x(ev)} y="284" textAnchor="middle" fill="var(--text-secondary)" fontSize="11">{Math.round(ev)}</text><line x1="66" x2="630" y1={y(angle)} y2={y(angle)} stroke="var(--line-subtle)"/><text x="57" y={y(angle)+4} textAnchor="end" fill="var(--text-secondary)" fontSize="11">{Math.round(angle)}°</text></g>; })}
      <line x1="66" x2="630" y1="266" y2="266" stroke="var(--text-secondary)"/>
      <line x1="66" x2="66" y1="50" y2="266" stroke="var(--text-secondary)"/>
      <text x="348" y="316" textAnchor="middle" fill="var(--text-secondary)" fontSize="13">Exit velocity (mph)</text>
      <text transform="translate(16 158) rotate(-90)" textAnchor="middle" fill="var(--text-secondary)" fontSize="13">Launch angle (°)</text>
      {plotted.map(row => {const key=swingContactKey(row.fileHash,row.sourceRow),hasVideo=videoKeys.has(key),label=`${shortDate(row.playedOn)} · Pitch ${row.pitchNumber}: ${fmt(row.exitVelocity)} mph, ${fmt(row.launchAngle)}°${hasVideo ? " · Video attached" : ""}`;return <g key={key} role={athleteId?"button":undefined} tabIndex={athleteId&&!uploadLocked?0:undefined} aria-disabled={athleteId?uploadLocked:undefined} aria-label={athleteId?`Open swing: ${label}`:undefined} onClick={()=>athleteId&&selectSwing(key)} onKeyDown={event=>{if(athleteId&&!uploadLocked&&(event.key==="Enter"||event.key===" ")){event.preventDefault();selectSwing(key);}}} className={athleteId?"cursor-pointer outline-offset-4":undefined}><circle cx={x(row.exitVelocity)} cy={y(row.launchAngle)} r="12" fill="transparent"/><circle cx={x(row.exitVelocity)} cy={y(row.launchAngle)} r={key===selectedSwing?8:5.5} fill={color(row.exitVelocity)} fillOpacity=".83" stroke={hasVideo?"var(--text-primary)":"var(--surface-panel)"} strokeWidth={hasVideo?2.5:1}><title>{label}</title></circle></g>;})}
    </svg></div>
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]"><span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#3979b7]"/>Lower exit speed</span><span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#bb2634]"/>Higher exit speed</span><span>Color compares exit speed within a fixed 50–120 mph display scale.</span></div></>}
    {uploadLocked&&<p role="status" className="muted mb-0 mt-3 text-xs">Finish or cancel the current upload before choosing another swing.</p>}
    {athleteId&&!videosAvailable&&<p role="status" className="muted mb-0 mt-3 text-sm">Swing videos are temporarily unavailable. Refresh to try again.</p>}
    {athleteId&&videosAvailable&&<p className="muted mb-0 mt-3 flex items-center gap-2 text-xs"><Video size={14}/>{chart==="consistency"?"Select a swing below":"Select a dot or a swing below"} to watch a clip{canAttachVideo?" or attach a video":""}.{chart!=="consistency"&&" Outlined dots have video."}</p>}
    {athleteId&&videosAvailable&&videoActions&&selectedContact&&<SwingVideoPanel key={selectedSwing} actions={videoActions} athleteId={athleteId} contact={selectedContact} staff={canAttachVideo} videos={videos.filter(video=>swingContactKey(video.fileHash,video.sourceRow)===selectedSwing)} onClose={()=>selectSwing(null)} onUploadLockChange={setUploadLocked}/>}
    <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-[var(--accent-readable)]">See Every Batted Ball</summary><div className="table-wrap mt-3 max-h-72"><table><thead><tr><th>Date</th><th>Session</th><th>Pitch #</th><th>Exit Velocity</th><th>Launch Angle</th><th>Direction</th><th>Distance</th><th>Review</th>{athleteId&&<th>Video</th>}</tr></thead><tbody>{selectedContacts.map(row => <tr key={`${row.fileHash}:${row.sourceRow}`}><td>{shortDate(row.playedOn)}</td><td>{fullSwingFileLabel(row.sourceFile,`Full Swing · ${row.category === "practice" ? "Practice" : row.category === "game" ? "Game" : "Intrasquad"}`,row.playedOn)}{sessionNumber.get(row.fileHash) ? ` · Session ${sessionNumber.get(row.fileHash)}` : ""}</td><td>{row.pitchNumber}</td><td>{fmt(row.exitVelocity)} mph</td><td>{fmt(row.launchAngle)}°</td><td>{row.direction===null?"—":`${fmt(row.direction)}°`}</td><td>{row.distance===null?"—":`${fmt(row.distance)} ft`}</td><td>{isLikelyFoul(row)?<span className="whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-1 text-xs font-semibold text-[var(--text-primary)]">Likely Foul</span>:"—"}</td>{athleteId&&<td><button type="button" className="text-link whitespace-nowrap disabled:opacity-50" disabled={uploadLocked} onClick={()=>selectSwing(swingContactKey(row.fileHash,row.sourceRow))}>{videoKeys.has(swingContactKey(row.fileHash,row.sourceRow))?"Watch Video":canAttachVideo?"Attach Video":"View Swing"}</button></td>}</tr>)}</tbody></table></div></details>
    <p className="muted mb-0 mt-3 text-xs">{chart==="consistency"?"Bars group recorded contacts by exit speed and launch angle.":"Each dot is one recorded batted ball."} Percentages use the selected contact view and session. Balls in Play excludes only the Likely Foul rule; unflagged or missing-direction contact is not a confirmed fair ball. Pacific uses 90+ mph for hard hit and 8–32° for the launch window. Balls without both readings are left out. Full Swing does not tell us whether a ball became a hit.</p>
  </section>;
}
