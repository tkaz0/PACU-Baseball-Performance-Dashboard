import { qpaBattingCounts, qpaSheetAB } from "@/lib/qpa-at-bats";
import type { SharedGameStat } from "@/lib/game-server";

/** Labels describe recorded denominators, separately from the percentile's teammate count. */
export function gameOpportunityLabel(source:string,metric:string):string|null {
 if(source==="pitching_fall_2026")return ["pitching_k9","pitching_bb9","pitching_r9","pitching_whip"].includes(metric)?"outs":metric==="pitching_k_bb"?"walks":metric==="strike_pct"?"pitches":["weak_contact_pct","hard_contact_pct"].includes(metric)?"classified contacts":null;
 if(source!=="qpa_fall_2026")return null;
 if(["batting_avg","batting_est_slg","batting_est_iso"].includes(metric))return "AB";
 if(metric==="batting_est_wobacon")return "contacts";
 if(metric==="batting_obp")return "OBP opportunities";
 if(metric==="batting_hh_pct")return "HH opportunities";
 return ["batting_production_plus","batting_sb_per_pa","batting_bb_pct","batting_k_pct","batting_hr_pct","qpa_pct","pumps","sb","gdp","rbi","base_hit"].includes(metric)?"PA":null;
}
export function gameOpportunities(rows:readonly SharedGameStat[],source:string,metric:string,eventId:string|null=null):number|null {
 const relevant=rows.filter(r=>r.source===source&&(r.event_id??null)===eventId);
 if(!gameOpportunityLabel(source,metric)||!relevant.length||new Set(relevant.map(r=>r.athlete_id)).size!==1||new Set(relevant.map(r=>r.snapshot_id)).size!==1)return null;
 let values=new Map<string,number>();
 for(const r of relevant){if(values.has(r.metric)||!Number.isFinite(r.value)||r.value<0)return null;values.set(r.metric,r.value);}
 if(source==="qpa_fall_2026")values=qpaBattingCounts(values);
 const keys=source==="pitching_fall_2026"?(gameOpportunityLabel(source,metric)==="classified contacts"?["weak_contact","hard_contact"]:[gameOpportunityLabel(source,metric)==="outs"?"innings_outs":metric==="pitching_k_bb"?"bb_outcome":"pitches"]):["batting_avg","batting_est_slg","batting_est_iso"].includes(metric)?["ab"]:metric==="batting_est_wobacon"?["ab","punchies","sac_fly"]:metric==="batting_obp"?["ab","bb","hbp","sac_fly"]:metric==="batting_hh_pct"?["ab","punchies","sac_bunt"]:["pa"];
 if(keys.some(k=>!values.has(k)))return null;
 const n=metric==="batting_est_wobacon"?values.get("ab")!-values.get("punchies")!+values.get("sac_fly")!:metric==="batting_hh_pct"?qpaSheetAB(values)!-values.get("punchies")!-values.get("sac_bunt")!:keys.reduce((sum,k)=>sum+values.get(k)!,0);
 return Number.isSafeInteger(n)&&n>0?n:null;
}
/** "1 walk", "2 walks"; abbreviations such as PA/AB stay as written. */
export function countLabel(count:number|string,label:string):string{
 const n=typeof count==="number"?count:Number(String(count).replace(/,/g,""));
 const text=typeof count==="number"?count.toLocaleString("en-US"):count;
 if(n!==1)return `${text} ${label}`;
 const singular=label.replace(/(\w+)$/,word=>/^[a-z]/.test(word)?word.replace(/ies$/,"y").replace(/(ch|sh|x)es$/,"$1").replace(/s$/,""):word);
 return `${text} ${singular}`;
}
/** "4 PA", "2.0 IP", "47 pitches": the real denominator behind a game rate, or null when it has none. */
export function gameSampleText(source:string,metric:string,count:number|null|undefined):string|null{
 const label=gameOpportunityLabel(source,metric);
 if(!label||count==null||count<=0)return null;
 return label==="outs"?`${Math.floor(count/3)}.${count%3} IP`:countLabel(count,label);
}
/** Same thresholds as the LimitedSample tag: under 50 pitches or 20 other opportunities. Outs and walks are never tagged. */
export function isEarlyGameSample(source:string,metric:string,count:number|null|undefined):boolean{
 const label=gameOpportunityLabel(source,metric);
 if(!label||count==null||count<=0||label==="outs"||label==="walks")return false;
 return count<(label==="pitches"?50:20);
}
