import { PGlite } from "@electric-sql/pglite";
import { readdirSync,readFileSync } from "node:fs";
import { beforeAll,beforeEach,afterAll,it,expect } from "vitest";
const db=new PGlite(), admin="11111111-1111-4111-8111-111111111111",coach="22222222-2222-4222-8222-222222222222",player="33333333-3333-4333-8333-333333333333",athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",peer="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",hash="a".repeat(64);
async function asUser<T>(id:string|null,run:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await run();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',false)");}}
const observation=(column=9,key="blast_vertical_bat_angle",value=-28.2,unit="deg",source="Blast Motion · Average · 2026-09-13:2026-09-20",fileHash=hash)=>({observation_id:`observation:${JSON.stringify([fileHash,"CSV",2,column])}`,athlete_code:"SYN-001",metric_key:key,measured_at:"2026-09-20",value,unit,source,source_file:"fictional.csv",source_sheet:"CSV",source_row:2,file_hash:fileHash});
const save=(rows:ReturnType<typeof observation>[])=>db.query<{data:{created:number;unchanged:number}}>("select public.admin_import_performance($1::jsonb) data",[JSON.stringify(rows)]);
beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 const dir=new URL("../supabase/migrations/",import.meta.url);for(const f of readdirSync(dir).filter(n=>n.endsWith('.sql')).sort())await db.exec(readFileSync(new URL(f,dir),'utf8'));
 for(const [id,role] of [[admin,"admin"],[coach,"coach"],[player,"player"]]){await db.query("insert into auth.users(id) values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);}
 await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'SYN-001','Fictional','One'),($2,'SYN-002','Fictional','Two')",[athlete,peer]);
});
beforeEach(async()=>{await db.exec("delete from private.csv_measurement_archives;delete from public.performance_measurements;delete from public.performance_imports;delete from public.audit_events;update public.app_accounts set is_active=true;");});
afterAll(()=>db.close());
it("accepts signed Blast angles via ordinary staff sessions and preserves exact retry data",async()=>{await asUser(coach,async()=>{expect((await save([observation()])).rows[0].data).toMatchObject({created:1,unchanged:0});expect((await save([observation()])).rows[0].data).toMatchObject({created:0,unchanged:1});});expect((await db.query<{value:number}>("select value from public.performance_measurements")).rows[0].value).toBe(-28.2);});
it("rejects negative non-angle values, source spoofing, wrong columns and invalid counts",async()=>{await asUser(admin,async()=>{for(const row of [observation(3,"avg_bat_speed",-1,"mph"),observation(9,"blast_vertical_bat_angle",-1,"deg","RENPHO"),observation(8),observation(2,"blast_swing_count",1.2,"count"),observation(2,"blast_swing_count",0,"count")])await expect(save([row])).rejects.toThrow();});expect((await db.query("select * from public.performance_measurements")).rows).toHaveLength(0);});
it("rejects remapping a source coordinate or importing another export for the same period",async()=>{await asUser(admin,async()=>{await save([observation(3,"avg_bat_speed",60,"mph")]);await expect(save([observation(3,"p95_bat_speed",60,"mph","Blast Motion · P95 · 2026-09-13:2026-09-20")])).rejects.toThrow();await expect(save([observation(3,"avg_bat_speed",60,"mph",undefined,"f".repeat(64))])).rejects.toThrow();expect((await save([observation(3,"p95_bat_speed",70,"mph","Blast Motion · P95 · 2026-09-13:2026-09-20","f".repeat(64))])).rows[0].data.created).toBe(1);});});
it.each([null,player])("denies saving for nonstaff %s",async id=>{await asUser(id,async()=>{await expect(save([observation()])).rejects.toThrow();});});
it("rechecks account activity",async()=>{await db.query("update public.app_accounts set is_active=false where user_id=$1",[coach]);await asUser(coach,async()=>{await expect(save([observation()])).rejects.toThrow();});});

it("rejects overlapping weekly dates while allowing the paired peak report and a new distinct week",async()=>{await asUser(admin,async()=>{
 await save([observation()]);
 const make=(start:string,end:string,kind="Average")=>{const source=`Blast Motion · ${kind} · ${start}:${end}`;return {...observation(9,"blast_vertical_bat_angle",-25,"deg",source,"f".repeat(64)),measured_at:end};};
 await expect(save([make("2026-09-20","2026-09-27")])).rejects.toThrow("overlap");
 expect((await save([make("2026-09-13","2026-09-20","P95")])).rows[0].data.created).toBe(1);
 const next=make("2026-09-21","2026-09-27");next.file_hash="b".repeat(64);next.observation_id=`observation:${JSON.stringify([next.file_hash,"CSV",2,9])}`;
 expect((await save([next])).rows[0].data.created).toBe(1);
});});
