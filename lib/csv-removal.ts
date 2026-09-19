import { UUID_PATTERN } from "@/lib/types";
export type CsvBatch = {fileHash:string;sourceFile:string;count:number;fingerprint:string;firstDate:string;lastDate:string};
export type CsvArchive = {requestId:string;fileHash:string;sourceFile:string;count:number;fingerprint:string;removedAt:string;restored:boolean};
export type CsvRemovalReview = {active:CsvBatch[];archived:CsvArchive[]};
export type CsvRemovalRequest = {requestId:string;athleteId:string;fileHash:string;fingerprint:string;restore:boolean};
export function validCsvRemovalRequest(value:CsvRemovalRequest) {
 return !!value && typeof value === "object" && Object.keys(value).length===5 && UUID_PATTERN.test(value.requestId) && UUID_PATTERN.test(value.athleteId) && /^[a-f0-9]{64}$/.test(value.fileHash) && /^[a-f0-9]{32}$/.test(value.fingerprint) && typeof value.restore==="boolean";
}
export function readCsvRemovalReview(value:unknown):CsvRemovalReview {
 const v=value as CsvRemovalReview;
 const base=(r:CsvBatch|CsvArchive)=>r && /^[a-f0-9]{64}$/.test(r.fileHash) && /^[a-f0-9]{32}$/.test(r.fingerprint) && typeof r.sourceFile==="string" && r.sourceFile.length>0 && r.sourceFile.length<=300 && Number.isSafeInteger(r.count) && r.count>0 && r.count<=500;
 if(!v || !Array.isArray(v.active) || !Array.isArray(v.archived) || v.active.length>100 || v.archived.length>100 ||
  !v.active.every(r=>base(r)&&/^\d{4}-\d{2}-\d{2}$/.test(r.firstDate)&&/^\d{4}-\d{2}-\d{2}$/.test(r.lastDate)) ||
  !v.archived.every(r=>base(r)&&UUID_PATTERN.test(r.requestId)&&typeof r.restored==="boolean"&&Number.isFinite(Date.parse(r.removedAt)))) throw new Error("CSV removal review could not be verified.");
 return {active:v.active,archived:v.archived};
}
