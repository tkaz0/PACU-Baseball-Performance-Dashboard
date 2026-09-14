import { describe, expect, it } from "vitest";
import { parseGameSource, PITCHING_HEADERS, pitchingPeriodLabel, validPitchingPeriod, type GameSourceCell } from "@/lib/game-source";
import { validateGameImport } from "@/lib/game-import";
import { gameOverviewMetrics } from "@/lib/game-overview";
import type { SharedGameStat } from "@/lib/game-server";
const stamp="2026-09-14T17:00:00Z";
function fixture(){
 const contract={source:"pitching_fall_2026" as const,spreadsheetId:"fictional-sheet",sheetId:0,sheetTitle:"FALL",detailRows:[40]};
 const cells:GameSourceCell[]=[...PITCHING_HEADERS.map((entered,i)=>({row:2,column:i+1,entered})),...PITCHING_HEADERS.map((entered,i)=>({row:39,column:i+1,entered})),{row:38,column:1,entered:"FALL BALL WEEK 1 PITCHING STATS"},{row:39,column:24,entered:"Wk"},{row:39,column:25,entered:"Hrd"},...Array.from({length:25},(_,i)=>({row:40,column:i+1}))];
 for(const [column,entered]of [[1,"Fictional Pitcher"],[3,20],[4,12],[24,2],[25,1]] as const)cells.find(c=>c.row===40&&c.column===column)!.entered=entered;
 const snapshot={...contract,fetchedAt:stamp,contentHash:"a".repeat(64),cells};
 const events=[{headerRow:39,firstRow:40,lastRow:40,eventId:"fall-2026-week-1",playedOn:null}];
 const run=()=>parseGameSource(snapshot,contract,[{sourceName:"Fictional Pitcher",athleteCode:"PAC-0001"}],events,Date.parse(stamp));
 return {snapshot,events,run};
}
describe("reviewed weekly pitching",()=>{
 it("imports weekly counts with no fabricated date and retains contact provenance",()=>{const f=fixture(),p=f.run();expect(p.canImport).toBe(true);expect(p.observations).toHaveLength(5);expect(p.observations.find(r=>r.metric==="weak_contact")).toMatchObject({value:2,sourceColumn:24,derivedFrom:[],playedOn:null,eventId:"fall-2026-week-1"});expect(validateGameImport(p,Date.parse(stamp)).observations).toHaveLength(5);expect(p.observations.some(r=>["k_pct","weak_contact_pct","innings"].includes(r.metric))).toBe(false);});
 it("rejects a mismatched week title, contact header, missing coverage and extra column",()=>{for(const kind of ["week","header","coverage","extra"]){const f=fixture();if(kind==="week")f.events[0].eventId="fall-2026-week-2";if(kind==="header")f.snapshot.cells.find(c=>c.row===39&&c.column===24)!.entered="Unknown";if(kind==="coverage")f.snapshot.cells=f.snapshot.cells.filter(c=>!(c.row===40&&c.column===25));if(kind==="extra")f.snapshot.cells.push({row:40,column:26,entered:1});expect(f.run().canImport).toBe(false);}});
 it("requires null dates only for reserved reviewed weeks",()=>{expect(validPitchingPeriod("fall-2026-week-1",null)).toBe(true);for(const [id,date]of [["fictional-game",null],["fall-2026-week-0",null],["fall-2026-week-1","2026-09-14"],["fictional-game","2026-09-31"]])expect(validPitchingPeriod(id,date)).toBe(false);expect(pitchingPeriodLabel("fall-2026-week-1",null)).toBe("Fall Ball · Week 1");});
 it("shows the latest weekly overview without combining periods",()=>{const stats=fixture().run().observations.map(r=>({source:r.source,athlete_id:"fictional",metric:r.metric,value:r.value,unit:r.unit,scope:r.scope,event_id:r.eventId,played_on:r.playedOn,source_row:r.sourceRow,source_column:r.sourceColumn,derived_from:r.derivedFrom,snapshot_id:"fictional-snapshot",fetched_at:stamp,content_hash:"a".repeat(64)})) as SharedGameStat[];expect(gameOverviewMetrics(stats,[]).find(r=>r.metric==="strike_pct")).toMatchObject({value:60,eventId:"fall-2026-week-1",playedOn:null});const week2=stats.map(r=>({...r,event_id:"fall-2026-week-2"}));expect(gameOverviewMetrics([...stats,...week2],[]).every(r=>r.eventId==="fall-2026-week-2")).toBe(true);expect(gameOverviewMetrics([...stats,...stats.map(r=>({...r,event_id:"fictional-game",played_on:"2026-09-14"}))],[])).toEqual([]);});
});
