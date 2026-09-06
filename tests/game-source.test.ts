import { beforeEach,afterEach,describe,expect,it,vi } from "vitest";
import { parseGameSource,QPA_HEADERS,PITCHING_HEADERS,type GameSourceSnapshot,type ReviewedGameSource,type GameSourceCell } from "@/lib/game-source";
const identities=[{sourceName:"Fictional Player",athleteCode:"PAC-0001"}];
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date("2026-09-13T12:00:00Z"));});
afterEach(()=>vi.useRealTimers());
function fixture(pitching=false) {
  const contract:ReviewedGameSource={source:pitching?"pitching_fall_2026":"qpa_fall_2026",spreadsheetId:"fictional-sheet",sheetId:1,sheetTitle:pitching?"FALL":"2026 - Fall",detailRows:[pitching?40:2]};
  const row=contract.detailRows[0], headers=pitching?PITCHING_HEADERS:QPA_HEADERS;
  const cells:GameSourceCell[]=Array.from({length:headers.length},(_,i)=>({row,column:i+1}));
  cells[0].entered="Fictional Player";
  for(const h of pitching?[2,39]:[1]) cells.push(...headers.map((entered,i)=>({row:h,column:i+1,entered})));
  const snapshot:GameSourceSnapshot={...contract,fetchedAt:"2026-09-12T23:00:00Z",contentHash:"a".repeat(64),cells};
  const set=(column:number,entered?:string|number,extra:Partial<GameSourceCell>={})=>Object.assign(cells.find(c=>c.row===row&&c.column===column)!,{entered,...extra});
  const events=pitching?[{headerRow:39,firstRow:40,lastRow:70,eventId:"fictional-game-1",playedOn:"2026-09-12"}]:[];
  return{contract,snapshot,set,events,run:()=>parseGameSource(snapshot,contract,identities,events)};
}
describe("source-grounded Fall game adapters",()=>{
  it("keeps prepared formula zeros and division errors missing when raw inputs are blank",()=>{
    for(const pitching of [false,true]) {const f=fixture(pitching);f.set(pitching?5:8,undefined,{formula:pitching?"=D40/C40":"=C2/B2",error:"DIVIDE_BY_ZERO",effective:0});const p=f.run();expect(p.observations).toEqual([]);expect(p.populatedRows).toBe(0);expect(p.canImport).toBe(false);}
  });
  it("preserves explicit zero and separates cumulative QPA totals from game dates",()=>{
    const f=fixture();f.set(2,4);f.set(3,0);f.set(8,undefined,{formula:"=C2/B2"});const p=f.run();expect(p.canImport).toBe(true);
    expect(p.observations.find(x=>x.metric==="qpa_pct")).toMatchObject({value:0,unit:"%",scope:"cumulative_fall",eventId:null,playedOn:null,derivedFrom:[3,2]});
  });
  it("never fabricates a rate from a missing count or denominator zero",()=>{
    for(const denominator of [undefined,0]) {const f=fixture();f.set(2,denominator);f.set(3,0);expect(f.run().observations.some(x=>x.metric==="qpa_pct")).toBe(false);}
  });
  it.each([-1,1.5,"4","#DIV/0!",Number.NaN,Number.POSITIVE_INFINITY])("rejects invalid raw count %#",value=>{const f=fixture();f.set(2,value);expect(f.run().canImport).toBe(false);expect(f.run().issues.some(x=>x.code==="raw_value")).toBe(true);});
  it("rejects formulas entered where actual raw counts belong",()=>{const f=fixture();f.set(2,undefined,{formula:"=SUM(B3:B5)",effective:10});expect(f.run().canImport).toBe(false);});
  it("treats pitcher K% as strikes/pitches and disambiguates both BB columns by position",()=>{
    const f=fixture(true);f.set(3,20);f.set(4,10);f.set(9,6);f.set(21,1);f.set(5,undefined,{formula:"=D40/C40"});const p=f.run();expect(p.canImport).toBe(true);
    expect(p.observations.find(x=>x.metric==="strike_pct")).toMatchObject({value:50,playedOn:"2026-09-12",scope:"pitching_event"});
    expect(p.observations.find(x=>x.metric==="bb_pitch_family")?.value).toBe(6);expect(p.observations.find(x=>x.metric==="bb_outcome")?.value).toBe(1);
    expect(p.observations.some(x=>x.metric==="k_pct"||x.metric==="bb_pct"||x.metric==="era")).toBe(false);
  });
  it("requires reviewed pitcher events and never invents a date from the snapshot timestamp",()=>{const f=fixture(true);f.set(3,1);expect(parseGameSource(f.snapshot,f.contract,identities).issues.some(x=>x.code==="unmapped_event")).toBe(true);f.events[0].playedOn="2026-08-31";expect(f.run().canImport).toBe(false);});
  it.each(["2026-09-01","2026-09-11"])("accepts actual Fall game date %s before the daily sync start",playedOn=>{const f=fixture(true);f.set(3,1);f.events[0].playedOn=playedOn;expect(f.run().canImport).toBe(true);expect(f.run().observations[0].playedOn).toBe(playedOn);});
  it("does not guess innings decimals or outs and preserves other explicit counts",()=>{const f=fixture(true);f.set(3,1);f.set(18,1.2);const p=f.run();expect(p.canImport).toBe(true);expect(p.issues.find(x=>x.code==="innings")?.severity).toBe("review");expect(p.observations.some(x=>x.sourceColumn===18)).toBe(false);});
  it("requires an exact reviewed name and rejects duplicate mapping identities",()=>{
    const f=fixture();f.set(2,1);expect(parseGameSource(f.snapshot,f.contract,[{sourceName:"Player",athleteCode:"PAC-0001"}]).canImport).toBe(false);
    expect(parseGameSource(f.snapshot,f.contract,[...identities,...identities]).canImport).toBe(false);
  });
  it("fails closed on partial coverage, duplicate coordinates, changed headers and wrong tabs",()=>{
    for(const mutate of [(f:ReturnType<typeof fixture>)=>f.snapshot.cells.pop(),(f:ReturnType<typeof fixture>)=>f.snapshot.cells.push(f.snapshot.cells[0]),(f:ReturnType<typeof fixture>)=>f.snapshot.sheetTitle="Other tab",(f:ReturnType<typeof fixture>)=>f.snapshot.cells.find(c=>c.row===1&&c.column===2)!.entered="Different"]){const f=fixture();f.set(2,1);mutate(f);expect(f.run().canImport).toBe(false);}
    const f=fixture();f.set(2,1);f.snapshot.cells=f.snapshot.cells.filter(c=>!(c.row===2&&c.column===26));expect(f.run().issues.some(x=>x.code==="coverage")).toBe(true);
  });
  it("blocks changed rate formulas or a numerator above denominator",()=>{
    const f=fixture();f.set(2,1);f.set(3,2);expect(f.run().canImport).toBe(false);f.set(3,1);f.set(8,undefined,{formula:"=B2/C2"});expect(f.run().issues.some(x=>x.code==="rate_formula")).toBe(true);
  });
});
