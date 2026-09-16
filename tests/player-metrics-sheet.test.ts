import { expect,it } from "vitest";
import { PLAYER_METRICS_HEADERS,preparePlayerMetricsTrials } from "@/lib/player-metrics-sheet";
import { getPlayerPerformance } from "@/lib/player-performance";
const input=()=>({rows:[[...PLAYER_METRICS_HEADERS],["Example",null,null,8,9,null,null,null,3.5,3.7]],sheet:"Test Day Results",measuredAt:"2026-09-15",fileHash:"a".repeat(64),identities:new Map([["example","PAC-0001"]])});
it("keeps distinct trial coordinates and computes best and average without blank zeros",()=>{
 const r=preparePlayerMetricsTrials(input());expect(r.measurements).toHaveLength(4);expect(new Set(r.measurements.map(m=>m.id)).size).toBe(4);
 const profile=getPlayerPerformance({readings:r.measurements,athleteCode:"PAC-0001"});
 expect(profile.hitting.find(c=>c.metric.key==="boxer_t")).toMatchObject({latest:{value:8},timedTrials:{count:2,average:8.5,lastTested:"2026-09-15"}});
 expect(profile.hitting.find(c=>c.metric.key==="steal_start_12ft")?.timedTrials?.average).toBeCloseTo(3.6);
 expect(profile.hitting.find(c=>c.metric.key==="steal_break")?.latest).toBeNull();
});
it.each([0,-1,"3.7","=AVERAGE(I2:J2)",NaN])("rejects invalid entered trial %s",value=>{const x=input();x.rows[1][8]=value as never;expect(()=>preparePlayerMetricsTrials(x)).toThrow();});
it("requires source shape, a real date and explicit identities",()=>{
 const x=input();expect(()=>preparePlayerMetricsTrials({...x,measuredAt:"2026-09-31"})).toThrow();expect(()=>preparePlayerMetricsTrials({...x,sheet:"Test Averages"})).toThrow();
 expect(preparePlayerMetricsTrials({...x,identities:new Map()}).pendingRows).toEqual([2]);
 expect(preparePlayerMetricsTrials({...x,identities:new Map([["example","exclude"]])}).measurements).toEqual([]);
 x.rows[0][8]="Changed";expect(()=>preparePlayerMetricsTrials(x)).toThrow();
});
