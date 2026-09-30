import reference from "@/lib/nwc-benchmarks.json";
import { PLAYER_METRICS } from "@/lib/player-performance";
import { STAT_DEFINITIONS, statDefinitionKey } from "@/lib/stat-definitions";

export type Benchmark = { cuts: number[]; direction: "higher" | "lower" | "neutral"; n: number; mean?:number; title: string; note: string; url?: string; unit?: string };
export type StatGuideContext = { scope?: "team" | "player"; eventId?:string; source?: string; unit?: string; value?: number | null; percentile?: number | null; period?: "fall_2026" | "summer_2026"; cohort?: number[] };
/** Historical report dates must not silently request the current Fall cohort. */
export function measurementGuideContext(reading:{source:string;unit:string;value:number;measured_at:string}):StatGuideContext {
  const date=reading.measured_at;
  const valid=/^2026-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
  const period=valid&&date>="2026-09-01"&&date<="2026-12-31"?"fall_2026":valid&&date>="2026-06-01"&&date<="2026-08-31"?"summer_2026":undefined;
  return {unit:reading.unit,value:reading.value,...(period?{source:reading.source,period}:{})};
}
export const GRADE_LABELS = ["Poor", "Below Average", "Average", "Good", "Elite"] as const;
export const NEUTRAL_LABELS = ["Low", "Below Average", "Average", "High", "Very High"] as const;
export function benchmarkMetric(metric: string): string {
  return statDefinitionKey(metric);
}
export function metricDirection(metric:string):Benchmark["direction"] {
  const key=benchmarkMetric(metric);
  if(/spin|angle|connection|height|weight|mass|body_fat|body_score|water|protein|bone|bmi|bmr|visceral|metabolic|impedance|fat|muscle|waist/.test(key))return "neutral";
  if(["blast_time_to_contact","batting_k_pct","bb_pct","pitching_bb9","pitching_r9","pitching_whip","hard_contact_pct"].includes(key))return "lower";
  if(key.startsWith("batting_")||["game_log_slg","game_log_iso","classified_avg_velocity","classified_max_velocity","pitching_k9","pitching_k_bb","strike_pct","k_pct","pitching_fb_strike_pct","pitching_breaking_strike_pct","pitching_ch_strike_pct","qpa_pct","weak_contact_pct","blast_peak_hand_speed","blast_rotational_acceleration","blast_power","blast_on_plane_efficiency"].includes(key))return "higher";
  return PLAYER_METRICS.find(m=>m.key===key)?.direction ?? "neutral";
}
export function quantile(values: readonly number[], p:number):number {
  const v=[...values].sort((a,b)=>a-b), x=(v.length-1)*p, i=Math.floor(x);
  return v[i]+(v[Math.min(i+1,v.length-1)]-v[i])*(x-i);
}
/** Only callers with an already approved, identical source/unit/period projection supply a cohort. */
function readableCuts(metric:string,cuts:number[],unit?:string){
  const decimals=metric.startsWith("batting_")&&!metric.endsWith("_pct")&&!metric.includes("production")?3:unit==="%"||metric.endsWith("_pct")||unit==="mph"?1:unit==="s"?3:2;
  return cuts.map(v=>Number(v.toFixed(decimals)));
}
export function pacificBenchmark(metric:string, values:readonly number[], context:StatGuideContext={}):Benchmark|null {
  metric=benchmarkMetric(metric);
  if(ungradedMetric(metric)||values.length<5||values.some(v=>!Number.isFinite(v)))return null;
  return {cuts:readableCuts(metric,[.2,.4,.6,.8].map(p=>quantile(values,p)),context.unit),direction:metricDirection(metric),n:values.length,
    title:"Pacific Player Comparison",unit:context.unit,
    note:`Same test, source, unit and period · ${context.period==="summer_2026"?"June–August 2026":"Fall 2026"}. Five bands split the recorded players into fifths; ties can leave a band empty. This is a team comparison, not a D3 standard.`};
}
export function statBenchmark(metric:string,context:StatGuideContext={}):Benchmark|null {
  const key=benchmarkMetric(metric),scope=context.scope??"player";
  const catalog=reference[scope] as Record<string,{cuts:number[];n:number;direction:"higher"|"lower"}>;
  if(catalog[key]){
    const b=catalog[key], batting=key.startsWith("batting_");
    const unit=key.endsWith("_pct")?"%":key.startsWith("batting_")?"avg":["pitching_k9","pitching_bb9","pitching_r9"].includes(key)?"per9":"decimal";
    if(context.unit&&context.unit!==unit&&!(unit==="avg"&&["ratio","decimal"].includes(context.unit))&&!(unit==="decimal"&&context.unit==="ratio"))return null;
    return {...b,cuts:readableCuts(key,b.cuts,unit),title:`D3 Northwest Conference · 2025 ${scope==="team"?"Teams":"Players"}`,url:reference.source,unit,
      note:`${scope==="team"?"All 9 teams":batting?"Published hitting table; 71 players with at least 75 AB":"Published pitching table; 27 pitchers with at least 20 IP"}. Dashboard bands use the 20th/40th/60th/80th percentiles, not official NWC grades. Regular-season/full-season opponents differ from Fall intrasquads.${key.includes("est_")?" Recalculated with the dashboard’s doubles/triples-as-doubles rule and fixed contact weights.":""}`};
  }
  // Team pooled rates must never be judged against the distribution of individual players.
  return scope==="player"&&context.cohort?pacificBenchmark(key,context.cohort,context):null;
}
/** Equality belongs to the band beginning at the cut. Reversed metrics use the same rule before reversal. */
export function benchmarkGrade(value:number,b:Benchmark):number {
  if(b.cuts.every(c=>c===b.cuts[0])&&value===b.cuts[0])return 2;
  const index=b.cuts.filter(c=>value>=c).length;
  return b.direction==="lower"?4-index:index;
}
export function benchmarkNumber(v:number,metric:string,unit?:string):string {
  metric=benchmarkMetric(metric);
  if(metric.startsWith("batting_")&&!metric.endsWith("_pct")&&!metric.includes("production"))return v.toFixed(3).replace(/^0\./,".");
  if(unit==="%"||metric.endsWith("_pct"))return `${v.toFixed(1)}%`;
  return `${v.toFixed(unit==="s"?3:unit==="mph"?1:2)}${unit&&!["avg","ratio","decimal","per9","index","count"].includes(unit)?` ${unit}`:""}`;
}
export function benchmarkRows(metric:string,b:Benchmark) {
  const labels=b.direction==="neutral"?NEUTRAL_LABELS:GRADE_LABELS;
  if(b.cuts.every(c=>c===b.cuts[0]))return labels.map((label,index)=>({label,index,range:index===2?`= ${benchmarkNumber(b.cuts[0],metric,b.unit)}`:index===0||index===4?`${(index===0)!==(b.direction==="lower")?"<":">"} ${benchmarkNumber(b.cuts[0],metric,b.unit)}`:"No values in this band"}));
  return labels.map((label,index)=>{
    const band=b.direction==="lower"?4-index:index,low=band===0?null:b.cuts[band-1], high=band===4?null:b.cuts[band];
    return {label,index,range:low===high?"No values in this band":low===null?`< ${benchmarkNumber(high!,metric,b.unit)}`:high===null?`≥ ${benchmarkNumber(low,metric,b.unit)}`:`${benchmarkNumber(low,metric,b.unit)} to < ${benchmarkNumber(high,metric,b.unit)}`};
  });
}
export function blastReference(metric:string,context:StatGuideContext):string|null {
  metric=benchmarkMetric(metric);
  const units:Record<string,string>={avg_bat_speed:"mph",blast_peak_hand_speed:"mph",blast_attack_angle:"deg",blast_vertical_bat_angle:"deg",blast_early_connection:"deg",blast_connection_impact:"deg",blast_time_to_contact:"s",blast_power:"kw",blast_on_plane_efficiency:"%"};
  if(context.unit!==units[metric]||!context.unit)return null;
  if(!(context.source==="blast_fall"||/^blast motion · average · /i.test(context.source??"")))return null;
  return ({avg_bat_speed:"College bat speed: 66–75 mph",blast_peak_hand_speed:"College peak hand speed: 21–25 mph",blast_attack_angle:"College attack angle: 2–15°",blast_vertical_bat_angle:"Vertical bat angle: −40 to −10°; depends on pitch location",blast_early_connection:"Early connection target: 90° (reference window 80–105°)",blast_connection_impact:"Connection at impact target: 90° (reference window 80–95°)",blast_time_to_contact:"College time to contact: 0.14–0.17 s",blast_power:"College power: 3.83–5.074 kW",blast_on_plane_efficiency:"On-plane efficiency target: 70% or more"} as Record<string,string>)[metric]??null;
}
/** Published session means, not percentile cutoffs or maximum-velocity targets. */
export function collegePitchReference(metric:string,context:StatGuideContext) {
  metric=benchmarkMetric(metric);
  const unit=metric==="classified_avg_velocity"?"mph":metric==="classified_avg_spin"?"rpm":null;
  if(!unit||context.unit!==unit)return null;
  const pitch=/^full swing · (?:game|intrasquad|practice) · (.+)$/i.exec(context.source??"")?.[1].toLowerCase();
  const averages:Record<string,{velocity:[number,number];spin:[number,number]}>= {
    "four-seam fastball":{velocity:[85,83],spin:[2055,2005]},
    "two-seam fastball":{velocity:[84,82],spin:[1983,1933]},
    cutter:{velocity:[79,79],spin:[2073,1988]},
    curveball:{velocity:[73,72],spin:[2056,1995]},
    slider:{velocity:[76,75],spin:[2086,2036]},
    changeup:{velocity:[78,77],spin:[1167,1629]},
    splitter:{velocity:[77,75],spin:[1221,1295]},
    knuckleball:{velocity:[68,70],spin:[795,989]},
  };
  const entry=pitch?averages[pitch]:null;
  if(!entry)return null;
  const [right,left]=unit==="mph"?entry.velocity:entry.spin;
  return {right,left,unit};
}
export function ungradedMetric(metric:string):boolean {
  metric=benchmarkMetric(metric);
  if(metric==="pitching_k_bb")return false;
  return ["innings_outs","earned_runs","hh_base_hit","hh_extra_base_hit","base_hit","punchies","bb_outcome","three_eight_hh","qpa","eight_plus_pitches","moving_runner","ab_control","fb","fb_k","ch","ch_k","bb_pitch_family","bb_pitch_family_k","baf","fps","weak_contact","hard_contact"].includes(metric)||/(?:^|_)(?:count|pa|ab|pitches|strikes|hits|rbi|pumps|sb|gdp|k|bb|h|r|hbp|sac_fly|sac_bunt)$/.test(metric)||Object.hasOwn(CHART_GUIDES,metric);
}

