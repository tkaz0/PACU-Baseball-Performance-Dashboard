import { expect, it } from "vitest";
import { analyticsBlastFallReadings } from "@/lib/analytics-blast-fall";
import { analyticsVariables, resolveAnalyticsVariableKey, variableKey, type AnalyticsReading } from "@/lib/analytics";
import { BLAST_FALL_SOURCE, BLAST_REPORT_METRICS, blastSource } from "@/lib/blast-metrics";
import type { Measurement } from "@/lib/imports/engine";
const player="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function report(start:string,end:string,n:number,value:number,hash:string,kind:"average"|"p95"="average") {
 return BLAST_REPORT_METRICS.map(metric=>({id:`fictional-${hash}-${metric.column}`,athlete_code:player,metric:metric.label,unit:metric.unit,value:metric.column===2?n:metric.signed?-value:value,measured_at:end,source:blastSource(kind,start,end),file_hash:hash.repeat(64),source_file:"fictional.csv",source_sheet:"CSV",source_row:2} satisfies Measurement));
}
const analytics=(rows:Measurement[]):AnalyticsReading[]=>rows.map(row=>({id:row.id,athleteId:row.athlete_code,metric:BLAST_REPORT_METRICS.find(m=>m.label===row.metric)!.key,label:row.metric,unit:row.unit,value:row.value,date:row.measured_at,source:row.source,importedAt:`${row.measured_at}T12:00:00Z`}));
it("combines every average metric by swing count; P95, vendors and raw provenance stay separate",()=>{
 const rows=[...report("2026-09-13","2026-09-20",10,60,"a"),...report("2026-09-21","2026-09-27",30,80,"b"),...report("2026-09-21","2026-09-27",30,99,"c","p95")];
 const raw=analytics(rows),other={...raw[1],id:"other",source:"Full Swing · Practice",value:100};
 const result=analyticsBlastFallReadings([...raw,other],rows,"2026-10-05");
 expect(result).toHaveLength(14);expect(result.find(r=>r.source===BLAST_FALL_SOURCE&&r.metric==="avg_bat_speed")).toMatchObject({value:75,date:"2026-09-27",basis:"fall-average"});
 expect(result.find(r=>r.metric==="blast_vertical_bat_angle")).toMatchObject({value:-75});expect(result).toContainEqual(other);
 expect(result.some(r=>/P95/.test(r.source)||r.metric==="blast_swing_count")).toBe(false);
 expect(JSON.stringify(result)).not.toContain("file_hash");expect(rows[1].value).toBe(60);
 const variables=analyticsVariables(result),old=variableKey(raw[1]);
 expect(variables.filter(v=>v.metric==="avg_bat_speed"&&v.source===BLAST_FALL_SOURCE)).toHaveLength(1);
 expect(resolveAnalyticsVariableKey(old,variables)).toBe(variableKey(result.find(r=>r.source===BLAST_FALL_SOURCE&&r.metric==="avg_bat_speed")!));
 expect(resolveAnalyticsVariableKey(variableKey({...raw[1],source:blastSource("p95","2026-09-13","2026-09-20")}),variables)).not.toBe(resolveAnalyticsVariableKey(old,variables));
});
it("withholds missing metric coverage and invalid count/overlapping/duplicate reports instead of latest-week fallback",()=>{
 const first=report("2026-09-13","2026-09-20",10,60,"a"),second=report("2026-09-21","2026-09-27",30,80,"b");
 const missing=[...first,...second.filter(r=>r.metric!=="Average Bat Speed")];
 expect(analyticsBlastFallReadings(analytics(missing),missing,"2026-10-05").some(r=>r.metric==="avg_bat_speed")).toBe(false);
 for(const rows of [[...first,...second.filter(r=>r.unit!=="count")],[...first,...report("2026-09-20","2026-09-27",30,80,"b")],[...first,...report("2026-09-13","2026-09-20",10,80,"b")]])expect(analyticsBlastFallReadings(analytics(rows),rows,"2026-10-05")).toEqual([]);
});
it("keeps player rollups independent and excludes future reports",()=>{
 const first=report("2026-09-13","2026-09-20",10,60,"a"),future=report("2026-10-06","2026-10-12",30,80,"b"),peer=first.map(r=>({...r,id:`peer-${r.id}`,athlete_code:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",value:r.unit==="count"?5:r.unit==="deg"?-50:50}));
 const rows=[...first,...future,...peer],result=analyticsBlastFallReadings(analytics(rows),rows,"2026-10-05");
 expect(result.filter(r=>r.metric==="avg_bat_speed").map(r=>r.value).sort()).toEqual([50,60]);
 expect(result.every(r=>r.date==="2026-09-20")).toBe(true);
});
