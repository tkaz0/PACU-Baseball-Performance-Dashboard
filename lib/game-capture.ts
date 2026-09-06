import type { GameSourceCell,GameSourceSnapshot,ReviewedGameSource,ReviewedGameIdentity,ReviewedPitchingEvent } from "@/lib/game-source";
type ObjectValue=Record<string,unknown>;
const object=(x:unknown):x is ObjectValue=>!!x&&typeof x==="object"&&!Array.isArray(x);
/** An explicit complete-range receipt is required because Sheets omits trailing blank cells. */
export function normalizeGameCapture(input:unknown,contract:ReviewedGameSource,shape:{rows:number;columns:number;range:string},now=Date.now()):Omit<GameSourceSnapshot,"contentHash">{
 const fail=():never=>{throw new Error("Read the complete approved tab range again; the capture metadata, coverage or cells could not be verified.");};
 if(!object(input)||input.source!==contract.source||input.range!==shape.range||typeof input.fetchedAt!=="string"||!Number.isFinite(Date.parse(input.fetchedAt))||Date.parse(input.fetchedAt)>now+300000||!object(input.response))return fail();
 const response=input.response;
 if(response.spreadsheetId!==contract.spreadsheetId||!Array.isArray(response.sheets)||response.sheets.length!==1||!object(response.sheets[0]))return fail();
 const sheet=response.sheets[0];
 if(!object(sheet.properties)||sheet.properties.sheetId!==contract.sheetId||sheet.properties.title!==contract.sheetTitle||!object(sheet.properties.gridProperties)||sheet.properties.gridProperties.rowCount!==shape.rows||sheet.properties.gridProperties.columnCount!==shape.columns||!Array.isArray(sheet.data)||sheet.data.length!==1||!object(sheet.data[0]))return fail();
 const data=sheet.data[0];if((data.startRow??0)!==0||(data.startColumn??0)!==0||(data.rowData!==undefined&&!Array.isArray(data.rowData))||shape.rows*shape.columns>40000)return fail();
 const rows=(data.rowData??[])as unknown[];if(rows.length>shape.rows)return fail();
 const cells:GameSourceCell[]=[];
 for(let r=0;r<shape.rows;r++){
  const row=rows[r];if(row!==undefined&&!object(row))return fail();const values=object(row)?row.values??[]:[];if(!Array.isArray(values)||values.length>shape.columns)return fail();
  for(let c=0;c<shape.columns;c++){
   const cell:GameSourceCell={row:r+1,column:c+1},raw=values[c];if(raw!==undefined&&!object(raw))return fail();
   for(const [field,target]of[["userEnteredValue","entered"],["effectiveValue","effective"]]as const){
    const value=object(raw)?raw[field]:undefined;if(value===undefined)continue;if(!object(value))return fail();
    if(typeof value.numberValue==="number"&&Number.isFinite(value.numberValue))cell[target]=value.numberValue;
    else if(typeof value.stringValue==="string"&&value.stringValue.length<=2000)cell[target]=value.stringValue;
    else if(target==="entered"&&typeof value.formulaValue==="string"&&value.formulaValue.length<=2000)cell.formula=value.formulaValue;
    else if(target==="effective"&&object(value.errorValue)&&typeof value.errorValue.type==="string")cell.error=value.errorValue.type;
    else if(Object.keys(value).length)return fail();
   }
   cells.push(cell);
  }
 }
 return{source:contract.source,spreadsheetId:contract.spreadsheetId,sheetId:contract.sheetId,sheetTitle:contract.sheetTitle,fetchedAt:input.fetchedAt,cells};
}
export function validateGameMappings(input:unknown,contract:ReviewedGameSource,now=Date.now()):{identities:ReviewedGameIdentity[];events:ReviewedPitchingEvent[]}{
 const fail=():never=>{throw new Error("Use a reviewed mapping file for this exact approved tab; do not infer player identities or game dates.");};
 if(!object(input)||input.version!==1||input.reviewed!==true||input.source!==contract.source||input.spreadsheetId!==contract.spreadsheetId||input.sheetId!==contract.sheetId||input.sheetTitle!==contract.sheetTitle||typeof input.reviewedAt!=="string"||!Number.isFinite(Date.parse(input.reviewedAt))||Date.parse(input.reviewedAt)>now+300000||!Array.isArray(input.identities)||input.identities.length>1000||!Array.isArray(input.events)||input.events.length>100)return fail();
 const seen=new Set<string>();
 const identities=input.identities.map(m=>{if(!object(m)||typeof m.sourceName!=="string"||!m.sourceName.trim()||m.sourceName.length>300||typeof m.athleteCode!=="string"||m.athleteCode.length>13||!/^PAC-[0-9]{4,9}$/.test(m.athleteCode))return fail();const key=m.sourceName.trim().replace(/\s+/g," ").toLowerCase();if(seen.has(key))return fail();seen.add(key);return{sourceName:m.sourceName,athleteCode:m.athleteCode};});
 const events=input.events.map(e=>{if(!object(e)||!Number.isSafeInteger(e.headerRow)||!Number.isSafeInteger(e.firstRow)||!Number.isSafeInteger(e.lastRow)||typeof e.eventId!=="string"||e.eventId.length>80||typeof e.playedOn!=="string")return fail();return{headerRow:e.headerRow as number,firstRow:e.firstRow as number,lastRow:e.lastRow as number,eventId:e.eventId,playedOn:e.playedOn};});
 return{identities,events};
}
