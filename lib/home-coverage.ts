import { UUID_PATTERN } from "@/lib/types";
import type { HomeReading } from "@/lib/home-summary";
type Group = HomeReading & {metric:string;unit:string;count:number};
export type HomeCoverage = {playerIds:string[];totalReadings:number;groups:Group[]};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const text=(v:unknown,max:number):v is string=>typeof v==="string"&&v.length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v);
const keys=(v:Record<string,unknown>,expected:string[])=>Object.keys(v).length===expected.length&&expected.every(key=>key in v);
/** Exact scope and complete group counts are checked before any Home totals. */
export function validateHomeCoverage(value:unknown,athleteId:string|null,today:string):HomeCoverage {
  const fail=()=>{throw new Error("Home coverage could not be verified. Refresh to try again.");};
  if(!object(value)||!keys(value,["version","athleteId","today","playerIds","totalReadings","groups"])||value.version!==1||value.athleteId!==athleteId||value.today!==today||!Array.isArray(value.playerIds)||value.playerIds.length>1000||!Array.isArray(value.groups)||value.groups.length>20000||!Number.isInteger(value.totalReadings)||Number(value.totalReadings)<0||Number(value.totalReadings)>20000)return fail();
  const ids=value.playerIds;
  if(ids.some(id=>typeof id!=="string"||!UUID_PATTERN.test(id))||new Set(ids).size!==ids.length||(athleteId!==null&&(ids.length!==1||ids[0]!==athleteId)))return fail();
  const groups:Group[]=[],seen=new Set<string>();let count=0;
  for(const row of value.groups){
    if(!object(row)||!keys(row,["athleteId","metric","unit","source","date","importedAt","count"])||typeof row.athleteId!=="string"||!ids.includes(row.athleteId)||!text(row.metric,200)||!text(row.unit,20)||!text(row.source,100)||typeof row.date!=="string"||!/^2026-\d{2}-\d{2}$/.test(row.date)||row.date<"2026-09-01"||row.date>"2026-12-31"||row.date>today||!Number.isFinite(Date.parse(`${row.date}T00:00:00Z`))||new Date(`${row.date}T00:00:00Z`).toISOString().slice(0,10)!==row.date||typeof row.importedAt!=="string"||!/^\d{4}-\d{2}-\d{2}T/.test(row.importedAt)||!Number.isFinite(Date.parse(row.importedAt))||!Number.isInteger(row.count)||Number(row.count)<1||Number(row.count)>20000)return fail();
    const key=JSON.stringify([row.athleteId,row.metric,row.unit,row.source]);if(seen.has(key))return fail();seen.add(key);
    count+=Number(row.count);groups.push(row as Group);
  }
  if(count!==value.totalReadings)return fail();
  return {playerIds:ids as string[],totalReadings:count,groups};
}
