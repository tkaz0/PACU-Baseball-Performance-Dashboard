import {UUID_PATTERN,type Role} from "@/lib/types";

export type AccountSetupStatus={
 userId:string;active:boolean;roles:Role[];athleteId:string|null;code:string|null;
 name:string;email:string|null;invitedAt:string|null;acceptedAt:string|null;
 lastSignInAt:string|null;passwordSet:boolean;
};
export type SetupStage="waiting"|"password"|"complete";
export function accountSetupStage(account:AccountSetupStatus):SetupStage{
 if(!account.acceptedAt)return "waiting";
 return account.passwordSet?"complete":"password";
}
const date=(value:unknown):value is string|null=>value===null||(typeof value==="string"&&Number.isFinite(Date.parse(value)));
const nullableText=(value:unknown):value is string|null=>value===null||typeof value==="string";
/** Project only the documented read model; do not forward raw Auth records or metadata. */
export function parseAccountSetupStatuses(value:unknown):AccountSetupStatus[]{
 if(!Array.isArray(value))throw new Error("Account setup status is unavailable.");
 const seen=new Set<string>();
 return value.map(row=>{
  if(!row||typeof row!=="object"||typeof row.userId!=="string"||!UUID_PATTERN.test(row.userId)||seen.has(row.userId)||typeof row.active!=="boolean"||typeof row.passwordSet!=="boolean"||typeof row.name!=="string"||!nullableText(row.email)||!nullableText(row.code)||!(row.athleteId===null||typeof row.athleteId==="string"&&UUID_PATTERN.test(row.athleteId))||!Array.isArray(row.roles)||row.roles.some((r:unknown)=>typeof r!=="string"||!["admin","coach","player"].includes(r))||![row.invitedAt,row.acceptedAt,row.lastSignInAt].every(date))throw new Error("Account setup status could not be verified.");
  seen.add(row.userId);
  return{userId:row.userId,active:row.active,roles:[...row.roles],athleteId:row.athleteId,code:row.code,name:row.name,email:row.email,invitedAt:row.invitedAt,acceptedAt:row.acceptedAt,lastSignInAt:row.lastSignInAt,passwordSet:row.passwordSet};
 });
}
