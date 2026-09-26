import { UUID_PATTERN } from "@/lib/types";

export type CsvMaxReading = { id:string; metricKey:"classified_max_spin"|"max_distance"; value:number; unit:string; source:string; sourceFile:string; measuredAt:string; fingerprint:string };
export type CsvMaxReadingRequest = { requestId:string; athleteId:string; observationId:string; fingerprint:string };

export function readCsvMaxReadings(value:unknown):CsvMaxReading[] {
  if(!Array.isArray(value)||value.length>200||!value.every(row=>row&&typeof row==="object"&&!Array.isArray(row)
    &&UUID_PATTERN.test(row.id)&&["classified_max_spin","max_distance"].includes(row.metricKey)
    &&typeof row.value==="number"&&Number.isFinite(row.value)&&row.value>=0
    &&row.unit===(row.metricKey==="classified_max_spin"?"rpm":"ft")
    &&typeof row.source==="string"&&/^Full Swing · (Game|Intrasquad|Practice)( · .+)?$/.test(row.source)
    &&typeof row.sourceFile==="string"&&row.sourceFile.length>0&&row.sourceFile.length<=300
    &&/^2026-\d{2}-\d{2}$/.test(row.measuredAt)&&/^[a-f0-9]{32}$/.test(row.fingerprint)))
    throw new Error("CSV readings could not be verified.");
  return value as CsvMaxReading[];
}

export function validCsvMaxReadingRequest(value:unknown):value is CsvMaxReadingRequest {
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  const row=value as Record<string,unknown>;
  return Object.keys(row).sort().join(",")==="athleteId,fingerprint,observationId,requestId"
    &&[row.requestId,row.athleteId,row.observationId].every(id=>typeof id==="string"&&UUID_PATTERN.test(id))
    &&typeof row.fingerprint==="string"&&/^[a-f0-9]{32}$/.test(row.fingerprint);
}
