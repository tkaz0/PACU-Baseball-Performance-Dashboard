import Link from "next/link";
import { ArrowUpRight, ArrowRight, Activity, Upload, UsersRound, ChartNoAxesCombined, Trophy, Clock3, Crosshair, UserRound, ClipboardCheck } from "lucide-react";
import { PacificLogo } from "@/components/pacific-brand";
import { StatInfo } from "@/components/stat-info";
import { formatTeamGameMetric, type TeamGameSummary } from "@/lib/team-game-stats";
import { formatInnings } from "@/lib/pitching-stats";
import type { HomeSummary } from "@/lib/home-summary";
import type { coachUpdateDigest } from "@/lib/coach-update-digest";
import type { HomeLeaderboard, HomeRank } from "@/lib/home-leaderboards";
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
function RankRows({rows}:{rows:HomeRank[]}) { return <ol className={styles.rankList}>{rows.map(row=><li key={row.code} className={row.isYou?styles.yourRow:undefined}><span className={styles.rankNumber}>{String(row.rank).padStart(2,"0")}</span><span className={styles.rankName}>{row.profileId?<Link prefetch={false} href={`/athletes/${row.profileId}`}>{row.name}</Link>:row.name}{row.isYou&&<small>You</small>}</span><strong className={styles.rankValue}>{row.value}</strong></li>)}</ol>; }
function HomeRankCard({board}:{board:HomeLeaderboard}) { return <article className={styles.rankCard} aria-label={`${board.title} team leaderboard`}><div className={styles.rankCardHead}><div><p className={styles.kicker}>{board.category}</p><h3>{board.title}</h3></div><span className={styles.rankBadge}><Trophy size={15} aria-hidden="true"/></span></div><RankRows rows={board.rows.slice(0,3)}/>{board.yourRank!==null&&board.yourRank>3&&<p className={styles.yourPlace}>Your place <strong>#{board.yourRank}</strong></p>}{board.rows.length>3&&<details className={styles.moreRanks}><summary>Show all {board.total} players</summary><RankRows rows={board.rows.slice(3)}/></details>}<Link prefetch={false} href={board.href} className={styles.rankFooter}>Open full leaderboard<ArrowUpRight size={15} aria-hidden="true"/></Link></article>; }
export function DashboardHome({staff,athleteId,summary,leaderboards=[]}:{staff:boolean;athleteId:string|null;summary:(HomeSummary & {coachDigest?:ReturnType<typeof coachUpdateDigest>})|null;leaderboards?:HomeLeaderboard[]}) {
  const profile=athleteId?`/athletes/${athleteId}`:null;
  const actions=staff?[
    {href:"/roster",title:"Roster",detail:"Open player profiles",icon:UsersRound},
    {href:"/imports",title:"Import Results",detail:"Add testing and session files",icon:Upload},
    {href:"/analytics",title:"Analytics",detail:"Explore team relationships",icon:ChartNoAxesCombined},
  ]:[
    ...(profile?[{href:profile,title:"My Profile",detail:"Your complete player card",icon:UserRound}]:[]),
    {href:"/game-stats",title:"My Game Stats",detail:"Your Fall results",icon:Activity},
    {href:"/leaderboards",title:"Leaderboards",detail:"Team rankings",icon:Trophy},
  ];
  const savedAreas=summary?.coverage.filter(a=>a.players>0).length??0;
  const latestUpdate=summary?.updates[0];
  return <div className={styles.home}>
    <section className={styles.welcome} aria-label="Dashboard home">
      <div><p className={styles.kicker}>Pacific University <span>/</span> Boxer Baseball</p><h1>{staff?"The Team, at a Glance.":"Your Baseball Home."}</h1><p className={styles.intro}>{staff?"A starting point for the roster, new results, and the numbers shaping this Fall.":"Your progress and your team in one place. Open your card for the full story behind every result."}</p>
        <div className={styles.heroActions}><Link prefetch={false} href={staff?"/roster":profile??"/settings"} className="btn btn-primary">{staff?"Explore Roster":profile?"Open My Profile":"Account Settings"}<ArrowRight size={16}/></Link><Link prefetch={false} href="/leaderboards" className={styles.secondaryAction}>Team Leaderboards<ArrowUpRight size={15}/></Link></div>
      </div><div className={styles.homeMark}><PacificLogo variant="university" tone="dark" decorative/><span>Fall 2026</span></div>
    </section>
    {summary&&<div className={styles.pulseStrip} aria-label="Fall dashboard snapshot"><div><span>{staff?"Players with Results":"Areas with Results"}</span><strong>{staff?summary.playersWithResults:savedAreas}<small> / {staff?summary.players:4}</small></strong></div><div><span>Latest Update</span><strong className={styles.pulseDate}>{latestUpdate?date(latestUpdate.date,true):"Awaiting results"}</strong>{latestUpdate&&<small className={styles.pulseDetail}>{latestUpdate.label}</small>}</div><div><span>Season</span><strong className={styles.pulseDate}>2026 Fall Ball</strong></div></div>}
    {!summary?<section className={styles.panel}><h2>Your profile is being connected</h2><p className={styles.empty}>Your administrator will link your account to the correct player profile. Your results will appear here once it is connected.</p></section>:<>
      <section className={styles.rankSection} aria-label="Featured team leaderboards"><div className={styles.blockHeading}><div><p className={styles.kicker}>Around the Team</p><h2>Featured Leaderboards</h2><p>Recorded Fall results. Expand a card or open the full rankings.</p></div><Link prefetch={false} href="/leaderboards" className={styles.panelLink}>All Leaderboards<ArrowRight size={15}/></Link></div>{leaderboards.length?<div className={styles.rankGrid}>{leaderboards.map(board=><HomeRankCard board={board} key={board.key}/>)}</div>:<div className={styles.rankEmpty}><Trophy size={23} aria-hidden="true"/><p>Team rankings will appear when Fall results are saved.</p><Link prefetch={false} href="/leaderboards">Explore Leaderboards<ArrowRight size={14}/></Link></div>}</section>
      <div className={styles.mainGrid}>
        <section className={styles.panel} aria-label={staff?"Fall roster coverage":"Your latest testing"}>
          <div className={styles.sectionTitle}><div><p className={styles.kicker}>{staff?"Team Development":"Your Development"}</p><h2>{staff?"Testing Coverage":"Your Results"}</h2></div><Crosshair size={22} className={styles.subtleIcon}/></div>
          <p className={styles.panelIntro}>{staff?"Where the roster has recorded results this Fall.":"The areas currently available on your player card."}</p>
          {!staff&&!savedAreas&&<p className={styles.empty}>Your latest testing dates will appear after your first saved Fall report.</p>}<div className={styles.coverageList}>{summary.coverage.filter(a=>staff||a.players>0).map(a=><div className={styles.coverageRow} key={a.key}><div><strong>{a.label}</strong><span>{staff?`${a.players} / ${summary.players} players`:a.lastTested?date(a.lastTested,true):"No Fall results yet"}</span></div>{staff?<meter min={0} max={Math.max(1,summary.players)} value={a.players} aria-label={`${a.label}: ${a.players} of ${summary.players} players with results`}/>:null}<p>{a.detail}{staff&&a.lastTested?` · Latest: ${date(a.lastTested)}`:""}</p></div>)}</div>
          <p className={styles.caption}>{staff?"Coverage counts players with at least one saved result in each area.":"Only your saved results appear here."}</p>
          <Link prefetch={false} href={staff?"/testing/coverage":profile??"/settings"} className={styles.panelLink}>{staff?"Open Testing Checklist":"View My Results"}<ArrowRight size={15}/></Link>
        </section>
        <section className={styles.panel} aria-label="Recent data updates">
          <div className={styles.sectionTitle}><div><p className={styles.kicker}>Fresh from the Field</p><h2>Recent Updates</h2></div><Clock3 size={21} className={styles.subtleIcon}/></div>
          {staff&&summary.coachDigest&&<div className={styles.coachPulse} aria-label="Weekly coaching pulse"><div><strong>{summary.coachDigest.updatedPlayers.length}</strong><span>Players updated</span></div><div><strong>{summary.coachDigest.changes.length}</strong><span>Measured changes</span></div><div><strong>{summary.coachDigest.stale.length}</strong><span>Testing follow-up</span></div></div>}
          {summary.updates.length?<ol className={styles.updates}>{summary.updates.slice(0,4).map(u=><li key={u.key}><span className={styles.updateDot}/><div><strong>{u.label}</strong><p>{u.kind} to the dashboard</p></div><time dateTime={u.date}>{date(u.date)}</time></li>)}</ol>:<p className={styles.empty}>Updates appear when Fall measurements or game stats are saved.</p>}
          {staff&&<div className={styles.nextStep}><ClipboardCheck size={21}/><div><strong>Ready for the next report?</strong><p>Review player matches and test dates before sharing new results.</p></div></div>}
          <Link prefetch={false} href={staff?"/testing/changes":profile??"/settings"} className={styles.panelLink}>{staff?"See What Changed":"Open My Profile"}<ArrowRight size={15}/></Link>
        </section>
      </div>
      <nav className={styles.quickLinks} aria-label="Home shortcuts">{actions.map(({href,title,detail,icon:Icon})=><Link prefetch={false} key={href} href={href}><span className={styles.actionIcon}><Icon size={20}/></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpRight className={styles.actionArrow} size={17}/></Link>)}</nav>
      <section aria-label="Fall game summary"><div className={styles.gameHeader}><div><p className={styles.kicker}>Competition</p><h2>{staff?"Team Game Snapshot":"My Game Snapshot"}</h2><p className={styles.caption}>Fall 2026 · Cumulative{staff?" · Matched rostered players":""}</p></div><Link prefetch={false} href="/game-stats" className={styles.panelLink}>All Game Stats<ArrowRight size={15}/></Link></div><div className={styles.gameGrid}>{(staff||summary.batting.entries>0)&&<GameSnapshot summary={summary.batting} kind="Hitting"/>}{(staff||summary.pitching.entries>0)&&<GameSnapshot summary={summary.pitching} kind="Pitching"/>}{!staff&&!summary.batting.entries&&!summary.pitching.entries&&<p className={styles.empty}>Your game stats will appear after your first verified Fall update.</p>}</div></section>
    </>}
    {!summary&&<nav className={styles.quickLinks} aria-label="Home shortcuts">{actions.map(({href,title,detail,icon:Icon})=><Link prefetch={false} key={href} href={href}><span className={styles.actionIcon}><Icon size={20}/></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpRight className={styles.actionArrow} size={17}/></Link>)}</nav>}
  </div>;
}
