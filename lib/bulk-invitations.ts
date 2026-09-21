export type BulkInviteStatus = "ready" | "connected" | "existing" | "email" | "duplicate" | "inactive" | "review";
export type BulkInvitePlayer = { id:string; code:string; name:string; email:string; status:BulkInviteStatus };
export const BULK_INVITE_LABELS:Record<BulkInviteStatus,string>={ready:"Ready to invite",connected:"Account already linked",existing:"Sign-in already exists",email:"Roster email needed",duplicate:"Duplicate roster email",inactive:"Roster needs review",review:"Previous send needs review"};
export type BulkInviteOutcome={status:"sent"|"skipped"|"review";message:string};
export function validBulkEmail(email:string){return email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);}
export function classifyBulkPlayers(rows:{id:string;code:string;name:string;email:string|null;eligible:boolean}[],linked:Set<string>,existing:Set<string>,attempted:Set<string>,actorEmail?:string):BulkInvitePlayer[]{
 const counts=new Map<string,number>();for(const r of rows){const e=r.email?.trim().toLowerCase();if(e)counts.set(e,(counts.get(e)??0)+1);}
 return rows.map(r=>{const email=r.email?.trim().toLowerCase()??"";const status:BulkInviteStatus=linked.has(r.id)?"connected":attempted.has(r.id)?"review":existing.has(email)||email===actorEmail?.toLowerCase()?"existing":!r.eligible?"inactive":!validBulkEmail(email)?"email":counts.get(email)!==1?"duplicate":"ready";return{id:r.id,code:r.code,name:r.name,email,status};});
}
