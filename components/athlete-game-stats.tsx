import { battingAdvancedRates, pitchingExtraRates } from "@/lib/advanced-game-stats";
import { cumulativePitching } from "@/lib/pitching-cumulative";
import { formatInnings, pitchSplits, pitchingContactRates, pitchingRates } from "@/lib/pitching-stats";
import { gameOpportunities, gameSampleText, isEarlyGameSample } from "@/lib/game-opportunities";
import type { GameComparison } from "@/lib/game-metrics";
import { battingRates, formatBattingRate, obpNeedsReview } from "@/lib/batting-stats";
import { StatInfo } from "@/components/stat-info";
import type { SharedGameStat } from "@/lib/game-server";
import styles from "./athlete-game-stats.module.css";
import type { CSSProperties } from "react";

const labels: Record<string, string> = {pa:"PA",qpa:"QPA",qpa_pct:"QPA %",ab:"AB",pitches:"Pitches",strikes:"Strikes",strike_pct:"Strike %",bb_outcome:"BB",h:"Hits",r:"Runs",k:"K",hbp:"HBP",fb:"FB",fb_k:"FB K",bb_pitch_family:"BB (pitch family)",bb_pitch_family_k:"BB K (pitch family)",ch:"CH",ch_k:"CH K",baf:"BAF",fps:"FPS",hh_base_hit:"HH Base Hit",hh_extra_base_hit:"HH Extra Base Hit",pumps:"HR",base_hit:"Hits",three_eight_hh:"3–8 HH",eight_plus_pitches:"8+ pitches",bb:"BB",rbi:"RBI",sac_bunt:"Sac Bunt",moving_runner:"Moving Runner",punchies:"Punchies",ab_control:"AB Control",sb:"SB",gdp:"GDP",sac_fly:"Sac Fly",weak_contact:"Weak Contact",hard_contact:"Hard Contact",earned_runs:"Earned Runs",innings_outs:"IP"};
const updated = (rows: readonly SharedGameStat[]) => new Date(rows.map(row => row.fetched_at).sort().at(-1)!).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric",timeZone:"America/Los_Angeles"});
type SheetStat = {metric:string;label:string;display:string;value?:number|null;unit:string;sample?:string|null};
function StatSheet({title,items,source,eventId=""}:{title:string;items:SheetStat[];source:string;eventId?:string}) {
  if (!items.length) return null;
  return <section className={styles.statSection} aria-label={title}><h4>{title}</h4><dl className={styles.sheet} style={{"--stat-columns":Math.min(items.length,6)} as CSSProperties}>{items.map(item => <div key={item.metric}><dt>{item.label}<StatInfo metric={item.metric} label={item.label} value={item.value??undefined} source={source} unit={item.unit} period="fall_2026" eventId={eventId}/></dt><dd>{item.display}</dd>{item.sample && <small>{item.sample}</small>}</div>)}</dl></section>;
}
function recorded(rows:readonly SharedGameStat[],keys:readonly string[]):SheetStat[] {
  return keys.flatMap(key => {const row=rows.find(row=>row.metric===key);return row?[{metric:key,label:labels[key]??key,value:row.value,unit:row.unit,display:key==="innings_outs"?formatInnings(row.value):row.unit==="%"?`${row.value.toFixed(1)}%`:String(row.value)}]:[];});
}
function Samples({rows,source,metric,eventId=null}:{rows:readonly SharedGameStat[];source:string;metric:string;eventId?:string|null}) {
  const count=gameOpportunities(rows,source,metric,eventId),label=gameSampleText(source,metric,count);
  return label?<span className={styles.sample}>{label}{isEarlyGameSample(source,metric,count)?" · Early sample":""}</span>:null;
}
const productionKeys=["batting_production_plus","batting_avg","batting_obp","batting_est_slg","batting_est_iso","batting_est_wobacon"];
const rateKeys=["qpa_pct","batting_hh_pct","batting_bb_pct","batting_k_pct","batting_hr_pct","batting_sb_per_pa"];
const pitchingTotals=["innings_outs","pitches","strikes","k","bb_outcome","h","r","hbp"];
export function AthleteGameStats({stats,comparisons=[],showDetails=true}:{stats:SharedGameStat[];comparisons?:GameComparison[];showDetails?:boolean}) {
  const qpa=stats.filter(row=>row.source==="qpa_fall_2026"),pitching=cumulativePitching(stats);
  const rates=[...battingAdvancedRates(qpa,comparisons),...battingRates(qpa),...qpa.filter(row=>row.metric==="qpa_pct").map(row=>({metric:row.metric,label:"QPA %",value:row.value,unit:"%" as const}))];
  const rateItems=(keys:readonly string[]):SheetStat[]=>keys.flatMap(key=>rates.filter(rate=>rate.metric===key).map(rate=>({metric:rate.metric,label:rate.label,value:rate.value,unit:rate.unit,display:formatBattingRate(rate),sample:gameSampleText("qpa_fall_2026",rate.metric,gameOpportunities(qpa,"qpa_fall_2026",rate.metric))})));
  const production=rateItems(productionKeys);
  if(obpNeedsReview(qpa))production.splice(Math.min(2,production.length),0,{metric:"batting_obp",label:"OBP",display:"—",unit:"avg",sample:"Waiting on a corrected game-sheet count"});
  const eventId=pitching[0]?.event_id??"";
  const pitchRates:SheetStat[]=[...pitchingExtraRates(pitching),...pitchingRates(pitching)].map(rate=>({metric:rate.metric,label:rate.label,value:rate.value,unit:rate.unit,display:rate.value===null?"—":rate.value.toFixed(2)}));
  pitchRates.push(...recorded(pitching,["strike_pct"]));
  const contact=pitchingContactRates(pitching),splits=pitchSplits(pitching).filter(split=>split.pitches!==null||split.strikes!==null);
  const otherQpa=qpa.filter(row=>!["pumps","sb","gdp","qpa_pct","base_hit","ab","rbi"].includes(row.metric));
  const otherPitching=pitching.filter(row=>!pitchingTotals.includes(row.metric)&&!["strike_pct","earned_runs"].includes(row.metric));
  return <section className={styles.panel} aria-label="Fall 2026 game statistics">{!stats.length?<div className={styles.empty}><h2>Game Results Will Appear Here</h2><p>No recorded Fall 2026 results yet. Results appear after the next verified team-sheet update.</p></div>:<>
    {qpa.length>0&&<section className={styles.discipline} aria-label="Cumulative hitting statistics"><header className={styles.header}><div><h3>Hitting · Fall to Date</h3><p>Sheet changed {updated(qpa)}</p></div><Samples rows={qpa} source="qpa_fall_2026" metric="batting_bb_pct"/></header>
      <StatSheet title="Production" source="qpa_fall_2026" items={production}/>
      <StatSheet title="Rates" source="qpa_fall_2026" items={rateItems(rateKeys)}/>
      <StatSheet title="Counting Stats" source="qpa_fall_2026" items={recorded(qpa,["pumps","sb","gdp"])}/>
      {rates.some(rate=>rate.metric.startsWith("batting_est_")||["batting_production_plus","batting_hr_pct"].includes(rate.metric))&&<p className={styles.note}>Power stats count doubles/triples as doubles; doubles and triples share the same recorded category. PAC Production+ compares production with the team (100 = average); it is not wRC+.</p>}
    </section>}
    {pitching.length>0&&<section className={styles.discipline} aria-label="Cumulative pitching statistics"><header className={styles.header}><div><h3>Pitching · Fall to Date</h3><p>Sheet changed {updated(pitching)}</p></div><Samples rows={pitching} source="pitching_fall_2026" metric="strike_pct" eventId={eventId}/></header>
      <StatSheet title="Pitching Rates" source="pitching_fall_2026" eventId={eventId} items={pitchRates}/>
      <StatSheet title="Pitching Totals" source="pitching_fall_2026" eventId={eventId} items={recorded(pitching,pitchingTotals)}/>
      <StatSheet title="Contact Allowed" source="pitching_fall_2026" eventId={eventId} items={contact.map(rate=>({metric:rate.metric,label:rate.label,value:rate.value,unit:rate.unit,display:rate.value===null?"—":`${rate.value.toFixed(1)}%`}))}/>
      <p className={styles.note}>{contact[0].contacts!==null?`${contact[0].count} weak · ${contact[1].count} hard · ${contact[0].contacts} classified contacts` : "Both weak and hard counts are needed for contact percentages."}</p>
      {splits.length>0&&<section className={styles.statSection} aria-label="Pitch Splits"><h4>Pitch Splits<StatInfo metric="pitch_splits" label="Pitch Splits"/></h4><div className={styles.tableWrap}><table className={styles.splits}><thead><tr><th scope="col">Pitch Family</th><th scope="col">Pitches</th><th scope="col">Strikes</th><th scope="col">Usage %</th><th scope="col">Strike %</th></tr></thead><tbody>{splits.map(split=><tr key={split.key}><th scope="row">{split.label}</th><td>{split.pitches??"—"}</td><td>{split.strikes??"—"}</td><td>{split.usage===null?"—":`${split.usage.toFixed(1)}%`}</td><td>{split.strikePct===null?"—":`${split.strikePct.toFixed(1)}%`}</td></tr>)}</tbody></table></div></section>}
    </section>}
    {showDetails&&(otherQpa.length>0||otherPitching.length>0)&&<details className={styles.more}><summary>More Stats</summary><StatSheet title="Additional QPA Totals" source="qpa_fall_2026" items={recorded(otherQpa,otherQpa.map(row=>row.metric))}/><StatSheet title="Additional Pitching Totals" source="pitching_fall_2026" eventId={eventId} items={recorded(otherPitching,otherPitching.map(row=>row.metric))}/></details>}
    <p className={styles.footer}>Fall 2026 cumulative totals · Team percentile comparisons are on Overview.</p>
  </>}</section>;
}
