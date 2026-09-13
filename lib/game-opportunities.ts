import type { SharedGameStat } from "@/lib/game-server";

/** Labels describe recorded denominators, separately from the percentile's teammate count. */
export function gameOpportunityLabel(source:string,metric:string):string|null {
 if(source==="pitching_fall_2026")return metric==="strike_pct"?"pitches":null;
 if(source!=="qpa_fall_2026")return null;
 if(metric==="batting_avg")return "AB";
 if(metric==="batting_obp")return "OBP opportunities";
 if(metric==="batting_hh_pct")return "HH opportunities";
 return ["batting_bb_pct","batting_k_pct","batting_hr_pct","qpa_pct","pumps","sb","gdp","rbi","base_hit"].includes(metric)?"PA":null;
}
export function gameOpportunities(rows:readonly SharedGameStat[],source:string,metric:string,eventId:string|null=null):number|null {
 const relevant=rows.filter(r=>r.source===source&&(r.event_id??null)===eventId);
 if(!gameOpportunityLabel(source,metric)||!relevant.length||new Set(relevant.map(r=>r.athlete_id)).size!==1||new Set(relevant.map(r=>r.snapshot_id)).size!==1)return null;
 const values=new Map<string,number>();
 for(const r of relevant){if(values.has(r.metric)||!Number.isFinite(r.value)||r.value<0)return null;values.set(r.metric,r.value);}
 const keys=source==="pitching_fall_2026"?["pitches"]:metric==="batting_avg"?["ab"]:metric==="batting_obp"?["ab","bb","hbp","sac_fly"]:metric==="batting_hh_pct"?["ab","punchies","sac_bunt"]:["pa"];
 if(keys.some(k=>!values.has(k)))return null;
 const n=metric==="batting_hh_pct"?values.get("ab")!-values.get("punchies")!-values.get("sac_bunt")!:keys.reduce((sum,k)=>sum+values.get(k)!,0);
 return Number.isSafeInteger(n)&&n>0?n:null;
}
