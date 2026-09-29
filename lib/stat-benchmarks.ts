import reference from "@/lib/nwc-benchmarks.json";
import { PLAYER_METRICS } from "@/lib/player-performance";

export type Benchmark = { cuts: number[]; direction: "higher" | "lower" | "neutral"; n: number; mean?:number; title: string; note: string; url?: string; unit?: string };
export type StatGuideContext = { scope?: "team" | "player"; eventId?:string; source?: string; unit?: string; value?: number | null; percentile?: number | null; period?: "fall_2026" | "summer_2026"; cohort?: number[] };
export const GRADE_LABELS = ["Poor", "Below Average", "Average", "Good", "Elite"] as const;
export const NEUTRAL_LABELS = ["Low", "Below Average", "Average", "High", "Very High"] as const;
const aliases: Record<string,string> = { slg:"batting_est_slg", iso:"batting_est_iso", wobacon:"batting_est_wobacon" };
export function benchmarkMetric(metric: string): string {
  if(metric.startsWith("qpa_game_"))return benchmarkMetric(metric.slice(9));
  return aliases[metric] ?? PLAYER_METRICS.find(m=>m.key===metric||m.label.toLowerCase()===metric.toLowerCase())?.key ?? metric;
}
export function metricDirection(metric:string):Benchmark["direction"] {
  const key=benchmarkMetric(metric);
  if(/spin|angle|connection|height|weight|mass|body_fat|body_score|water|protein|bone|bmi|visceral|metabolic|impedance/.test(key))return "neutral";
  if(["blast_time_to_contact","batting_k_pct","pitching_bb9","pitching_r9","pitching_whip","hard_contact_pct"].includes(key))return "lower";
  if(key.startsWith("batting_")||["qpa_pct","weak_contact_pct","blast_peak_hand_speed","blast_rotational_acceleration","blast_power","blast_on_plane_efficiency"].includes(key))return "higher";
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
  if(values.length<5||values.some(v=>!Number.isFinite(v)))return null;
  return {cuts:readableCuts(metric,[.2,.4,.6,.8].map(p=>quantile(values,p)),context.unit),direction:metricDirection(metric),n:values.length,
    title:"Pacific Player Comparison",unit:context.unit,
    note:`Same test, source, unit and period · ${context.period==="summer_2026"?"June–August 2026":"Fall 2026"}. Five bands split the recorded players into fifths; ties can leave a band empty. This is a team comparison, not a D3 standard.`};
}
export function statBenchmark(metric:string,context:StatGuideContext={}):Benchmark|null {
  const key=benchmarkMetric(metric),scope=context.scope??"player";
  const catalog=reference[scope] as Record<string,{cuts:number[];n:number;direction:"higher"|"lower"}>;
  if(catalog[key]){
    const b=catalog[key], batting=key.startsWith("batting_");
    return {...b,cuts:readableCuts(key,b.cuts,context.unit),title:`D3 Northwest Conference · 2025 ${scope==="team"?"Teams":"Players"}`,url:reference.source,unit:context.unit,
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
  if(context.unit&&!["mph","deg","s","kw","%"].includes(context.unit))return null;
  if(!(context.source==="blast_fall"||/^blast motion · average · /i.test(context.source??"")))return null;
  return ({avg_bat_speed:"College bat speed: 66–75 mph",blast_peak_hand_speed:"College peak hand speed: 21–25 mph",blast_attack_angle:"College attack angle: 2–15°",blast_vertical_bat_angle:"Vertical bat angle: −40 to −10°; depends on pitch location",blast_early_connection:"Early connection target: 90° (reference window 80–105°)",blast_connection_impact:"Connection at impact target: 90° (reference window 80–95°)",blast_time_to_contact:"College time to contact: 0.14–0.17 s",blast_power:"College power: 3.83–5.074 kW",blast_on_plane_efficiency:"On-plane efficiency target: 70% or more"} as Record<string,string>)[metric]??null;
}
/** Published session means, not percentile cutoffs or maximum-velocity targets. */
export function collegePitchReference(metric:string,context:StatGuideContext) {
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
  return ["innings_outs","earned_runs","hh_base_hit","hh_extra_base_hit","three_eight_hh","qpa","eight_plus_pitches","moving_runner","ab_control","fb","fb_k","ch","ch_k","bb_pitch_family","bb_pitch_family_k","baf","fps","weak_contact","hard_contact"].includes(metric)||/(?:^|_)(?:count|pa|ab|pitches|strikes|hits|rbi|pumps|sb|gdp|k|bb|h|r|hbp|sac_fly|sac_bunt)$/.test(metric)||["pearson_r","r_squared","spray_chart","hitter_contact_chart","pitch_arsenal_chart","pitching_contact_chart","pitch_splits"].includes(metric);
}
