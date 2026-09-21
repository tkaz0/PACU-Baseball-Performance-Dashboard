import { BLAST_MAIN_METRICS } from "@/lib/blast-fall";
import { PLAYER_METRICS } from "@/lib/player-performance";
export type HittingTeamAverage = {
  metricKey:string;unit:string;source:string;method:"player_mean"|"swing_weighted";
  value:number;athleteCount:number;swingCount:number|null;firstDate:string;lastDate:string;
};
const fullSwingKeys = ["max_exit_velocity","avg_exit_velocity","bat_speed","max_bat_speed","avg_bat_speed","smash_factor","max_distance"];
const fields = ["metricKey","unit","source","method","value","athleteCount","swingCount","firstDate","lastDate"].sort().join();
const validDate = (v:unknown):v is string => typeof v==="string" && /^2026-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v && v>="2026-09-01" && v<="2026-12-31";
export function parseHittingTeamAverages(data:unknown):HittingTeamAverage[] {
  const fail=():never=>{throw new Error("Team hitting averages could not be verified.");};
  if(!Array.isArray(data)||data.length>100)return fail();
  const seen=new Set<string>();
  return data.map(r=>{
    if(!r||typeof r!=="object"||Array.isArray(r)||Object.keys(r).sort().join()!==fields)return fail();
    if(!Number.isFinite(r.value)||!Number.isSafeInteger(r.athleteCount)||r.athleteCount<1||r.athleteCount>1000||!validDate(r.firstDate)||!validDate(r.lastDate)||r.firstDate>r.lastDate)return fail();
    if(r.source==="blast_fall"){
      const metric=BLAST_MAIN_METRICS.find(m=>m.key===r.metricKey);
      if(!metric||r.unit!==metric.unit||r.method!=="swing_weighted"||!Number.isSafeInteger(r.swingCount)||r.swingCount<r.athleteCount||(r.value<0&&!metric.signed))return fail();
    }else{
      const metric=PLAYER_METRICS.find(m=>m.key===r.metricKey);
      if(!fullSwingKeys.includes(r.metricKey)||!metric?.units.includes(r.unit)||!/^full swing · (game|intrasquad|practice|hitting)$/.test(r.source)||r.method!=="player_mean"||r.swingCount!==null||r.value<0)return fail();
    }
    const key=JSON.stringify([r.metricKey,r.unit,r.source]);if(seen.has(key))return fail();seen.add(key);
    return r as HittingTeamAverage;
  });
}
export function hittingTeamAverage(rows:readonly HittingTeamAverage[],key:string,unit:string,source:string) {
  const canonical=source.trim().toLowerCase().replace(/\s+/g," ");
  return rows.find(r=>r.metricKey===key&&r.unit===unit&&r.source===canonical);
}
