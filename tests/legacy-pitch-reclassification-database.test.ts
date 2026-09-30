import { initializeStorageSchema } from "./fixtures/storage-schema";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

// Only fictional identities and readings are used in this fixture.
const db = new PGlite();
const admin="11111111-1111-4111-8111-111111111111", coach="22222222-2222-4222-8222-222222222222", player="33333333-3333-4333-8333-333333333333";
const athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", peer="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const hash="a".repeat(64), otherHash="b".repeat(64), sheet="CSV · Classified pitch summaries v1";
const keys=["classified_max_velocity","classified_avg_velocity","classified_max_spin","classified_avg_spin","classified_pitch_count","classified_velocity_count","classified_spin_count"];
type Group={fileHash:string;sourceFile:string;date:string;source:string;currentType:string;measurementCount:number;summaryRow:number;assignmentVersion:number;metrics:{metricKey:string;value:number;unit:string;sourceColumn:number}[];fingerprint:string};
type Receipt={requestId:string;fileHash:string;measurementCount:number;pitchCount:number;assignmentVersion:number;restored:boolean;afterFingerprint:string};
function readings(code="PAC-0001", row=2, fileHash=hash, type="Fastball", offset=0) {
 return keys.map((metric_key,column)=>({observation_id:`observation:${JSON.stringify([fileHash,sheet,row,column+offset])}`,athlete_code:code,metric_key,measured_at:"2026-09-11",value:[82.125,80.375,2200.875,2100.25,2,2,2][column],unit:column<2?"mph":column<4?"rpm":"count",source:`Full Swing · Intrasquad · ${type}`,source_file:"fictional-session.csv",source_sheet:sheet,source_row:row,file_hash:fileHash}));
}
async function as<T>(id:string|null, run:()=>Promise<T>) {
 await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);
 try{return await run();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',false)");}
}
async function review(id=athlete){return (await db.query<{data:Group[]}>("select public.admin_legacy_pitch_reclassification_review($1) data",[id])).rows[0].data;}
async function history(){return (await db.query<{data:(Receipt&{canRestore:boolean})[]}>("select public.admin_legacy_pitch_reclassification_history($1) data",[athlete])).rows[0].data;}
async function apply(group:Group, request=randomUUID(), sourceRows:number[]=[2,3], reviewed=true) {
 return (await db.query<{data:Receipt}>("select public.admin_reclassify_legacy_fastball($1,$2,$3,$4,$5,$6) data",[request,athlete,group.fileHash,group.fingerprint,sourceRows,reviewed])).rows[0].data;
}
async function restore(receipt:Receipt,request=randomUUID(), reviewed=true) {
 return (await db.query<{data:Receipt}>("select public.admin_restore_legacy_pitch_reclassification($1,$2,$3,$4) data",[request,receipt.requestId,receipt.afterFingerprint,reviewed])).rows[0].data;
}
async function all(){return (await db.query<{data:Record<string,unknown>}>("select to_jsonb(m) data from public.performance_measurements m order by id")).rows.map(row=>row.data);}
async function labels(){return (await db.query<{data:{assignments:{sourceRow:number;pitchType:string}[];version:number}}>("select to_jsonb(a) data from private.full_swing_pitch_assignments a where file_hash=$1",[hash])).rows[0].data;}
async function add(rows=readings()){await as(admin,()=>db.query("select public.admin_import_performance($1::jsonb)",[JSON.stringify(rows)]));}
async function archived(){await db.query("insert into private.csv_measurement_archives(request_id,athlete_id,file_hash,fingerprint,source_file,observations,actor_id) select $1,$2,$3,$4,'fictional-session.csv',jsonb_build_array(to_jsonb(m)),$5 from public.performance_measurements m where m.athlete_id=$2 and m.file_hash=$3 limit 1",[randomUUID(),peer,hash,"a".repeat(32),admin]);}
async function published(){await db.query("insert into private.full_swing_publications(file_hash,revision,payload,receipt,created_by,updated_by) values($1,1,'{}','{}',$2,$2)",[hash,admin]);}

beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 const directory=new URL("../supabase/migrations/",import.meta.url);
 await initializeStorageSchema(db);
 for(const file of readdirSync(directory).filter(name=>name.endsWith('.sql')).sort())await db.exec(readFileSync(new URL(file,directory),'utf8'));
 for(const [id,role] of [[admin,"admin"],[coach,"coach"],[player,"player"]]){
  await db.query("insert into auth.users values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);
 }
 await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'PAC-0001','Fictional','One'),($2,'PAC-0002','Fictional','Two')",[athlete,peer]);
},30000);
beforeEach(async()=>{
 await db.exec("delete from private.legacy_pitch_reclassification_requests;delete from private.legacy_pitch_reclassifications;delete from private.full_swing_publication_requests;delete from private.full_swing_publication_revisions;delete from private.full_swing_publications;delete from private.csv_measurement_archives;delete from public.full_swing_contacts;delete from private.full_swing_session_samples;delete from private.full_swing_pitch_assignments;delete from public.performance_measurements;delete from public.performance_imports;delete from public.audit_events;update public.app_accounts set is_active=true;");
 await add([...readings(),...readings("PAC-0002",10),...readings("PAC-0001",2,otherHash)]);
 await as(admin,()=>db.query("select public.staff_full_swing_pitch_labels($1,0,$2::jsonb)",[hash,JSON.stringify([2,3,10,11].map(sourceRow=>({sourceRow,pitchType:"Fastball"})))]));
});
afterAll(()=>db.close());

it("reviews one complete eligible legacy group and changes only its type coordinates and exact reviewed annotations",async()=>{
 const before=await all(), originalLabels=await labels(), groups=await as(admin,()=>review());
 expect(groups).toHaveLength(1);expect(groups[0]).toMatchObject({fileHash:hash,sourceFile:"fictional-session.csv",date:"2026-09-11",currentType:"Fastball",measurementCount:7,summaryRow:2,assignmentVersion:1});
 expect(groups[0].fingerprint).toMatch(/^[a-f0-9]{64}$/);expect(groups[0].metrics.map(m=>m.sourceColumn)).toEqual([0,1,2,3,4,5,6]);
 const request=randomUUID(),receipt=await as(admin,()=>apply(groups[0],request));
 expect(receipt).toMatchObject({requestId:request,measurementCount:7,pitchCount:2,assignmentVersion:2,restored:false});
 expect(await all()).toEqual(before.map(row=>row.athlete_id===athlete&&row.file_hash===hash?{...row,source:"Full Swing · Intrasquad · Four-Seam Fastball",source_column:Number(row.source_column)+14,observation_id:`observation:${JSON.stringify([hash,sheet,2,Number(row.source_column)+14])}`}:row));
 expect((await labels()).assignments).toEqual(originalLabels.assignments.map(a=>a.sourceRow<10?{...a,pitchType:"Four-Seam Fastball"}:a));
 expect(await as(admin,()=>apply(groups[0],request))).toEqual(receipt);
 expect(await as(admin,()=>review())).toEqual([]);
 const saved=(await db.query<{before_measurements:unknown[]}>("select before_measurements from private.legacy_pitch_reclassifications")).rows[0];
 expect(saved.before_measurements).toEqual(before.filter(r=>r.athlete_id===athlete&&r.file_hash===hash).sort((a,b)=>Number(a.source_column)-Number(b.source_column)));
 const audits=(await db.query<{details:unknown}>("select details from public.audit_events where event_type='legacy_pitch_reclassified'")).rows;
 expect(audits).toEqual([{details:{measurementCount:7,pitchCount:2}}]);
});

it("restores the exact old observations while advancing label revision and guards idempotent retries",async()=>{
 const before=await all(),beforeLabels=await labels(),group=(await as(admin,()=>review()))[0],receipt=await as(admin,()=>apply(group));
 const savedHistory=await as(admin,history);expect(savedHistory).toHaveLength(1);expect(savedHistory[0]).toMatchObject({requestId:receipt.requestId,canRestore:true,afterFingerprint:receipt.afterFingerprint});
 for(const key of ["sourceRows","before_measurements","after_measurements","before_labels","after_labels"])expect(savedHistory[0]).not.toHaveProperty(key);
 const request=randomUUID(),restored=await as(admin,()=>restore(receipt,request));
 expect(restored).toMatchObject({requestId:request,restored:true,assignmentVersion:3,measurementCount:7,pitchCount:2});
 expect(await all()).toEqual(before);expect((await labels()).assignments).toEqual(beforeLabels.assignments);
 expect(await as(admin,()=>restore(receipt,request))).toEqual(restored);expect(await as(admin,history)).toEqual([]);
 await as(admin,async()=>{await expect(restore(receipt)).rejects.toThrow();});
});

