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
 it("accepts only the owner-confirmed blank Week 3 contact headers without changing capture cells",()=>{
  const f=fixture();f.snapshot.detailRows[0]=113;
  for(const c of f.snapshot.cells){if(c.row===40)c.row=113;else if(c.row===39){c.row=112;if(c.column>=24)delete c.entered;}else if(c.row===38){c.row=111;c.entered="FALL BALL WEEK 3 PITCHING STATS";}}
  Object.assign(f.events[0],{headerRow:112,firstRow:113,lastRow:113,eventId:"fall-2026-week-3"});
  const original=JSON.stringify(f.snapshot),p=f.run();expect(p.canImport).toBe(true);expect(JSON.stringify(f.snapshot)).toBe(original);
  expect(p.observations.find(r=>r.metric==="weak_contact")).toMatchObject({sourceRow:113,sourceColumn:24,value:2});
  f.snapshot.cells.find(c=>c.row===112&&c.column===24)!.entered="Different metric";
  expect(f.run().issues.some(i=>i.code==="header")).toBe(true);
 });
 it("still rejects blank contact headers in an unreviewed week",()=>{
  const f=fixture();for(const c of f.snapshot.cells)if(c.row===39&&c.column>=24)delete c.entered;
  expect(f.run().issues.some(i=>i.code==="header")).toBe(true);
 });
 it("imports weekly counts with no fabricated date and retains contact provenance",()=>{const f=fixture(),p=f.run();expect(p.canImport).toBe(true);expect(p.observations).toHaveLength(5);expect(p.observations.find(r=>r.metric==="weak_contact")).toMatchObject({value:2,sourceColumn:24,derivedFrom:[],playedOn:null,eventId:"fall-2026-week-1"});expect(validateGameImport(p,Date.parse(stamp)).observations).toHaveLength(5);expect(p.observations.some(r=>["k_pct","weak_contact_pct","innings"].includes(r.metric))).toBe(false);});
 it("rejects a mismatched week title, contact header, missing coverage and extra column",()=>{for(const kind of ["week","header","coverage","extra"]){const f=fixture();if(kind==="week")f.events[0].eventId="fall-2026-week-2";if(kind==="header")f.snapshot.cells.find(c=>c.row===39&&c.column===24)!.entered="Unknown";if(kind==="coverage")f.snapshot.cells=f.snapshot.cells.filter(c=>!(c.row===40&&c.column===25));if(kind==="extra")f.snapshot.cells.push({row:40,column:26,entered:1});expect(f.run().canImport).toBe(false);}});
 it("requires null dates only for reserved reviewed weeks",()=>{expect(validPitchingPeriod("fall-2026-week-1",null)).toBe(true);for(const [id,date]of [["fictional-game",null],["fall-2026-week-0",null],["fall-2026-week-1","2026-09-14"],["fictional-game","2026-09-31"]])expect(validPitchingPeriod(id,date)).toBe(false);expect(pitchingPeriodLabel("fall-2026-week-1",null)).toBe("Fall Ball · Week 1");});
 it("shows cumulative weekly overview without mixing dated games",()=>{const stats=fixture().run().observations.map(r=>({source:r.source,athlete_id:"fictional",metric:r.metric,value:r.value,unit:r.unit,scope:r.scope,event_id:r.eventId,played_on:r.playedOn,source_row:r.sourceRow,source_column:r.sourceColumn,derived_from:r.derivedFrom,snapshot_id:"fictional-snapshot",fetched_at:stamp,content_hash:"a".repeat(64)})) as SharedGameStat[];expect(gameOverviewMetrics(stats,[]).find(r=>r.metric==="strike_pct")).toMatchObject({value:60,eventId:"fall-2026-cumulative",playedOn:null});const week2=stats.map(r=>({...r,event_id:"fall-2026-week-2"}));expect(gameOverviewMetrics([...stats,...week2],[]).every(r=>r.eventId==="fall-2026-cumulative")).toBe(true);expect(gameOverviewMetrics([...stats,...stats.map(r=>({...r,event_id:"fictional-game",played_on:"2026-09-14"}))],[])).toEqual([]);});
});

it("keeps BWS separate and maps its S&M/HRD/WK columns without inventing earned runs",()=>{
 const f=fixture();f.snapshot.fetchedAt="2026-10-27T22:00:00Z";f.snapshot.detailRows[0]=151;
 for(const c of f.snapshot.cells){if(c.row===40)c.row=151;else if(c.row===39)c.row=150;else if(c.row===38){c.row=149;c.entered="FALL BALL BOXER WORLD SERIES PITCHING STATS";}}
 f.snapshot.cells.find(c=>c.row===150&&c.column===24)!.entered="S&M";
 f.snapshot.cells.find(c=>c.row===150&&c.column===25)!.entered="HRD";
 f.snapshot.cells.push({row:150,column:26,entered:"WK"},{row:151,column:26,entered:4});
 Object.assign(f.events[0],{headerRow:150,firstRow:151,lastRow:151,eventId:"fall-2026-bws"});
 const parse=()=>parseGameSource(f.snapshot,{...f.snapshot,detailRows:[151]},[{sourceName:"Fictional Pitcher",athleteCode:"PAC-0001"}],f.events,Date.parse(f.snapshot.fetchedAt));
 const p=parse();expect(p.canImport).toBe(true);expect(p.observations.find(r=>r.metric==="swing_miss")).toMatchObject({value:2,sourceColumn:24});expect(p.observations.find(r=>r.metric==="weak_contact")).toMatchObject({value:4,sourceColumn:26});expect(p.observations.some(r=>r.metric==="earned_runs")).toBe(false);
 expect(validateGameImport(p,Date.parse(f.snapshot.fetchedAt)).observations).toHaveLength(6);expect(pitchingPeriodLabel("fall-2026-bws",null)).toContain("Boxer World Series");
 expect(validPitchingPeriod("fall-2026-bws","2026-10-23")).toBe(false);expect(validPitchingPeriod("fall-2026-bws-other",null)).toBe(false);
 for(const change of [{metric:"weak_contact",sourceColumn:24},{metric:"earned_runs",sourceColumn:26},{metric:"swing_miss",sourceColumn:24,eventId:"fall-2026-week-4"}])expect(()=>validateGameImport({...p,observations:[{...p.observations.find(r=>r.metric==="weak_contact")!,...change}]},Date.parse(f.snapshot.fetchedAt))).toThrow();
 f.snapshot.cells.find(c=>c.row===149&&c.column===1)!.entered="FALL BALL WEEK 5 PITCHING STATS";expect(parse().canImport).toBe(false);
});
