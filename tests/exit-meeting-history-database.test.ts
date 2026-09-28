import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { fictionalHistoryAthlete as athlete, fictionalHistoryRequest as request, fictionalHistoryReport } from "./fixtures/exit-meeting-history";
const db=new PGlite();
const admin="11111111-1111-4111-8111-111111111111",coach="22222222-2222-4222-8222-222222222222",player="33333333-3333-4333-8333-333333333333",otherAthlete="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
async function as<T>(id:string|null,run:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await run();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',false)");}}
const report=()=>fictionalHistoryReport(new Date().toISOString());
const save=(id=request,notes="Fictional coach note",payload:unknown=report(),athleteId=athlete)=>db.query<{snapshot:Record<string,unknown>}>("select public.staff_save_exit_meeting_snapshot($1,$2,$3,$4,$5) snapshot",[id,athleteId,"2026-10-01",notes,JSON.stringify(payload)]);
const history=()=>db.query<{history:{items:Record<string,unknown>[];hasMore:boolean}}>("select public.staff_exit_meeting_history($1) history",[athlete]);
let savedId:string;
beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 for(const file of ["202609040001_identity_and_access.sql","202609280002_exit_meeting_history.sql"])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
 for(const [id,role] of [[admin,"admin"],[coach,"coach"],[player,"player"]]){await db.query("insert into auth.users(id) values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);}
 await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'PAC-9999','Fictional','Player'),($2,'PAC-9998','Fictional','Other')",[athlete,otherAthlete]);
 await db.query("insert into public.athlete_seasons(athlete_id,season) values($1,'2026-27'),($2,'2026-27')",[athlete,otherAthlete]);
 await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)",[player,athlete]);
});
afterAll(()=>db.close());
it("creates no history until a staff save and shares immutable snapshots only with active staff",async()=>{
 expect((await as(admin,history)).rows[0].history).toEqual({items:[],hasMore:false});
 const first=(await as(admin,()=>save())).rows[0].snapshot;savedId=first.id as string;expect(first).toMatchObject({athleteId:athlete,meetingDate:"2026-10-01",talkingPoints:"Fictional coach note",schemaVersion:1});
 const list=(await as(coach,history)).rows[0].history;expect(list.items).toHaveLength(1);expect(list.items[0]).not.toHaveProperty("report");expect(list.items[0]).not.toHaveProperty("talkingPoints");expect(list.items[0]).not.toHaveProperty("createdBy");
 const read=await as(coach,()=>db.query<{snapshot:Record<string,unknown>}>("select public.staff_exit_meeting_snapshot($1,$2) snapshot",[athlete,savedId]));expect(read.rows[0].snapshot).toEqual(first);
 expect((await as(coach,()=>db.query<{snapshot:unknown}>("select public.staff_exit_meeting_snapshot($1,$2) snapshot",[otherAthlete,savedId]))).rows[0].snapshot).toBeNull();
 for(const actor of [player,null])await as(actor,async()=>{await expect(history()).rejects.toThrow();await expect(save()).rejects.toThrow();await expect(db.query("select public.staff_exit_meeting_snapshot($1,$2)",[athlete,savedId])).rejects.toThrow();});
 await as(coach,async()=>{await expect(db.exec("select * from public.exit_meeting_snapshots")).rejects.toThrow();await expect(db.query("update public.exit_meeting_snapshots set talking_points='Changed' where id=$1",[savedId])).rejects.toThrow();await expect(db.query("delete from public.exit_meeting_snapshots where id=$1",[savedId])).rejects.toThrow();});
 await expect(db.query("update public.exit_meeting_snapshots set talking_points='Changed' where id=$1",[savedId])).rejects.toThrow("cannot be changed");
});
it("replays the original report after source changes, rejects changed options, and isolates actor request IDs",async()=>{
 const original=(await as(admin,()=>db.query<{snapshot:unknown}>("select public.staff_exit_meeting_attempt($1) snapshot",[request]))).rows[0].snapshot;
 const changed={...report(),name:"Changed Current Name",sections:[]};expect((await as(admin,()=>save(request,"Fictional coach note",changed))).rows[0].snapshot).toEqual(original);
 await as(admin,async()=>{await expect(save(request,"Changed notes")).rejects.toThrow("different options");await expect(save(request,"Fictional coach note",report(),otherAthlete)).rejects.toThrow("different options");});
 expect((await as(coach,()=>db.query<{snapshot:unknown}>("select public.staff_exit_meeting_attempt($1) snapshot",[request]))).rows[0].snapshot).toBeNull();expect((await as(admin,history)).rows[0].history.items).toHaveLength(1);
});
it("rejects unknown payload fields, stale/wrong-identity snapshots, invalid percentiles, and unsafe notes",async()=>{
 const attempt="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
 const wrongPercentile=report();wrongPercentile.sections[0].rows[0].peers=2;
 for(const payload of [{...report(),pacific_email:"fictional@example.com"},{...report(),code:"PAC-9998"},{...report(),format:"detailed"},wrongPercentile,fictionalHistoryReport("2026-01-01T00:00:00Z")])await as(admin,async()=>{await expect(save(attempt,"",payload)).rejects.toThrow();});
 for(const notes of ["x".repeat(1601),String.fromCodePoint(0x1f600).repeat(801),"control\u0001text","bidi\u202etext"])await as(admin,async()=>{await expect(save(attempt,notes)).rejects.toThrow();});
 expect((await as(admin,history)).rows[0].history.items).toHaveLength(1);
 const audits=await db.query<{details:Record<string,unknown>}>("select details from public.audit_events where event_type='exit_meeting_saved'");expect(audits.rows).toHaveLength(1);expect(Object.keys(audits.rows[0].details).sort()).toEqual(["schema_version","snapshot_id"]);
});
it("rechecks deactivation for history reads, replay lookups, and new saves",async()=>{
 await db.query("update public.app_accounts set is_active=false where user_id=$1",[coach]);
 await as(coach,async()=>{await expect(history()).rejects.toThrow();await expect(db.query("select public.staff_exit_meeting_attempt($1)",[request])).rejects.toThrow();await expect(save("ffffffff-ffff-4fff-8fff-ffffffffffff")).rejects.toThrow();});
});
it("rejects explicit null enum fields and relaxed or infinite dates through a direct staff RPC",async()=>{
 const attempt="abababab-abab-4bab-8bab-abababababab";
 const invalidTone=report();Object.assign(invalidTone.sections[0].rows[0],{tone:null});
 const invalidTrend=report();invalidTrend.sections[0].rows[0].trend=[{date:"September 16, 2026",value:150}];
 for(const payload of [{...report(),format:null},{...report(),season:null},invalidTone,invalidTrend,{...report(),generatedAt:null},{...report(),generatedAt:"infinity"},{...report(),lastGameUpdate:"infinity"},{...report(),lastGameUpdate:"2026-09-28 12:00:00Z"},{...report(),lastGameUpdate:"2026-02-30T12:00:00Z"},{...report(),lastTested:"2026-2-3"},{...report(),lastTested:"2026-02-30"}])await as(admin,async()=>{await expect(save(attempt,"",payload)).rejects.toThrow();});
 expect((await as(admin,history)).rows[0].history.items).toHaveLength(1);
 const unicode=await db.query<{valid:boolean}>("select private.exit_meeting_text(to_jsonb($1::text),1600,true) valid",[String.fromCodePoint(0x1f600).repeat(800)]);expect(unicode.rows[0].valid).toBe(true);
});
it("bounds metadata history and rejects new snapshots after the per-player storage limit",async()=>{
 await db.query("insert into public.exit_meeting_snapshots(athlete_id,request_id,meeting_date,talking_points,report,created_by) select $1,gen_random_uuid(),date '2026-10-01','',$2::jsonb,$3 from generate_series(1,499)",[athlete,JSON.stringify(report()),admin]);
 const result=(await as(admin,history)).rows[0].history;expect(result.hasMore).toBe(true);expect(result.items).toHaveLength(50);expect(result.items.every(item=>!Object.hasOwn(item,"report")&&!Object.hasOwn(item,"talkingPoints"))).toBe(true);
 await as(admin,async()=>{await expect(save("edededed-eded-4ded-8ded-edededededed")).rejects.toThrow("history limit");});
 // Replaying an existing successful request must still work at capacity.
 expect((await as(admin,()=>save())).rows[0].snapshot.id).toBe(savedId);
});
