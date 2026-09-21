import Link from "next/link";
import { ArrowUpRight, ArrowRight, Activity, Upload, UsersRound, ChartNoAxesCombined, Trophy, Clock3, Crosshair, UserRound, ClipboardCheck } from "lucide-react";
import { PacificLogo } from "@/components/pacific-brand";
import { StatInfo } from "@/components/stat-info";
import { formatTeamGameMetric, type TeamGameSummary } from "@/lib/team-game-stats";
import { formatInnings } from "@/lib/pitching-stats";
import type { HomeSummary } from "@/lib/home-summary";
import styles from "./dashboard-home.module.css";
const date=(value:string,withYear=false)=>new Date(value.length===10?`${value}T12:00:00Z`:value).toLocaleDateString("en-US",{month:"short",day:"numeric",...(withYear?{year:"numeric" as const}:{}),timeZone:value.length===10?"UTC":"America/Los_Angeles"});
function GameSnapshot({summary,kind}:{summary:TeamGameSummary;kind:"Hitting"|"Pitching"}) {
  const metrics=summary.rates.filter(m=>(kind==="Hitting"?["batting_avg","batting_obp","qpa_pct"]:["strike_pct","pitching_k9","pitching_bb9"]).includes(m.metric));
  return <section className={styles.gameCard} aria-label={`${kind} game snapshot`}>
    <div className={styles.sectionTitle}><h3>{kind}</h3><span className={styles.tag}>In-Game</span></div>
    {!summary.entries?<p className={styles.empty}>Results will appear after a verified Fall game-stat update.</p>:<dl className={styles.gameNumbers}>{metrics.map(m=><div key={m.metric}><dt>{m.label}<StatInfo metric={m.metric} label={m.label}/></dt><dd>{formatTeamGameMetric(m)}</dd><p>{m.pending?"Counts need review":m.opportunities===undefined?"No opportunities yet":m.opportunityLabel==="outs"?`${formatInnings(m.opportunities)} IP`:`${m.opportunities} ${m.opportunityLabel}`}</p></div>)}</dl>}
    {summary.updatedAt&&<p className={styles.caption}>Synced {date(summary.updatedAt,true)}</p>}
  </section>;
}
export function DashboardHome({staff,athleteId,summary}:{staff:boolean;athleteId:string|null;summary:HomeSummary|null}) {
  const profile=athleteId?`/athletes/${athleteId}`:null;
  const actions=staff?[
    {href:"/roster",title:"Explore the Roster",detail:"Profiles, testing & player development",icon:UsersRound},
    {href:"/imports",title:"Import Results",detail:"RENPHO, Blast & Full Swing",icon:Upload},
    {href:"/analytics",title:"Explore Analytics",detail:"Compare relationships across metrics",icon:ChartNoAxesCombined},
  ]:[
    ...(profile?[{href:profile,title:"My Player Card",detail:"Physicality, practice & game results",icon:UserRound}]:[]),
    {href:"/leaderboards",title:"Team Leaderboards",detail:"See where your recorded results rank",icon:Trophy},
    {href:"/game-stats",title:"My Game Stats",detail:"Cumulative Fall hitting & pitching",icon:Activity},
  ];
  const savedAreas=summary?.coverage.filter(a=>a.players>0).length??0;
  return <div className={styles.home}>
    <section className={styles.welcome} aria-label="Dashboard home">
      <div><p className={styles.kicker}>Pacific Baseball <span>/</span> Fall 2026</p><h1>{staff?"The Clubhouse":"Your Season. Your Progress."}</h1><p className={styles.intro}>{staff?"A clear view of the team’s work, from the practice field to game day.":"Your latest results, the work behind them, and where to go next."}</p>
        <div className={styles.heroActions}><Link prefetch={false} href={staff?"/roster":profile??"/settings"} className="btn btn-primary">{staff?"View Team Roster":profile?"Open My Profile":"Account Settings"}<ArrowRight size={16}/></Link><Link prefetch={false} href={staff?"/testing/coverage":"/leaderboards"} className={styles.secondaryAction}>{staff?"Testing Coverage":"Leaderboards"}<ArrowUpRight size={15}/></Link></div>
      </div><div className={styles.homeMark}><PacificLogo variant="university" tone="dark" decorative/><span>Boxer Baseball</span></div>
    </section>
    <nav className={styles.quickLinks} aria-label="Home shortcuts">{actions.map(({href,title,detail,icon:Icon})=><Link prefetch={false} key={href} href={href}><span className={styles.actionIcon}><Icon size={20}/></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpRight className={styles.actionArrow} size={17}/></Link>)}</nav>
    {!summary?<section className={styles.panel}><h2>Your profile is being connected</h2><p className={styles.empty}>Your administrator will link your account to the correct player profile. Your results will appear here once it is connected.</p></section>:<>
      <div className={styles.mainGrid}>
        <section className={styles.panel} aria-label={staff?"Fall roster coverage":"Your latest testing"}>
          <div className={styles.sectionTitle}><div><p className={styles.kicker}>{staff?"Team Development":"Your Development"}</p><h2>{staff?"Fall Results Coverage":"Latest Results"}</h2></div><Crosshair size={22} className={styles.subtleIcon}/></div>
          <div className={styles.coverageTotal}><strong>{staff?summary.playersWithResults:savedAreas}<span>{staff?` / ${summary.players}`:""}</span></strong><p>{staff?"rostered players with Fall results":"areas with recorded Fall results"}</p></div>
          {!staff&&!savedAreas&&<p className={styles.empty}>Your latest testing dates will appear after your first saved Fall report.</p>}<div className={styles.coverageList}>{summary.coverage.filter(a=>staff||a.players>0).map(a=><div className={styles.coverageRow} key={a.key}><div><strong>{a.label}</strong><span>{staff?`${a.players} / ${summary.players} players`:a.lastTested?date(a.lastTested,true):"No Fall results yet"}</span></div>{staff?<meter min={0} max={Math.max(1,summary.players)} value={a.players} aria-label={`${a.label}: ${a.players} of ${summary.players} players with results`}/>:null}<p>{a.detail}{staff&&a.lastTested?` · Latest: ${date(a.lastTested)}`:""}</p></div>)}</div>
          <p className={styles.caption}>{staff?"Coverage counts players with at least one saved result; it does not mean every test is complete.":"Only your saved results appear here. Your profile separates practice from in-game performance."}</p>
          <Link prefetch={false} href={staff?"/testing/coverage":profile??"/settings"} className={styles.panelLink}>{staff?"Open Testing Checklist":"View My Results"}<ArrowRight size={15}/></Link>
        </section>
        <section className={styles.panel} aria-label="Recent data updates">
          <div className={styles.sectionTitle}><div><p className={styles.kicker}>Latest Activity</p><h2>Data Updates</h2></div><Clock3 size={21} className={styles.subtleIcon}/></div>
          {summary.updates.length?<ol className={styles.updates}>{summary.updates.map(u=><li key={u.key}><span className={styles.updateDot}/><div><strong>{u.label}</strong><p>{u.kind} to the dashboard</p></div><time dateTime={u.date}>{date(u.date)}</time></li>)}</ol>:<p className={styles.empty}>Updates appear here when Fall measurements or game stats are saved.</p>}
          <div className={styles.nextStep}><ClipboardCheck size={21}/><div><strong>{staff?"Keep the next session organized":"Ready for your next session"}</strong><p>{staff?"Review player matches and dates before saving each report.":"New measurements will update your player card once your coach saves the results."}</p></div></div>
          <Link prefetch={false} href={staff?"/game-stats/review":profile??"/settings"} className={styles.panelLink}>{staff?"Open Data Review":"Open My Profile"}<ArrowRight size={15}/></Link>
        </section>
      </div>
      <section aria-label="Fall game summary"><div className={styles.gameHeader}><div><p className={styles.kicker}>Competition</p><h2>{staff?"Team Game Snapshot":"My Game Snapshot"}</h2><p className={styles.caption}>Fall 2026 · Cumulative{staff?" · Matched rostered players":""}</p></div><Link prefetch={false} href="/game-stats" className={styles.panelLink}>All Game Stats<ArrowRight size={15}/></Link></div><div className={styles.gameGrid}>{(staff||summary.batting.entries>0)&&<GameSnapshot summary={summary.batting} kind="Hitting"/>}{(staff||summary.pitching.entries>0)&&<GameSnapshot summary={summary.pitching} kind="Pitching"/>}{!staff&&!summary.batting.entries&&!summary.pitching.entries&&<p className={styles.empty}>Your game stats will appear after your first verified Fall update.</p>}</div></section>
    </>}
  </div>;
}
