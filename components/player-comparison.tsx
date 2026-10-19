"use client";

import { pitchSourceLabel } from "@/lib/pitch-display";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { PitchArsenalComparison } from "@/components/pitch-arsenal-comparison";
import { comparePitchArsenals, withoutCoveredPitchVelocity } from "@/lib/player-comparison-arsenal";
import { ComparisonPlayerPicker } from "@/components/comparison-player-picker";
import { CoachingTabs } from "@/components/team-progress";
import { compareTests, compareGames, playerGameSources, coachingValue, comparisonLead, type CoachingData, type CoachingCategory } from "@/lib/coaching-tools";
import { fallSummaryContext } from "@/lib/coaching-tools";
import { PLAYER_METRICS } from "@/lib/player-performance";
import { PITCHING_CUMULATIVE } from "@/lib/pitching-cumulative";
import { pitchingPeriodLabel } from "@/lib/game-source";
import { leaderboardTestDate } from "@/lib/leaderboards";
import { GameOpportunity } from "@/components/game-opportunity";
import type { StatGuideContext } from "@/lib/stat-benchmarks";
import { StatInfo } from "@/components/stat-info";
import { PlayerAvatar } from "@/components/player-avatar";
import styles from "./coaching-tools.module.css";
/** Mirrored magnitude bars from the center, scaled to the larger of the two values; only for comparable positive results. */
function MirrorBar({value,max,side,lead}:{value:number|null|undefined;max:number;side:"a"|"b";lead:boolean}){
 if(value==null||!Number.isFinite(value)||value<0||max<=0)return null;
 return <span className={`${styles.mirrorTrack} ${side==="a"?styles.mirrorA:""}`} aria-hidden="true"><span className={lead?styles.mirrorLead:styles.mirrorFill} style={{width:`${Math.min(100,value/max*100)}%`}}/></span>;
}
function ComparisonRow({label,metric,context,guide,a,b,first,second,lead,note,values}:{label:string;metric:string;context:string;guide:StatGuideContext;a:ReactNode;b:ReactNode;first:string;second:string;lead:"a"|"b"|"tie"|null;note:string;values?:[number|null|undefined,number|null|undefined]}){
 const max=values&&lead!==null?Math.max(values[0]??0,values[1]??0):0;
 return <section className={styles.compareRow} aria-label={label}>
  <div className={`${styles.compareValue} ${lead==="a"?styles.leading:""}`} aria-label={first}>{a}{lead==="a"&&<span className={styles.leadBadge}>Leading</span>}<MirrorBar value={values?.[0]} max={max} side="a" lead={lead==="a"}/></div>
  <div className={styles.compareLabel}><h3>{label}<StatInfo metric={metric} label={label} {...guide}/></h3><p className={styles.meta}>{context}</p><p className={styles.compareNote}>{lead==="tie"?"Equal result":note}</p></div>
  <div className={`${styles.compareValue} ${lead==="b"?styles.leading:""}`} aria-label={second}>{b}{lead==="b"&&<span className={styles.leadBadge}>Leading</span>}<MirrorBar value={values?.[1]} max={max} side="b" lead={lead==="b"}/></div>
 </section>;
}
export function PlayerComparison({data,today,headshots={}}:{data:CoachingData;today:string;headshots?:Readonly<Record<string,string>>}){
 const [a,setA]=useState(data.players[0]?.id??""),[b,setB]=useState(data.players[1]?.id??""),[category,setCategory]=useState("Physicality"),[maxGap,setMaxGap]=useState(30),[event,setEvent]=useState("");
 const first=data.players.find(p=>p.id===a),second=data.players.find(p=>p.id===b),selected=first&&second&&first.id!==second.id;
 const arsenals=selected&&category==="Throwing"?comparePitchArsenals(data,first.id,second.id,today,maxGap):[];
 const hasLatestSessionAverage=arsenals.some(pitch=>pitch.metrics.some(metric=>metric.first?.basis==="Latest session"||metric.second?.basis==="Latest session"));
 const allTests=selected&&category!=="Game Stats"?compareTests(data,first.id,second.id,category as CoachingCategory,today,maxGap):[];
 const tests=withoutCoveredPitchVelocity(allTests,arsenals);
 const sharedSources=first&&second?playerGameSources(first).filter(s=>playerGameSources(second).includes(s)):[];
 const choices=sharedSources.map(source=>({id:source==="qpa_fall_2026"?"":PITCHING_CUMULATIVE,label:source==="qpa_fall_2026"?"Hitting · Fall to Date":"Pitching · Fall to Date"}));
 const selectedEvent=choices.some(c=>c.id===event)?event:choices[0]?.id??"";
 const games=selected&&category==="Game Stats"?compareGames(data,first.id,second.id,selectedEvent):[];

 const leads=[...tests.map(row=>comparisonLead(row.first?.value,row.second?.value,PLAYER_METRICS.find(m=>m.key===row.metric)?.direction??"neutral",row.comparable)),...games.map(row=>comparisonLead(row.first?.value,row.second?.value,row.first?.direction??row.second?.direction??"neutral",row.comparable))];
 const tally={a:leads.filter(l=>l==="a").length,b:leads.filter(l=>l==="b").length,tie:leads.filter(l=>l==="tie").length};
 return <div className={styles.tools}>
  <div className={styles.players}>{[{value:a,set:setA,player:first,side:"A"},{value:b,set:setB,player:second,side:"B"}].map(({value,set,player,side})=><section className={`${styles.player} ${side==="B"?styles.playerB:""}`} key={side}><ComparisonPlayerPicker players={data.players} value={value} onChange={id=>{set(id);setEvent("");}} label={`Player ${side}`}/>{player&&<div className={styles.playerIdentity}><PlayerAvatar name={player.name} path={headshots[player.code]} size={56} eager/><div className="min-w-0"><Link prefetch={false} href={`/athletes/${player.id}`} className={styles.name}>{player.name} ↗</Link><p className={styles.meta}>{[player.position,player.academicClass].filter(Boolean).join(" · ")}</p></div></div>}</section>)}</div>
  <CoachingTabs games value={category} onChange={setCategory}/>
  {selected?<><div className={styles.toolbar}>{category==="Game Stats"?<label className={`${styles.field} ${styles.metricField}`}>Game Stats Source<select aria-label="Game comparison source" value={selectedEvent} onChange={e=>setEvent(e.target.value)}>{choices.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>:category!=="Throwing"||tests.length||hasLatestSessionAverage?<label className={styles.field}>Tests Within<select value={maxGap} onChange={e=>setMaxGap(Number(e.target.value))}>{[7,14,30,60].map(n=><option value={n} key={n}>{n} days</option>)}</select></label>:null}<p className={styles.meta}>{arsenals.length?"The window applies to individual tests and latest-session averages. Fall averages and bests use the full Fall; body and spin results have no winner.":"The leading result is highlighted. Body results are shown without a winner."}</p></div>
  {arsenals.length>0&&<PitchArsenalComparison comparisons={arsenals} first={first.name} second={second.name}/>}
  {(tests.length>0||games.length>0)&&<div className={styles.comparisonList}><div className={styles.compareHead}><span>{first.name}{tally.a+tally.b>0&&<b className={styles.tally}>{tally.a} {tally.a===1?"lead":"leads"}</b>}</span><span>Metric{tally.tie>0&&<small className={styles.tallyTie}>{tally.tie} even</small>}</span><span>{second.name}{tally.a+tally.b>0&&<b className={styles.tally}>{tally.b} {tally.b===1?"lead":"leads"}</b>}</span></div>
   {tests.map(row=>{const direction=PLAYER_METRICS.find(m=>m.key===row.metric)?.direction??"neutral";return <ComparisonRow key={row.key} label={row.label} metric={row.metric} guide={{source:row.source,unit:row.unit,period:"fall_2026"}} context={pitchSourceLabel(row.source)} first={first.name} second={second.name} lead={comparisonLead(row.first?.value,row.second?.value,direction,row.comparable)} note={!row.comparable?(row.gap!==null?`Tests ${row.gap} days apart`:"Waiting for matching tests"):direction==="neutral"?"Measured values":direction==="higher"?"Higher leads":"Lower leads"} values={[row.first?.value,row.second?.value]} a={<><strong>{row.first?coachingValue(row.first.value,row.metric,row.unit,row.source):"—"}</strong><p className={styles.meta}>{row.first?(row.fallA?(c=>[c.context,c.sample].filter(Boolean).join(" · "))(fallSummaryContext(row.fallA,leaderboardTestDate(row.fallA.bestDate))):leaderboardTestDate(row.first.date)):!row.eligibleA?"Not applicable":row.reviewA?"Needs review":"Not yet tested"}</p></>} b={<><strong>{row.second?coachingValue(row.second.value,row.metric,row.unit,row.source):"—"}</strong><p className={styles.meta}>{row.second?(row.fallB?(c=>[c.context,c.sample].filter(Boolean).join(" · "))(fallSummaryContext(row.fallB,leaderboardTestDate(row.fallB.bestDate))):leaderboardTestDate(row.second.date)):!row.eligibleB?"Not applicable":row.reviewB?"Needs review":"Not yet tested"}</p></>}/>;})}
   {games.map(row=>{const direction=row.first?.direction??row.second?.direction??"neutral";const render=(r:typeof row.first)=><><strong>{r?coachingValue(r.value,r.metric,r.unit):"—"}</strong>{r?<><GameOpportunity source={r.source} metric={r.metric} count={r.opportunities}/><p className={styles.meta}>Updated {leaderboardTestDate(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(r.updatedAt)))}</p></>:<p className={styles.meta}>No saved result</p>}</>;return <ComparisonRow key={row.metric} label={row.label} metric={row.metric} guide={{source:row.first?.source??row.second?.source,unit:row.first?.unit??row.second?.unit,eventId:row.first?.eventId??row.second?.eventId,period:"fall_2026"}} context={selectedEvent?pitchingPeriodLabel(selectedEvent,row.first?.playedOn??row.second?.playedOn??null):"QPA · Cumulative"} first={first.name} second={second.name} lead={comparisonLead(row.first?.value,row.second?.value,direction,row.comparable)} note={!row.comparable?"Both players need results from the same Fall update":direction==="neutral"?"Recorded values":direction==="higher"?"Higher leads":"Lower leads"} values={[row.first?.value,row.second?.value]} a={render(row.first)} b={render(row.second)}/>;})}
  </div>}
  {!tests.length&&!games.length&&!arsenals.length&&<section className={`${styles.panel} ${styles.empty}`}>{category==="Game Stats"&&!choices.length?"Choose two hitters or two pitchers to compare their Fall game stats.":`No recorded ${category.toLowerCase()} results for this comparison yet.`}</section>}
  <p className={styles.meta}>{category==="Game Stats"?"Check the chances behind each rate. Counting stats depend on playing time; pitching adds the recorded Fall weeks or games.":arsenals.length?"Pitch averages keep each classified pitch and source separate; a latest-session average is labeled when a Fall average cannot be verified. Maxima are saved Fall bests. A missing pitch stays blank.":"Players are compared on the same test and units within the selected dates. Body numbers do not declare a winner."}</p></>:<p className={styles.notice}>{first&&second?"Choose two different players to compare.":"Choose two players from the roster above."}</p>}
 </div>;
}
