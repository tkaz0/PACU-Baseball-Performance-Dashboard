import type { SharedGameStat } from "@/lib/game-server";
import type { GameComparison } from "@/lib/game-metrics";

// Fixed completed-season reference weights, not a locally calibrated run model.
// https://www.fangraphs.com/tools/guts?type=cn (2025 row)
export const CONTACT_WEIGHTS = { single: .882, double: 1.252, triple: 1.584, homeRun: 2.037 } as const;
export type AdvancedGameRate = { metric:string; label:string; value:number; unit:"avg"|"index"|"decimal"; opportunities:number; opportunityLabel:string };

export function gameCountMap(rows:readonly SharedGameStat[],source:SharedGameStat["source"]):Map<string,number>|null {
 const selected=rows.filter(r=>r.source===source);
 if(!selected.length||["athlete_id","snapshot_id","event_id"].some(key=>new Set(selected.map(r=>r[key as keyof SharedGameStat])).size!==1))return null;
 const v=new Map<string,number>();
 for(const r of selected){if(v.has(r.metric)||!Number.isFinite(r.value)||r.value<0||(r.unit==="count"&&!Number.isSafeInteger(r.value)))return null;v.set(r.metric,r.value);}
 return v;
}
/** XBH is all doubles/triples, excluding Pumps. No triple share is invented. */
export function battingPowerParts(v:ReadonlyMap<string,number>):{bases:number;weightedHits:number;weightedHitsUpper:number;ab:number;hits:number;xbh:number;hr:number}|null {
 const keys=["base_hit","hh_extra_base_hit","pumps","ab"];
 if(keys.some(k=>!Number.isSafeInteger(v.get(k))||v.get(k)!<0))return null;
 const [hits,xbh,hr,ab]=keys.map(k=>v.get(k)!);
 if(ab<=0||hits>ab||xbh+hr>hits)return null;
 const singles=hits-xbh-hr;
 return {hits,xbh,hr,ab,bases:hits+xbh+3*hr,
  weightedHits:CONTACT_WEIGHTS.single*singles+CONTACT_WEIGHTS.double*xbh+CONTACT_WEIGHTS.homeRun*hr,
  weightedHitsUpper:CONTACT_WEIGHTS.single*singles+CONTACT_WEIGHTS.triple*xbh+CONTACT_WEIGHTS.homeRun*hr};
}
export function productionParts(v:ReadonlyMap<string,number>):{top:number;bottom:number}|null {
 const p=battingPowerParts(v);if(!p)return null;
 if(["bb","hbp","pa","sac_fly"].some(k=>!Number.isSafeInteger(v.get(k))||v.get(k)!<0))return null;
 const bb=v.get("bb")!,hbp=v.get("hbp")!,pa=v.get("pa")!,sf=v.get("sac_fly")!;
 return pa>0&&p.ab+bb+hbp+sf<=pa?{top:p.bases+bb+hbp,bottom:pa}:null;
}
export function battingPowerRates(rows:readonly SharedGameStat[]):AdvancedGameRate[]{
 const v=gameCountMap(rows,"qpa_fall_2026"),p=v&&battingPowerParts(v);if(!v||!p)return [];
 const result:AdvancedGameRate[]=[
  {metric:"batting_est_slg",label:"SLG",value:p.bases/p.ab,unit:"avg",opportunities:p.ab,opportunityLabel:"AB"},
  {metric:"batting_est_iso",label:"ISO",value:(p.xbh+3*p.hr)/p.ab,unit:"avg",opportunities:p.ab,opportunityLabel:"AB"}
 ];
 const k=v.get("punchies"),sf=v.get("sac_fly");
 if(Number.isSafeInteger(k)&&Number.isSafeInteger(sf)&&k!>=0&&sf!>=0&&k!+p.hits<=p.ab){
  const contacts=p.ab-k!+sf!;
  if(contacts>0)result.push({metric:"batting_est_wobacon",label:"wOBAcon",value:p.weightedHits/contacts,unit:"avg",opportunities:contacts,opportunityLabel:"contacts"});
 }
 return result;
}
/** Index comes from the authorized, exact-snapshot server comparison, never peer raw rows. */
export function battingAdvancedRates(rows:readonly SharedGameStat[],comparisons:readonly GameComparison[]=[]):AdvancedGameRate[]{
 const rates=battingPowerRates(rows),qpa=rows.filter(r=>r.source==="qpa_fall_2026"),v=gameCountMap(qpa,"qpa_fall_2026"),p=v&&productionParts(v);
 const matches=comparisons.filter(c=>c.source==="qpa_fall_2026"&&c.metric==="batting_production_plus"&&c.eventId===""&&c.snapshotId===qpa[0]?.snapshot_id);
 if(p&&matches.length===1&&matches[0].sampleSize>=5&&Number.isFinite(matches[0].value)&&matches[0].value>=0)rates.unshift({metric:"batting_production_plus",label:"PAC Production+",value:matches[0].value,unit:"index",opportunities:p.bottom,opportunityLabel:"PA"});
 return rates;
}
/** Staff-only callers supply the already eligible roster projection. Do not fetch peer rows for a player. */
export function productionComparisons(stats:readonly SharedGameStat[]):Map<string,GameComparison>{
 const qpa=stats.filter(r=>r.source==="qpa_fall_2026"),output=new Map<string,GameComparison>();
 if(new Set(qpa.map(r=>r.snapshot_id)).size!==1)return output;
 const groups=[...new Set(qpa.map(r=>r.athlete_id))].flatMap(id=>{
  const rows=qpa.filter(r=>r.athlete_id===id),v=gameCountMap(rows,"qpa_fall_2026"),p=v&&productionParts(v);
  return p?[{id,snapshot:rows[0].snapshot_id,...p}]:[];
 });
 if(groups.length<5)return output;
 const baseline=groups.reduce((n,g)=>n+g.top,0)/groups.reduce((n,g)=>n+g.bottom,0);
 if(!(baseline>0))return output;
 for(const g of groups)output.set(g.id,{metric:"batting_production_plus",source:"qpa_fall_2026",eventId:"",value:100*(g.top/g.bottom)/baseline,percentile:null,sampleSize:groups.length,snapshotId:g.snapshot});
 return output;
}
export function pitchingExtraRates(rows:readonly SharedGameStat[]):AdvancedGameRate[]{
 const v=gameCountMap(rows,"pitching_fall_2026");if(!v)return [];
 const get=(key:string)=>Number.isSafeInteger(v.get(key))&&v.get(key)!>=0?v.get(key)!:null;
 const outs=get("innings_outs"),k=get("k"),bb=get("bb_outcome"),hits=get("h"),result:AdvancedGameRate[]=[];
 if(outs!==null&&outs>0&&bb!==null&&hits!==null)result.push({metric:"pitching_whip",label:"WHIP",value:3*(hits+bb)/outs,unit:"decimal",opportunities:outs,opportunityLabel:"outs"});
 // A zero-walk line remains visible in raw counts, but has no finite ratio/rank.
 if(k!==null&&bb!==null&&bb>0)result.push({metric:"pitching_k_bb",label:"K/BB",value:k/bb,unit:"decimal",opportunities:bb,opportunityLabel:"walks"});
 return result;
}
