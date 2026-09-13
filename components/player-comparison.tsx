"use client";
import { useState } from "react";
import Link from "next/link";
import { ComparisonPlayerPicker } from "@/components/comparison-player-picker";
import { CoachingTabs } from "@/components/team-progress";
import { compareTests, compareGames, coachingValue, type CoachingData, type CoachingCategory } from "@/lib/coaching-tools";
import { leaderboardTestDate } from "@/lib/leaderboards";
import { GameOpportunity } from "@/components/game-opportunity";
import { StatInfo } from "@/components/stat-info";
import styles from "./coaching-tools.module.css";
function PairBars({a,b}:{a:number;b:number}){const max=Math.max(a,b)||1;return <div className={styles.bars} aria-hidden="true"><div className={`${styles.track} ${styles.a}`}><span style={{width:`${a/max*100}%`}}/></div><div className={`${styles.track} ${styles.b}`}><span style={{width:`${b/max*100}%`}}/></div></div>;}
export function PlayerComparison({data,today}:{data:CoachingData;today:string}){
 const [a,setA]=useState(data.players[0]?.id??""),[b,setB]=useState(data.players[1]?.id??""),[category,setCategory]=useState("Physicality"),[maxGap,setMaxGap]=useState(30),[event,setEvent]=useState("");
 const first=data.players.find(p=>p.id===a),second=data.players.find(p=>p.id===b);
 const selected=first&&second&&first.id!==second.id;
 const tests=selected&&category!=="Game Stats"?compareTests(data,first.id,second.id,category as CoachingCategory,today,maxGap):[];
 const games=selected&&category==="Game Stats"?compareGames(data,first.id,second.id,event):[];
 const events=[...new Map(data.games.filter(r=>r.eventId&&(r.athleteId===first?.id||r.athleteId===second?.id)).map(r=>[r.eventId,r.playedOn])).entries()].sort((a,b)=>(b[1]??"").localeCompare(a[1]??""));
 return <div className={styles.tools}>
  <div className={styles.players}>{[{value:a,set:setA,player:first,side:"A"},{value:b,set:setB,player:second,side:"B"}].map(({value,set,player,side})=><section className={`${styles.player} ${side==="B"?styles.playerB:""}`} key={side}><ComparisonPlayerPicker players={data.players} value={value} onChange={set} label={`Player ${side}`}/>{player&&<><Link href={`/athletes/${player.id}`} className={styles.name}>{player.name} ↗</Link><p className={styles.meta}>{[player.code,player.position,player.academicClass].filter(Boolean).join(" · ")}</p></>}</section>)}</div>
  <CoachingTabs games value={category} onChange={setCategory}/>
  {selected?<><div className={styles.toolbar}>{category==="Game Stats"?<label className={`${styles.field} ${styles.metricField}`}>Shared Period or Event<select aria-label="Game comparison period" value={event} onChange={e=>setEvent(e.target.value)}><option value="">QPA · Fall 2026 totals</option>{events.map(([id,date])=><option key={id} value={id}>Pitching · {date?leaderboardTestDate(date):"Date unavailable"}</option>)}</select></label>:<label className={styles.field}>Maximum Test Date Gap<select value={maxGap} onChange={e=>setMaxGap(Number(e.target.value))}>{[7,14,30,60].map(n=><option value={n} key={n}>{n} days</option>)}</select></label>}<div className={styles.legend}><span className={styles.a}><span className={styles.key}/>{first.name}</span><span className={styles.b}><span className={styles.key}/>{second.name}</span></div></div>
  <div className={styles.comparisonGrid}>
   {tests.map(row=><section className={styles.comparison} key={row.key}><h3>{row.label}<StatInfo metric={row.metric} label={row.label}/></h3><p className={styles.meta}>{row.source} · Fall 2026</p><div className={styles.pair}>{[{reading:row.first,eligible:row.eligibleA,review:row.reviewA,side:"a"},{reading:row.second,eligible:row.eligibleB,review:row.reviewB,side:"b"}].map(({reading,eligible,review,side})=><div key={side} role="group" aria-label={side==="a"?first.name:second.name}><strong className={styles[side]}>{reading?coachingValue(reading.value,row.metric,row.unit):"—"}</strong><p className={styles.meta}>{reading?leaderboardTestDate(reading.date):!eligible?"Not applicable":review?"Needs review":"Not yet tested"}</p></div>)}</div>{row.comparable?<PairBars a={row.first!.value} b={row.second!.value}/>:<p className={styles.meta}>{row.gap!==null?`Tests are ${row.gap} days apart · comparison withheld`:"Both players need comparable results."}</p>}</section>)}
   {games.map(row=><section className={styles.comparison} key={row.metric}><h3>{row.label}<StatInfo metric={row.metric} label={row.label}/></h3><p className={styles.meta}>{event?"Pitching · selected event":"QPA · Fall 2026 totals"}</p><div className={styles.pair}>{[row.first,row.second].map((r,i)=><div key={i} role="group" aria-label={i===0?first.name:second.name}><strong className={i===0?styles.a:styles.b}>{r?coachingValue(r.value,r.metric,r.unit):"—"}</strong>{r?<><GameOpportunity source={r.source} metric={r.metric} count={r.opportunities}/><p className={styles.meta}>Updated {leaderboardTestDate(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(r.updatedAt)))}</p></>:<p className={styles.meta}>No verified result</p>}</div>)}</div>{row.comparable?<PairBars a={row.first!.value} b={row.second!.value}/>:<p className={styles.meta}>Both players need results from the same snapshot and event.</p>}</section>)}
  </div>
  {!tests.length&&!games.length&&<section className={`${styles.panel} ${styles.empty}`}>No recorded {category.toLowerCase()} results for this comparison yet.</section>}
  <p className={styles.meta}>Each pair of bars starts at zero and shares one scale for that metric. Colors identify players, not favorable results. {category==="Game Stats"?"Compare opportunity counts alongside rates; totals depend on playing time. Pitching comparisons use one actual event.":"Measurements use the same source and unit. Only current Fall results are compared; test dates remain visible."}</p></>:<p className={styles.notice}>{first&&second?"Choose two different players to compare.":"Choose two players from the roster above."}</p>}
 </div>;
}
