"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ComparisonPlayerPicker } from "@/components/comparison-player-picker";
import { CoachingTabs } from "@/components/team-progress";
import { compareTests, compareGames, coachingValue, comparisonLead, type CoachingData, type CoachingCategory } from "@/lib/coaching-tools";
import { PLAYER_METRICS } from "@/lib/player-performance";
import { pitchingPeriodLabel } from "@/lib/game-source";
import { leaderboardTestDate } from "@/lib/leaderboards";
import { GameOpportunity } from "@/components/game-opportunity";
import { StatInfo } from "@/components/stat-info";
import styles from "./coaching-tools.module.css";
function ComparisonRow({label,metric,context,a,b,first,second,lead,note}:{label:string;metric:string;context:string;a:ReactNode;b:ReactNode;first:string;second:string;lead:"a"|"b"|"tie"|null;note:string}){
 return <section className={styles.compareRow} aria-label={label}>
  <div className={`${styles.compareValue} ${lead==="a"?styles.leading:""}`} aria-label={first}>{a}{lead==="a"&&<span className={styles.leadBadge}>Leading</span>}</div>
  <div className={styles.compareLabel}><h3>{label}<StatInfo metric={metric} label={label}/></h3><p className={styles.meta}>{context}</p><p className={styles.compareNote}>{lead==="tie"?"Equal result":note}</p></div>
  <div className={`${styles.compareValue} ${lead==="b"?styles.leading:""}`} aria-label={second}>{b}{lead==="b"&&<span className={styles.leadBadge}>Leading</span>}</div>
 </section>;
}
export function PlayerComparison({data,today}:{data:CoachingData;today:string}){
 const [a,setA]=useState(data.players[0]?.id??""),[b,setB]=useState(data.players[1]?.id??""),[category,setCategory]=useState("Physicality"),[maxGap,setMaxGap]=useState(30),[event,setEvent]=useState("");
 const first=data.players.find(p=>p.id===a),second=data.players.find(p=>p.id===b),selected=first&&second&&first.id!==second.id;
 const tests=selected&&category!=="Game Stats"?compareTests(data,first.id,second.id,category as CoachingCategory,today,maxGap):[];
 const games=selected&&category==="Game Stats"?compareGames(data,first.id,second.id,event):[];
 const events=[...new Map(data.games.filter(r=>r.eventId&&(r.athleteId===first?.id||r.athleteId===second?.id)).map(r=>[r.eventId,r.playedOn])).entries()].sort((a,b)=>(b[1]??b[0]).localeCompare(a[1]??a[0]));
 return <div className={styles.tools}>
  <div className={styles.players}>{[{value:a,set:setA,player:first,side:"A"},{value:b,set:setB,player:second,side:"B"}].map(({value,set,player,side})=><section className={`${styles.player} ${side==="B"?styles.playerB:""}`} key={side}><ComparisonPlayerPicker players={data.players} value={value} onChange={id=>{set(id);setEvent("");}} label={`Player ${side}`}/>{player&&<><Link prefetch={false} href={`/athletes/${player.id}`} className={styles.name}>{player.name} ↗</Link><p className={styles.meta}>{[player.code,player.position,player.academicClass].filter(Boolean).join(" · ")}</p></>}</section>)}</div>
  <CoachingTabs games value={category} onChange={setCategory}/>
  {selected?<><div className={styles.toolbar}>{category==="Game Stats"?<label className={`${styles.field} ${styles.metricField}`}>Shared Period<select aria-label="Game comparison period" value={event} onChange={e=>setEvent(e.target.value)}><option value="">QPA · Fall 2026 totals</option>{events.map(([id,date])=><option key={id} value={id}>Pitching · {pitchingPeriodLabel(id,date)}</option>)}</select></label>:<label className={styles.field}>Maximum Test Date Gap<select value={maxGap} onChange={e=>setMaxGap(Number(e.target.value))}>{[7,14,30,60].map(n=><option value={n} key={n}>{n} days</option>)}</select></label>}<p className={styles.meta}>Leading results are highlighted. Body measurements remain descriptive.</p></div>
  <div className={styles.comparisonList}><div className={styles.compareHead}><span>{first.name}</span><span>Metric</span><span>{second.name}</span></div>
   {tests.map(row=>{const direction=PLAYER_METRICS.find(m=>m.key===row.metric)?.direction??"neutral";return <ComparisonRow key={row.key} label={row.label} metric={row.metric} context={row.source} first={first.name} second={second.name} lead={comparisonLead(row.first?.value,row.second?.value,direction,row.comparable)} note={!row.comparable?(row.gap!==null?`Tests ${row.gap} days apart`:"Awaiting comparable results"):direction==="neutral"?"Measured values":direction==="higher"?"Higher leads":"Lower leads"} a={<><strong>{row.first?coachingValue(row.first.value,row.metric,row.unit):"—"}</strong><p className={styles.meta}>{row.first?leaderboardTestDate(row.first.date):!row.eligibleA?"Not applicable":row.reviewA?"Needs review":"Not yet tested"}</p></>} b={<><strong>{row.second?coachingValue(row.second.value,row.metric,row.unit):"—"}</strong><p className={styles.meta}>{row.second?leaderboardTestDate(row.second.date):!row.eligibleB?"Not applicable":row.reviewB?"Needs review":"Not yet tested"}</p></>}/>;})}
   {games.map(row=>{const direction=row.first?.direction??row.second?.direction??"neutral";const render=(r:typeof row.first)=><><strong>{r?coachingValue(r.value,r.metric,r.unit):"—"}</strong>{r?<><GameOpportunity source={r.source} metric={r.metric} count={r.opportunities}/><p className={styles.meta}>Updated {leaderboardTestDate(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(r.updatedAt)))}</p></>:<p className={styles.meta}>No verified result</p>}</>;return <ComparisonRow key={row.metric} label={row.label} metric={row.metric} context={event?pitchingPeriodLabel(event,row.first?.playedOn??row.second?.playedOn??null):"QPA · Fall totals"} first={first.name} second={second.name} lead={comparisonLead(row.first?.value,row.second?.value,direction,row.comparable)} note={!row.comparable?"Same snapshot and period required":direction==="neutral"?"Recorded values":direction==="higher"?"Higher leads":"Lower leads"} a={render(row.first)} b={render(row.second)}/>;})}
  </div>
  {!tests.length&&!games.length&&<section className={`${styles.panel} ${styles.empty}`}>No recorded {category.toLowerCase()} results for this comparison yet.</section>}
  <p className={styles.meta}>{category==="Game Stats"?"Compare sample sizes alongside rates. Totals depend on playing time; pitching uses the same recorded week or game.":"Comparisons use the same source and unit within the selected date gap. Body measurements are numerical comparisons, not performance ratings."}</p></>:<p className={styles.notice}>{first&&second?"Choose two different players to compare.":"Choose two players from the roster above."}</p>}
 </div>;
}
