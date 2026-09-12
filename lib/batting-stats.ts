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
  return rates;
}
export const formatBattingRate = (rate:BattingRate) => rate.unit==="%"?`${rate.value.toFixed(1)}%`:rate.value.toFixed(3).replace(/^0\./,".");