it.each([null,coach,player])("denies review, correction, history, restore and private access for %s",async id=>{
 const group=(await as(admin,()=>review()))[0],receipt=await as(admin,()=>apply(group));
 await as(id,async()=>{
  await expect(review()).rejects.toThrow();await expect(history()).rejects.toThrow();await expect(apply(group)).rejects.toThrow();await expect(restore(receipt)).rejects.toThrow();
  for(const table of ["legacy_pitch_reclassifications","legacy_pitch_reclassification_requests"])await expect(db.exec(`select * from private.${table}`)).rejects.toThrow();
  await expect(db.query("select private.legacy_pitch_file_fingerprint($1)",[hash])).rejects.toThrow();
 });
});

it("checks current account activity and rejects changed request scope",async()=>{
 const group=(await as(admin,()=>review()))[0],request=randomUUID(),receipt=await as(admin,()=>apply(group,request));
 await as(admin,async()=>{await expect(apply({...group,fingerprint:"0".repeat(64)},request)).rejects.toThrow("already used");await expect(restore(receipt,request)).rejects.toThrow("already used");});
 await db.query("update public.app_accounts set is_active=false where user_id=$1",[admin]);
 await as(admin,async()=>{await expect(review()).rejects.toThrow();await expect(history()).rejects.toThrow();await expect(apply(group,request)).rejects.toThrow();await expect(restore(receipt)).rejects.toThrow();});
});

it("rejects absent review, duplicate/wrong-count/out-of-bounds rows and nonmatching annotations without mutations",async()=>{
 const group=(await as(admin,()=>review()))[0],before=await all(),beforeLabels=await labels();
 await as(admin,async()=>{
  await expect(apply(group,randomUUID(),[2,3],false)).rejects.toThrow();
  for(const rows of [[],[2],[2,2],[2,4],[1,3],[2,5002]])await expect(apply(group,randomUUID(),rows)).rejects.toThrow();
 });
 expect(await all()).toEqual(before);expect(await labels()).toEqual(beforeLabels);
});

it.each(["peer-reading","peer-label","new-reading"])('fingerprints the whole file and rejects concurrent %s changes',async change=>{
 const group=(await as(admin,()=>review()))[0];
 if(change==="peer-reading")await db.query("update public.performance_measurements set value=value+1 where athlete_id=$1 and file_hash=$2 and metric_key='classified_max_spin'",[peer,hash]);
 if(change==="peer-label")await as(admin,()=>db.query("select public.staff_full_swing_pitch_labels($1,1,$2::jsonb)",[hash,JSON.stringify([2,3,10,11].map(sourceRow=>({sourceRow,pitchType:sourceRow===10?"Slider":"Fastball"})))]));
 if(change==="new-reading")await add(readings("PAC-0001",30,hash,"Slider",42));
 const changed=await all();await as(admin,async()=>{await expect(apply(group)).rejects.toThrow("changed");});expect(await all()).toEqual(changed);
});

