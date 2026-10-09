import { DetailSection } from "@/components/detail-section";
import { isAdvancedGameMetric, ADVANCED_PITCHING_METRICS, ADVANCED_HITTING_METRICS } from "@/lib/advanced-game-presentation";
import { pitchingPeriodLabel } from "@/lib/game-source";
import { LeaderboardAverage } from "@/components/leaderboard-average";
import { GameOpportunity } from "@/components/game-opportunity";
import Link from "next/link";
import { qualifiedGameCodes } from "@/lib/game-qualification";
import { StatInfo } from "@/components/stat-info";
import { LeaderboardNavigation } from "@/components/leaderboard-navigation";
import { GAME_LEADERBOARD_METRICS, PITCHING_LEADERBOARD_METRICS, GAME_METRIC_LABELS, gameDirection, gameValue, type GameLeaderboardRow } from "@/lib/game-metrics";
import styles from "./leaderboard.module.css";
const labels:Record<string,string>={...GAME_METRIC_LABELS,strike_pct:"Strike %",k:"Strikeouts",bb_outcome:"Walks Allowed",pitches:"Pitches"};
function Rows({ rows, label, tiedRanks }: { rows: GameLeaderboardRow[]; label: string; tiedRanks: Set<number> }) {
 return <div className={styles.tableWrap}><table aria-label={`${label} game rankings`}><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Result</th></tr></thead><tbody>{rows.map(row => <tr key={row.code} className={row.rank === 1 ? styles.leading : undefined}>
  <td><span className={`${styles.rank} ${row.rank === 1 ? styles.first : ""}`} aria-label={`${tiedRanks.has(row.rank) ? "Tied for rank" : "Rank"} ${row.rank}`}>{row.rank}</span></td>
  <th scope="row"><span className={styles.player}>{row.profileId ? <Link href={`/athletes/${row.profileId}`} prefetch={false}>{row.name}</Link> : row.name}</span><span className={styles.playerMeta}>{row.code}</span></th>
  <td className={styles.result}>{gameValue(row.value, row.unit)}<span className={styles.gameSample}><GameOpportunity source={row.source} metric={row.metric} count={row.opportunities}/></span></td>
 </tr>)}</tbody></table></div>;
}
function GameRankCard({ group, visible }: { group: GameLeaderboardRow[]; visible?: Set<string> }) {
 const first = group[0], label = labels[first.metric] ?? first.metric, sorted = [...group].sort((a, b) => a.rank - b.rank || a.code.localeCompare(b.code)), direction = gameDirection(first.source, first.metric);
 const tiedRanks = new Set(sorted.filter((row, index) => sorted.some((other, otherIndex) => otherIndex !== index && other.rank === row.rank)).map(row => row.rank));
 return <section className={`panel leaderboard-card ${styles.card}`}>
  <header className={styles.heading}>
   <div className={styles.eyebrow}><span>{first.source === "qpa_fall_2026" ? "Hitting · Fall 2026 To Date" : `Pitching · ${pitchingPeriodLabel(first.eventId, first.playedOn)}`}</span><span>{group.length} players</span></div>
   <h3>{label}<StatInfo metric={first.metric} label={label} unit={first.unit} cohort={group.map(row=>row.value)}/></h3>
   <p>{direction === "lower" ? "Lowest first" : "Highest first"} · Updated {new Date(first.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" })}</p>
  </header>
  <LeaderboardAverage game values={sorted.map(row => row.value)} label={label} format={value => first.unit === "count" ? value.toLocaleString("en-US", { maximumFractionDigits: 1 }) : first.unit === "ratio" ? value.toFixed(3) : gameValue(value, first.unit)}/>
  {(() => { const shown = visible ? sorted.filter(row => visible.has(row.code)) : sorted;
   if (!shown.length) return <p className="muted m-0 px-4 pb-4 text-sm">No qualified players yet.</p>;
   return <><Rows rows={shown.slice(0, 5)} label={label} tiedRanks={tiedRanks}/>{shown.length > 5 && <details className={styles.more}><summary>Show {shown.length - 5} More</summary><Rows rows={shown.slice(5)} label={`${label} remaining`} tiedRanks={tiedRanks}/></details>}{visible && shown.length < sorted.length && <p className="muted m-0 px-4 pb-3 text-xs">{sorted.length - shown.length} below the minimum hidden · ranks and average include everyone</p>}</>; })()}
 </section>;
}
export function GameLeaderboard({rows,discipline="hitting",qualified=false,weeks=1}:{rows:GameLeaderboardRow[];discipline?:"hitting"|"pitching";qualified?:boolean;weeks?:number}){
 rows=rows.filter(row=>row.source===(discipline==="hitting"?"qpa_fall_2026":"pitching_fall_2026"));
 const qualification=qualifiedGameCodes(rows,discipline,weeks),visible=qualified?qualification.codes:undefined;
 const groups=new Map<string,GameLeaderboardRow[]>();for(const row of rows){const key=JSON.stringify([row.source,row.eventId,row.metric]);groups.set(key,[...(groups.get(key)??[]),row]);}
 const priority:readonly string[]=discipline==="hitting"?[...ADVANCED_HITTING_METRICS,...GAME_LEADERBOARD_METRICS]:[...ADVANCED_PITCHING_METRICS,...PITCHING_LEADERBOARD_METRICS];
 const panels=[...groups.values()].sort((a,b)=>a[0].eventId.localeCompare(b[0].eventId)||priority.indexOf(a[0].metric)-priority.indexOf(b[0].metric));
 const advanced=panels.filter(group=>isAdvancedGameMetric(group[0].metric)),other=panels.filter(group=>!isAdvancedGameMetric(group[0].metric));
 return <div className={styles.board}><div className={styles.controls}><LeaderboardNavigation group="games"/><nav aria-label="Game leaderboard discipline" className="leaderboard-navigation mb-5">{(["hitting","pitching"] as const).map(kind=><Link key={kind} href={`/leaderboards?group=games&discipline=${kind}`} aria-current={discipline===kind?"page":undefined}>{kind==="hitting"?"Hitting Game Stats":"Pitching Game Stats"}</Link>)}</nav><nav aria-label="Qualified players" className="leaderboard-navigation mb-5" data-testid="qualified-toggle">{([false,true] as const).map(value=><Link key={String(value)} href={`/leaderboards?group=games&discipline=${discipline}${value?"&qualified=1":""}`} aria-current={qualified===value?"page":undefined}>{value?`Qualified (${qualification.label}+)`:"Everyone"}</Link>)}</nav></div>
 {!panels.length?<section className="panel p-8 text-center"><h2 className="text-xl font-bold">Game Rankings Will Be Here Soon</h2><p className="muted text-sm">Fall game rankings will appear after coaches add the next sheet update.</p></section>:<div className={styles.sections}>
  {advanced.length>0&&<section aria-label={`Advanced ${discipline} rankings`}><header className={`${styles.sectionHeading} ${styles.gameHeading}`}><h2>Advanced {discipline==="hitting"?"Hitting":"Pitching"}</h2><p className="muted mb-5 max-w-3xl text-xs leading-6">{discipline==="hitting"?"Power and recorded production · PAC Production+ uses 100 as the team reference. Doubles/triples count as doubles.":"Strikeout/walk approach and traffic allowed · Lower BB/9 and WHIP rank higher."} These are recorded-result measures, not luck-adjusted predictions. Check the sample below each result.</p></header><div className={`${styles.grid} ${styles.gameGrid}`}>{advanced.map(group=><GameRankCard key={JSON.stringify([group[0].source,group[0].eventId,group[0].metric])} group={group} visible={visible}/>)}</div></section>}
  {other.length>0&&<section aria-label="More game rankings"><DetailSection title={advanced.length?"More Game Stats":"Game Stats"} description={`${other.length} rankings · Rates and counting stats`} open={!advanced.length}><div className={`${styles.grid} ${styles.gameGrid}`}>{other.map(group=><GameRankCard key={JSON.stringify([group[0].source,group[0].eventId,group[0].metric])} group={group} visible={visible}/>)}</div></DetailSection></section>}
 </div>}
 <details className={styles.notes}><summary className="cursor-pointer font-semibold">About Game Rankings</summary><div className="mt-3 max-w-3xl space-y-2 leading-6"><p>Hitting boards use the latest Fall QPA totals. Pitching boards add the recorded Fall weeks or games. Rates use the total chances and innings, rather than averaging weekly rates. Ties share places (1, 1, 3). The number below a result shows its chances: AVG uses AB, OBP uses AB + BB + HBP + SF, HH% uses the team’s AB − K − Sac Bunt denominator, and the other batting rates use PA. PA beneath HR, SB or GDP is playing-time context, not a success-rate denominator. Pitching Strike % uses pitches. These chance counts are different from the number of teammates on a board. “Early sample” appears below 20 batting chances or 50 pitches. It does not remove a player from the rankings. The optional Qualified view hides players below 2 PA (hitting) or 1 IP (pitching) per Fall Ball week so far; ranks and team averages still include everyone.</p><p>SLG/ISO count doubles/triples as doubles and home runs as four bases. wOBAcon uses fixed 2025 MLB reference weights and AB − K + SF contact opportunities. PAC Production+ is a custom recorded-production index (pooled team = 100), not wRC+. Exact triples would raise the estimates. WHIP excludes HBP; K/BB has no finite value when walks are zero.</p><p>AVG and OBP show three decimals, but rankings use the full values. More walks rank higher for hitters; fewer strikeouts and double plays rank higher. Counting stats depend on playing time. The HH% info button explains the team’s scoring rule.</p><p>These rankings are visible to signed-in players and staff. A player’s full game history and profile remain limited to that player and staff.</p></div></details></div>;
}
