import type { Measurement } from "@/lib/imports/engine";

export const PLAYER_METRICS_HEADERS = ["Player", "Height", "Weight", "BOXER T-TEST (1)", "BOXER T-TEST (2)", "BOXER T-TEST (3)", "HOME to 1ST", "HOME to 2ND", "12 FT STEAL START (1)", "12 FT STEAL START (2)", "12 FT STEAL START (3)", "STEAL START (RXN) (1)", "STEAL START (RXN) (2)", "STEAL START (RXN) (3)", "STEAL START (12-42FT) (1)", "STEAL START (12-42FT) (2)", "STEAL START (12-42FT) (3)", "GRIP (DOM)", "GRIP (NON DOM)"] as const;
const columns: Record<number,string> = {3:"Boxer T",4:"Boxer T",5:"Boxer T",6:"Home to First",7:"Home to Second",8:"12 ft Steal Start",9:"12 ft Steal Start",10:"12 ft Steal Start",11:"Steal Reaction",12:"Steal Reaction",13:"Steal Reaction",14:"Steal Start · 12–42 ft",15:"Steal Start · 12–42 ft",16:"Steal Start · 12–42 ft",17:"Dominant Grip",18:"Non-Dominant Grip"};
type Input = { rows: unknown[][]; sheet: string; measuredAt: string; fileHash: string; identities: ReadonlyMap<string,string>; gripUnit?: "lb" | "kg" | "N"; columnDates?: Readonly<Record<number,string>> };
/** Explicitly reviewed dates and identities only. Raw numeric trials, never cached summaries. */
export function preparePlayerMetricsTrials({rows,sheet,measuredAt,fileHash,identities,gripUnit,columnDates={}}:Input) {
  if(sheet!=="Test Day Results" || !/^2026-\d{2}-\d{2}$/.test(measuredAt) || !Number.isFinite(Date.parse(measuredAt)) || new Date(measuredAt).toISOString().slice(0,10)!==measuredAt || measuredAt<"2026-09-01" || measuredAt>"2026-12-31" || !/^[a-f0-9]{64}$/.test(fileHash)) throw new Error("Review the source tab, Fall testing date and file fingerprint.");
  if(!Array.isArray(rows)||!rows.length||rows.length>1000 || PLAYER_METRICS_HEADERS.some((h,i)=>String(rows[0]?.[i]??"").trim()!==h) || rows.some(row=>!Array.isArray(row)||row.length>19)) throw new Error("Player Metrics columns changed. Review the workbook before importing.");
  const validDate=(date:string)=>/^2026-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date&&date>="2026-09-01"&&date<="2026-12-31";
  if(Object.entries(columnDates).some(([column,date])=>!Object.hasOwn(columns,column)||!validDate(date)))throw new Error("Review the per-column testing dates.");
  const measurements:Measurement[]=[],pendingRows:number[]=[],excludedRows:number[]=[],seen=new Set<string>();
  for(let index=1;index<rows.length;index++) {
    const row=rows[index],trials=Object.entries(columns).filter(([column])=>row[Number(column)]!==null&&row[Number(column)]!==undefined&&row[Number(column)]!=="");
    if(!trials.length)continue;
    if(typeof row[0]!=="string"||!row[0].trim())throw new Error(`Row ${index+1} needs a player label.`);
    const label=row[0].trim().replace(/\s+/g," ").toLowerCase(),code=identities.get(label);
    if(!code){pendingRows.push(index+1);continue;}
    if(code==="exclude"){excludedRows.push(index+1);continue;}
    if(!/^PAC-\d{4,9}$/.test(code)||seen.has(code))throw new Error(`Row ${index+1} needs a unique reviewed player match.`);
    seen.add(code);
    for(const [column,metric] of trials) {
      const value=row[Number(column)];
      if(typeof value!=="number"||!Number.isFinite(value)||value<=0)throw new Error(`Row ${index+1}, column ${Number(column)+1}: review the recorded measurement. Blanks are allowed; zero, text and formulas are not trials.`);
      const grip=Number(column)>=17;
      if(grip&&(!gripUnit||!["lb","kg","N"].includes(gripUnit)))throw new Error("Confirm the grip measurement unit before importing.");
      measurements.push({id:`observation:${JSON.stringify([fileHash,sheet,index+1,Number(column)])}`,athlete_code:code,metric,value,unit:grip?gripUnit!:"s",measured_at:columnDates[Number(column)]??measuredAt,source:"Player Metrics",source_file:"Player Metrics 2026-27.xlsx",source_sheet:sheet,source_row:index+1,file_hash:fileHash});
    }
  }
  return {measurements,pendingRows,excludedRows};
}