it.each(["missing","coordinate","observation","unit","name","source","date","sample-count","max-below-average","missing-labels"])('refuses malformed/incomplete legacy %s evidence',async change=>{
 const group=(await as(admin,()=>review()))[0];
 const where=" where athlete_id=$1 and file_hash=$2 and metric_key='classified_max_velocity'";
 if(change==="missing")await db.query("delete from public.performance_measurements"+where,[athlete,hash]);
 if(change==="coordinate")await db.query("update public.performance_measurements set source_column=100"+where,[athlete,hash]);
 if(change==="observation")await db.query("update public.performance_measurements set observation_id='observation:not-json'"+where,[athlete,hash]);
 if(change==="unit")await db.query("update public.performance_measurements set metric_key='classified_max_spin',metric='Pitch Type Max Spin',unit='rpm'"+where,[athlete,hash]);
 if(change==="name")await db.query("update public.performance_measurements set metric='Unverified label'"+where,[athlete,hash]);
 if(change==="source")await db.query("update public.performance_measurements set source='Full Swing · Practice · Fastball'"+where,[athlete,hash]);
 if(change==="date")await db.query("update public.performance_measurements set measured_at='2026-09-12'"+where,[athlete,hash]);
 if(change==="sample-count")await db.query("update public.performance_measurements set value=3 where athlete_id=$1 and file_hash=$2 and metric_key='classified_velocity_count'",[athlete,hash]);
 if(change==="max-below-average")await db.query("update public.performance_measurements set value=1"+where,[athlete,hash]);
 if(change==="missing-labels")await db.query("delete from private.full_swing_pitch_assignments where file_hash=$1",[hash]);
 const before=await all();expect(await as(admin,()=>review())).toEqual([]);await as(admin,async()=>{await expect(apply(group)).rejects.toThrow();});expect(await all()).toEqual(before);
});

it.each(["target-type","target-coordinate","archive","publication"])('refuses %s conflicts and keeps every existing result',async conflict=>{
 const group=(await as(admin,()=>review()))[0];
 if(conflict==="target-type")await add(readings("PAC-0001",20,hash,"Four-Seam Fastball",14));
 if(conflict==="target-coordinate")await add(readings("PAC-0002",2,hash,"Four-Seam Fastball",14));
 if(conflict==="archive")await archived();
 if(conflict==="publication")await published();
 const before=await all();expect(await as(admin,()=>review())).toEqual([]);await as(admin,async()=>{await expect(apply(group)).rejects.toThrow();});expect(await all()).toEqual(before);
});

it.each(["reading","labels","archive","publication"])('refuses restore after any file %s changed',async change=>{
 const group=(await as(admin,()=>review()))[0],receipt=await as(admin,()=>apply(group));
 if(change==="reading")await db.query("update public.performance_measurements set value=value+1 where athlete_id=$1 and file_hash=$2 and metric_key='classified_max_spin'",[peer,hash]);
 if(change==="labels")await as(admin,()=>db.query("select public.staff_full_swing_pitch_labels($1,2,$2::jsonb)",[hash,JSON.stringify([2,3,10,11].map(sourceRow=>({sourceRow,pitchType:sourceRow<10?"Four-Seam Fastball":"Slider"})))]));
 if(change==="archive")await archived();if(change==="publication")await published();
 const before=await all();expect((await as(admin,history))[0].canRestore).toBe(false);
 await as(admin,async()=>{await expect(restore(receipt)).rejects.toThrow("unchanged after-state");});expect(await all()).toEqual(before);
});

it("prevents stale generic re-imports while the correction is active",async()=>{
 const group=(await as(admin,()=>review()))[0],receipt=await as(admin,()=>apply(group)),before=await all();
 await expect(add(readings())).rejects.toThrow("reclassified");expect(await all()).toEqual(before);
 await as(admin,()=>restore(receipt));await add(readings());expect((await all()).length).toBe(21);
});

it("guards the restored direction and allows a new reviewed correction without stale ledger interference",async()=>{
 const group=(await as(admin,()=>review()))[0],receipt=await as(admin,()=>apply(group));
 await as(admin,()=>restore(receipt));const restored=await all();
 await expect(add(readings("PAC-0001",2,hash,"Four-Seam Fastball",14))).rejects.toThrow("reclassified");
 expect(await all()).toEqual(restored);
 const nextGroup=(await as(admin,()=>review()))[0],nextReceipt=await as(admin,()=>apply(nextGroup));
 expect(nextReceipt).toMatchObject({assignmentVersion:4,restored:false});
 const corrected=await all();await add(readings("PAC-0001",2,hash,"Four-Seam Fastball",14));expect(await all()).toEqual(corrected);
 await expect(add(readings())).rejects.toThrow("reclassified");
 // A reviewed publication rebuild may insert the current coordinates after deleting its projection.
 await db.query("delete from public.performance_measurements where athlete_id=$1 and file_hash=$2",[athlete,hash]);
 await add(readings("PAC-0001",2,hash,"Four-Seam Fastball",14));
 expect((await all()).filter(r=>r.athlete_id===athlete&&r.file_hash===hash)).toHaveLength(7);
});
