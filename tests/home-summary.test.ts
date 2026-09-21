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
