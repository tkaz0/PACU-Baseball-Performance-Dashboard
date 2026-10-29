import { describe,expect,it } from "vitest";
import { normalizeGameCapture,validateGameMappings } from "@/lib/game-capture";
import { parseGameSource,QPA_HEADERS } from "@/lib/game-source";
const now=Date.parse("2026-09-13T12:00:00Z");
const contract={source:"qpa_fall_2026" as const,spreadsheetId:"fictional-source",sheetId:7,sheetTitle:"2026 - Fall",detailRows:[2]};
const shape={rows:4,columns:29,range:"'2026 - Fall'!A1:AC4"};
function fixture(){return{source:contract.source,range:shape.range,fetchedAt:"2026-09-13T11:00:00Z",response:{spreadsheetId:contract.spreadsheetId,sheets:[{properties:{sheetId:7,title:contract.sheetTitle,gridProperties:{rowCount:4,columnCount:29}},data:[{rowData:[{values:QPA_HEADERS.map(stringValue=>({userEnteredValue:{stringValue}}))},{values:[{userEnteredValue:{stringValue:"Fictional Player"}},{userEnteredValue:{numberValue:0}},{},{},{},{},{},{userEnteredValue:{formulaValue:"=C2/B2"},effectiveValue:{errorValue:{type:"DIVIDE_BY_ZERO"}}}]}]}]}]}};}
const mapping=()=>({version:1,reviewed:true,source:contract.source,spreadsheetId:contract.spreadsheetId,sheetId:7,sheetTitle:contract.sheetTitle,reviewedAt:"2026-09-13T11:00:00Z",identities:[{sourceName:"Fictional Player",athleteCode:"PAC-0001"}],events:[]});
describe("complete private source captures",()=>{
 it("fills only declared complete grid blanks while preserving zero, formulas and errors",()=>{const captured=normalizeGameCapture(fixture(),contract,shape,now);expect(captured.cells).toHaveLength(116);expect(captured.cells.find(c=>c.row===2&&c.column===2)?.entered).toBe(0);expect(captured.cells.find(c=>c.row===2&&c.column===8)).toMatchObject({formula:"=C2/B2",error:"DIVIDE_BY_ZERO"});expect(captured.cells.find(c=>c.row===4&&c.column===26)).toEqual({row:4,column:26});});
 it("requires exact source, single authorized tab, grid metadata and full range receipt",()=>{for(const change of [(f:ReturnType<typeof fixture>)=>f.range="'2026 - Fall'!A1:Z2",(f:ReturnType<typeof fixture>)=>f.response.spreadsheetId="other",(f:ReturnType<typeof fixture>)=>f.response.sheets.push(f.response.sheets[0]),(f:ReturnType<typeof fixture>)=>f.response.sheets[0].properties.title="Other tab",(f:ReturnType<typeof fixture>)=>f.response.sheets[0].properties.gridProperties.rowCount=5,(f:ReturnType<typeof fixture>)=>f.fetchedAt="2026-09-14T12:00:00Z"]){const f=fixture();change(f);expect(()=>normalizeGameCapture(f,contract,shape,now)).toThrow();}});
 it("rejects offset, duplicate/chunk ranges, unknown value types and out-of-range cells",()=>{for(const data of [{startRow:1,rowData:[]},{rowData:[{values:Array(30).fill({})}]},{rowData:[{values:[{userEnteredValue:{boolValue:true}}]}]}]){const f=fixture();Object.assign(f.response.sheets[0].data[0],data);expect(()=>normalizeGameCapture(f,contract,shape,now)).toThrow();}});
 it("will not treat new numeric rows as silently ignored summaries",()=>{const capture=normalizeGameCapture(fixture(),contract,shape,now);capture.cells.find(c=>c.row===4&&c.column===2)!.entered=1;const parsed=parseGameSource({...capture,contentHash:"a".repeat(64)},contract,mapping().identities,[],now);expect(parsed.canImport).toBe(false);expect(parsed.issues.some(i=>i.code==="unreviewed_rows")).toBe(true);});
 it("accepts reviewed exact-tab mappings but refuses drafts, duplicate names and cross-tab reuse",()=>{expect(validateGameMappings(mapping(),contract,now).identities).toHaveLength(1);for(const changes of [{reviewed:false},{source:"pitching_fall_2026"},{identities:[...mapping().identities,...mapping().identities]},{reviewedAt:"2026-09-14T12:00:00Z"},{identities:[{sourceName:"Fictional Player",athleteCode:"PAC-0001\n"}]}])expect(()=>validateGameMappings({...mapping(),...changes},contract,now)).toThrow();});
});

