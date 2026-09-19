import { PGlite } from "@electric-sql/pglite";
import { readdirSync,readFileSync } from "node:fs";
import { beforeAll,beforeEach,afterAll,it,expect } from "vitest";
const db=new PGlite(), admin="11111111-1111-4111-8111-111111111111",coach="22222222-2222-4222-8222-222222222222",player="33333333-3333-4333-8333-333333333333",athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",peer="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",request="44444444-4444-4444-8444-444444444444",hash="a".repeat(64);
async function asUser<T>(id:string|null,run:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await run();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',false)");}}
const observation=(row:number,code="SYN-001",source="Full Swing · Intrasquad")=>({observation_id:`observation:${JSON.stringify([hash,"CSV",row,1])}`,athlete_code:code,metric_key:source==="RENPHO"?"weight":"max_exit_velocity",measured_at:"2026-09-11",value:80,unit:source==="RENPHO"?"lb":"mph",source,source_file:"fictional.csv",source_sheet:"CSV",source_row:row,file_hash:hash});
async function review(){return (await db.query<{data:{active:{fingerprint:string;count:number}[];archived:{restored:boolean}[]}}>("select public.admin_csv_measurement_batches($1) data",[athlete])).rows[0].data;}
async function change(fp:string,restore=false,approved=true,id=request){return (await db.query<{data:{count:number;restored:boolean}}>("select public.admin_set_csv_measurement_archive($1,$2,$3,$4,$5,$6) data",[id,athlete,hash,fp,restore,approved])).rows[0].data;}
async function all(){return (await db.query<Record<string,unknown>>("select * from public.performance_measurements order by id")).rows;}
beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 const dir=new URL("../supabase/migrations/",import.meta.url);for(const f of readdirSync(dir).filter(n=>n.endsWith('.sql')).sort())await db.exec(readFileSync(new URL(f,dir),'utf8'));
 for(const [id,role] of [[admin,"admin"],[coach,"coach"],[player,"player"]]){await db.query("insert into auth.users(id) values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);}
 await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'SYN-001','Fictional','One'),($2,'SYN-002','Fictional','Two')",[athlete,peer]);
});
beforeEach(async()=>{await db.exec("delete from private.csv_measurement_archives;delete from public.performance_measurements;delete from public.performance_imports;delete from public.audit_events;update public.app_accounts set is_active=true;");await asUser(admin,()=>db.query("select public.admin_import_performance($1::jsonb)",[JSON.stringify([observation(2),observation(3),observation(4,"SYN-002"),observation(5,"SYN-001","RENPHO")])]));});
afterAll(()=>db.close());
it("removes only the selected player/file Full Swing readings, archives complete originals and restores exactly",async()=>{
 const before=await all();const r=await asUser(admin,review);expect(r.active).toHaveLength(1);expect(r.active[0].count).toBe(2);
 const receipt=await asUser(admin,()=>change(r.active[0].fingerprint));expect(receipt).toMatchObject({count:2,restored:false});
 expect(await all()).toEqual(before.filter(m=>m.athlete_id!==athlete||m.source==="RENPHO"));
 expect(await asUser(admin,()=>change(r.active[0].fingerprint))).toEqual(receipt);
 expect(await asUser(admin,()=>change(r.active[0].fingerprint,true))).toMatchObject({count:2,restored:true});expect(await all()).toEqual(before);
 expect(await asUser(admin,()=>change(r.active[0].fingerprint,true))).toMatchObject({restored:true});expect(await all()).toEqual(before);
 expect((await asUser(admin,review)).archived[0].restored).toBe(true);
});
it("rejects stale and unreviewed requests atomically",async()=>{
 const r=await asUser(admin,review),before=await all();await asUser(admin,async()=>{await expect(change(r.active[0].fingerprint,false,false)).rejects.toThrow();await expect(change("0".repeat(32))).rejects.toThrow();});expect(await all()).toEqual(before);
 await db.exec("update public.performance_measurements set value=81 where source like 'Full Swing%'");await asUser(admin,async()=>{await expect(change(r.active[0].fingerprint)).rejects.toThrow();});expect((await all()).length).toBe(4);
});
it("prevents an accidental re-import or remap of removed source coordinates",async()=>{
 const r=await asUser(admin,review);await asUser(admin,()=>change(r.active[0].fingerprint));
 await asUser(admin,async()=>{for(const code of ["SYN-001","SYN-002"])await expect(db.query("select public.admin_import_performance($1::jsonb)",[JSON.stringify([observation(2,code)])])).rejects.toThrow();});
 expect((await all()).length).toBe(2);
});
it.each([null,coach,player])("denies unauthorized read, removal, restore and archive access for %s",async id=>{
 const r=await asUser(admin,review);await asUser(id,async()=>{await expect(review()).rejects.toThrow();await expect(change(r.active[0].fingerprint)).rejects.toThrow();await expect(change(r.active[0].fingerprint,true)).rejects.toThrow();await expect(db.exec("select * from private.csv_measurement_archives")).rejects.toThrow();});
});
it("rechecks administrator activity and rejects reused request IDs with different scope",async()=>{
 const r=await asUser(admin,review);await asUser(admin,()=>change(r.active[0].fingerprint));
 await asUser(admin,async()=>{await expect(change("0".repeat(32))).rejects.toThrow();});
 await db.query("update public.app_accounts set is_active=false where user_id=$1",[admin]);await asUser(admin,async()=>{await expect(review()).rejects.toThrow();await expect(change(r.active[0].fingerprint,true)).rejects.toThrow();});
});
