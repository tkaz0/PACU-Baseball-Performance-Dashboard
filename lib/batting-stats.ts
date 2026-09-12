import type { SharedGameStat } from "@/lib/game-server";
export type BattingRate = { metric: string; label: string; value: number; unit: "avg" | "%" };
/** Owner-confirmed: Base Hit contains all hits; Pumps means home runs. HH fields overlap hits. */
export function battingRates(rows: readonly SharedGameStat[]): BattingRate[] {
  const qpa=rows.filter(r=>r.source==="qpa_fall_2026");
  if(!qpa.length||new Set(qpa.map(r=>r.athlete_id)).size!==1||new Set(qpa.map(r=>r.snapshot_id)).size!==1)return [];
  const values=new Map<string,number>();
  for(const row of qpa){if(values.has(row.metric)||!Number.isFinite(row.value)||row.value<0)return [];values.set(row.metric,row.value);}
  const rates:BattingRate[]=[];
  for(const [metric,label,topKey,bottomKey,unit] of [["batting_avg","AVG","base_hit","ab","avg"],["batting_bb_pct","BB %","bb","pa","%"],["batting_k_pct","K %","punchies","pa","%"]] as const){
    const top=values.get(topKey),bottom=values.get(bottomKey);
    if(top!==undefined&&bottom!==undefined&&bottom>0&&top<=bottom)rates.push({metric,label,value:(unit==="%"?100:1)*(top/bottom),unit});
  }
  const hit=values.get("base_hit"),ab=values.get("ab"),bb=values.get("bb"),hbp=values.get("hbp"),sf=values.get("sac_fly");
  if(hit!==undefined&&ab!==undefined&&bb!==undefined&&hbp!==undefined&&sf!==undefined&&hit<=ab&&ab+bb+hbp+sf>0)rates.push({metric:"batting_obp",label:"OBP",value:(hit+bb+hbp)/(ab+bb+hbp+sf),unit:"avg"});
  const hhKeys=["hh_base_hit","three_eight_hh","hh_extra_base_hit","pumps","ab","punchies","sac_bunt"];
  if(hhKeys.every(key=>values.has(key))){const top=values.get("hh_base_hit")!+values.get("three_eight_hh")!+values.get("hh_extra_base_hit")!+values.get("pumps")!,bottom=values.get("ab")!-values.get("punchies")!-values.get("sac_bunt")!;
    if(bottom>0&&top<=bottom)rates.push({metric:"batting_hh_pct",label:"HH %",value:100*top/bottom,unit:"%"});}
  return rates;
}
export const formatBattingRate = (rate:BattingRate) => rate.unit==="%"?`${rate.value.toFixed(1)}%`:rate.value.toFixed(3).replace(/^0\./,".");