// Fictional source data only. October 4 owner-approved blank-grid expansion.
describe("reviewed 43-column QPA grid",()=>{
 const wideShape={rows:968,columns:43,range:"'2026 - Fall'!A1:AQ968"};
 function wideFixture(){const f=fixture();f.range=wideShape.range;f.response.sheets[0].properties.gridProperties={rowCount:968,columnCount:43};return f;}
 it("captures the complete wider blank grid without adding metric definitions",()=>{
  const captured=normalizeGameCapture(wideFixture(),contract,wideShape,now);
  expect(captured.cells).toHaveLength(41624);
  expect(captured.cells.at(-1)).toEqual({row:968,column:43});
  const parsed=parseGameSource({...captured,contentHash:"a".repeat(64)},contract,mapping().identities,[],now);
  expect(parsed.issues.filter(i=>i.severity==="error")).toEqual([]);
  const previous=normalizeGameCapture(fixture(),contract,shape,now);
  expect(captured.cells.filter(c=>c.entered!==undefined||c.effective!==undefined||c.formula||c.error)).toEqual(previous.cells.filter(c=>c.entered!==undefined||c.effective!==undefined||c.formula||c.error));
 });
 it("still refuses the old extent, a partial capture, or another grid change",()=>{
  expect(()=>normalizeGameCapture(wideFixture(),contract,shape,now)).toThrow();
  const partial=wideFixture();partial.range=shape.range;expect(()=>normalizeGameCapture(partial,contract,wideShape,now)).toThrow();
  const wider=wideFixture();wider.response.sheets[0].properties.gridProperties.columnCount=44;expect(()=>normalizeGameCapture(wider,contract,wideShape,now)).toThrow();
 });
 it("blocks any new data, header, formula, error or effective-only value in the added columns",()=>{
  for(const patch of [{entered:1},{entered:"New stat"},{formula:"=1",effective:1},{error:"DIVIDE_BY_ZERO"},{effective:1}]){
   const captured=normalizeGameCapture(wideFixture(),contract,wideShape,now);
   Object.assign(captured.cells.find(c=>c.row===2&&c.column===43)!,patch);
   const parsed=parseGameSource({...captured,contentHash:"a".repeat(64)},contract,mapping().identities,[],now);
   expect(parsed.canImport).toBe(false);expect(parsed.issues.some(i=>i.code==="unreviewed_columns")).toBe(true);
  }
 });
});

it("uses the reviewed 989-row pitching grid and excludes only its known formula summaries",async()=>{
 const {GAME_SOURCES,GAME_CAPTURE_SHAPES,PITCHING_BLOCKS}=await import("@/lib/game-source-config");
 const {PITCHING_HEADERS}=await import("@/lib/game-source");
 const contract={...GAME_SOURCES.pitching_fall_2026,spreadsheetId:"fictional-pitching-sheet"},shape=GAME_CAPTURE_SHAPES.pitching_fall_2026;
 const input={source:contract.source,range:shape.range,fetchedAt:"2026-10-27T22:00:00Z",response:{spreadsheetId:contract.spreadsheetId,sheets:[{properties:{sheetId:0,title:"FALL",gridProperties:{rowCount:989,columnCount:31}},data:[{rowData:[]}]}]}};
 const captured=normalizeGameCapture(input,contract,shape,Date.parse(input.fetchedAt));expect(captured.cells).toHaveLength(989*31);
 const set=(row:number,column:number,entered?:string|number,formula?:string)=>Object.assign(captured.cells.find(c=>c.row===row&&c.column===column)!,{entered,...(formula?{formula}:{})});
 for(const row of [2,...PITCHING_BLOCKS.map(b=>b.headerRow)])PITCHING_HEADERS.forEach((h,i)=>set(row,i+1,h));
 const events=PITCHING_BLOCKS.map(b=>({...b,playedOn:null}));
 for(const [i,b]of PITCHING_BLOCKS.entries())set(b.headerRow-1,1,i===4?"FALL BALL BOXER WORLD SERIES PITCHING STATS":`FALL BALL WEEK ${i+1} PITCHING STATS`);
 set(2,26,"K% RK");set(7,18,1);set(146,27,undefined,"=SUM(C129:C144)");set(147,27,"Fictional footer note");set(183,28,undefined,"=SUM(C151:C181)");set(64,3,undefined,"=SUM(C40:C63)");
 set(151,1,"Fictional Pitcher");set(151,3,20);set(150,24,"S&M");set(150,25,"HRD");set(150,26,"WK");
 const snapshot={...captured,contentHash:"a".repeat(64)},ids=[{sourceName:"Fictional Pitcher",athleteCode:"PAC-0001"}];
 expect(parseGameSource(snapshot,contract,ids,events,Date.parse(input.fetchedAt)).canImport).toBe(true);
 for(const row of [186,187]){
  set(row,28,undefined,"=SUM(C151:C181)");
  expect(parseGameSource(snapshot,contract,ids,events,Date.parse(input.fetchedAt)).canImport).toBe(true);
  const cell=captured.cells.find(c=>c.row===row&&c.column===28)!;
  delete cell.formula;cell.entered=1;
  expect(parseGameSource(snapshot,contract,ids,events,Date.parse(input.fetchedAt)).issues.some(i=>i.code==="unreviewed_columns"&&i.row===row)).toBe(true);
  delete cell.entered;cell.effective=1;
  expect(parseGameSource(snapshot,contract,ids,events,Date.parse(input.fetchedAt)).canImport).toBe(false);
  delete cell.effective;
 }
 set(185,28,undefined,"=SUM(C151:C181)");
 expect(parseGameSource(snapshot,contract,ids,events,Date.parse(input.fetchedAt)).canImport).toBe(false);
 delete captured.cells.find(c=>c.row===185&&c.column===28)!.formula;
 set(64,3,1);
 delete captured.cells.find(c=>c.row===64&&c.column===3)!.formula;
 expect(parseGameSource(snapshot,contract,ids,events,Date.parse(input.fetchedAt)).issues.some(i=>i.code==="unreviewed_rows")).toBe(true);
 input.response.sheets[0].properties.gridProperties.rowCount=1025;expect(()=>normalizeGameCapture(input,contract,shape,Date.parse(input.fetchedAt))).toThrow();
});