const CHART_GUIDES:Readonly<Record<string,string>>={
  pearson_r:"The scale is −1 to +1. Near +1 means the two stats rise together; near −1 means they move in opposite directions; near 0 means little straight-line pattern. Neither end is a good-player grade. Use at least five paired players and inspect the dots and unusual results.",
  r_squared:"The scale is 0 to 1: 0.64 means the line accounts for 64% of the second stat’s variation in the players shown. There is no universal good cutoff. A high score can reflect a small sample or related measurements; it does not establish cause or predict a player’s future.",
  hitter_contact_map:"Look for repeatable contact in the intended direction and compare the same session type. This view has no single good range; missing ball readings and small samples affect what you see.",
  ev_launch_chart:"The chart uses 90+ mph for hard contact and 8–32° for its launch window. These are this chart’s markers, not national college percentile bands or targets for every swing. Check both readings and the ball count.",
  spray_chart:"There is no universal best spray angle or distance. Read direction relative to the hitter’s batting side and pitch location; the 150-foot guide is a chart boundary, not a hit or skill threshold.",
  pitch_arsenal_chart:"There is no universal ideal speed–spin combination. Compare the same pitch type, session context, averaging basis and reading counts. Spin alone cannot tell you movement, command or effectiveness.",
  pitch_mix_chart:"There is no universal best pitch mix. Read each share as usage among the assigned pitches shown, then consider role, hitters and game plan; unassigned pitches are outside this chart.",
  pitch_separation_chart:"There is no universal ideal velocity gap. A larger gap is not automatically better: pitch shape, command and deception matter. Only compare matched sources, averaging methods, dates and verified reading counts.",
  pitching_contact_chart:"More weak contact and less hard contact is the useful direction within this team’s scoring system. A defensible numeric good range needs at least five comparable pitchers with the same recorded period; the bar alone is not that reference.",
  pitch_splits:"There is no universal best usage percentage. More strikes within a pitch family can be useful, but compare the same family and period with its pitch count; this sheet does not separate sliders and curveballs.",
};
export type StatRangeGuide={heading:string;summary:string;detail:string};
/** Every info panel answers the range question without inventing a target. */
export function statRangeGuide(metric:string,context:StatGuideContext={},benchmark:Benchmark|null=statBenchmark(metric,context)):StatRangeGuide {
  const key=benchmarkMetric(metric),neutral=Object.hasOwn(STAT_DEFINITIONS,key)&&metricDirection(key)==="neutral";
  if(CHART_GUIDES[key])return {heading:"How to read a useful result",summary:CHART_GUIDES[key],detail:"Chart measures describe the selected data, not a poor-to-elite player ranking."};
  if(ungradedMetric(key))return {heading:"What is a good total?",summary:"There is no universal good total. Counts depend on opportunities, role and playing time.",detail:/classified_.*count|blast_swing_count/.test(key)?"Use the count to judge how much evidence supports the average or maximum. A bigger sample is not a skill grade.":"Compare the matching rate and its plate appearances, pitches, innings or chances. A small total may simply mean fewer opportunities."};
  if(benchmark){
    const rows=benchmarkRows(key,benchmark);
    return benchmark.direction==="neutral"
      ? {heading:"Typical recorded range",summary:`Middle band: ${rows[2].range}. There is no single ideal value.`,detail:"Low and high describe this comparison group only. They are not health, body-composition or pitch-quality targets."}
      : {heading:"What is a good range?",summary:`Good: ${rows[3].range}. Elite: ${rows[4].range}.`,detail:`These labels describe ${benchmark.url?"the published 2025 NWC reference":"comparable Pacific players"}, not universal college recruiting standards. Check the sample and comparison notes below.`};
  }
  if(key==="batting_production_plus")return {heading:"What is a good result?",summary:"100 is the pooled eligible Pacific team rate; above 100 is above that recorded-production rate. For example, 120 means 20% above it.",detail:"No verified universal Poor or Elite cutoff is available. This is the dashboard’s production index, not wRC+ or runs created, and the doubles/triples assumptions still apply."};
  const blast=blastReference(key,context);
  if(blast)return {heading:neutral?"Published reference window":"Published college reference",summary:blast,detail:"Blast vendor guidance applies to this average metric and unit. It is not a D3 percentile or a target for every swing; pitch location and swing intent matter."};
  return {heading:neutral?"No single ideal range":"Good range unavailable",summary:neutral?"The number alone does not establish better performance. A descriptive team range can show what was recorded, without prescribing a target.":"No verified numeric good range is available for this exact result yet.",detail:context.scope==="team"?"A pooled team result cannot use individual-player bands. No matching published team benchmark is available.":"Pacific numeric bands need at least five players with the same test, source, unit and period. A missing or unsupported comparison stays unavailable; national cutoffs are not inferred."};
}
