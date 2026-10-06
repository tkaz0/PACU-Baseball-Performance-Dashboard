import {expect,it} from "vitest";
import {buildHomeSummary,type HomeReading} from "@/lib/home-summary";
const reading=(athleteId:string,source="RENPHO",date="2026-09-06"):HomeReading=>({athleteId,source,date,importedAt:"2026-09-07T20:00:00Z"});
it("counts unique authorized players and excludes summer/future readings",()=>{
 const model=buildHomeSummary(["a","b","c"],[reading("a"),reading("a"),reading("b","RENPHO","2026-08-06"),reading("c","RENPHO","2026-10-06"),reading("unrelated")],[],"2026-09-20");
 expect(model.players).toBe(3);expect(model.playersWithResults).toBe(1);expect(model.coverage[0].players).toBe(1);expect(model.updates).toHaveLength(1);
});
it("keeps practice and game coverage separate, with source dates distinct from saved dates",()=>{
 const model=buildHomeSummary(["a"],[reading("a","Blast Motion · Average · 2026-09-13:2026-09-20","2026-09-20"),reading("a","Full Swing · Intrasquad"),reading("a","Player Metrics")],[],"2026-09-20");
 expect(model.coverage.map(r=>r.players)).toEqual([0,1,1,1]);expect(model.coverage[2].lastTested).toBe("2026-09-20");expect(model.updates[0].date).toBe("2026-09-07T20:00:00Z");expect(model.batting.entries).toBe(0);
});
it("empty data has honest zero coverage and no invented updates or rates",()=>{
 const model=buildHomeSummary(["a"],[],[],"2026-09-20");expect(model.playersWithResults).toBe(0);expect(model.updates).toEqual([]);expect(model.batting.rates.every(r=>r.value===null)).toBe(true);
});
it("uses position and two-way cohorts for both testing/practice counts and denominators",()=>{
 const ids=["position","two-way","pitcher","unclassified"];
 const readings=ids.flatMap(id=>[reading(id,"Player Metrics"),reading(id,"Full Swing · Practice"),reading(id),reading(id,"Full Swing · Intrasquad")]);
 const model=buildHomeSummary(ids,readings,[],"2026-09-20",["position","two-way","outside"]);
 expect(model.coverage.map(row=>[row.players,row.eligiblePlayers])).toEqual([[4,4],[2,2],[2,2],[4,4]]);
 expect(model.players).toBe(4);expect(model.playersWithResults).toBe(4);
});
it("does not let pitcher-only practice/testing dates appear in position-player coverage",()=>{
 const model=buildHomeSummary(["position","pitcher"],[reading("pitcher","Full Swing · Practice"),reading("pitcher","Player Metrics")],[],"2026-09-20",["position"]);
 expect(model.coverage.filter(row=>row.positionOnly).every(row=>row.players===0&&row.eligiblePlayers===1&&row.lastTested===null&&row.updatedAt===null)).toBe(true);
 expect(model.updates).toEqual([]);expect(model.playersWithResults).toBe(1);
});
