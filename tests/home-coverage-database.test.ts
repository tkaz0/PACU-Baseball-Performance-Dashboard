import {PGlite} from "@electric-sql/pglite";
import {readFileSync,readdirSync} from "node:fs";
import {beforeAll,beforeEach,afterAll,expect,it} from "vitest";
import {validateHomeCoverage} from "@/lib/home-coverage";
import {buildHomeSummary} from "@/lib/home-summary";
const db=new PGlite();
const admin="11111111-1111-4111-8111-111111111111",coach="22222222-2222-4222-8222-222222222222",player="33333333-3333-4333-8333-333333333333";
const ids=["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","cccccccc-cccc-4ccc-8ccc-cccccccccccc","dddddddd-dddd-4ddd-8ddd-dddddddddddd"];
const receipt="44444444-4444-4444-8444-444444444444";
let today:string;
async function asUser<T>(id:string|null,run:()=>Promise<T>){
 await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);
 try{return await run();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',false)");}
}
async function summary(id:string|null=null){return (await db.query<{data:unknown}>("select public.home_measurement_summary($1::uuid) data",[id])).rows[0].data;}
async function insert(n:number,date:string,athlete=ids[0],source="Fictional testing",start=1){
 await db.query(`insert into public.performance_measurements(observation_id,athlete_id,metric_key,metric,unit,value,measured_at,source,source_file,source_sheet,source_row,source_column,file_hash,import_id,imported_by,imported_at)
 select 'fictional-'||$1::text||'-'||i,$1::uuid,'weight','Weight','lb',180,$2::date,$3,'fictional.csv','Fictional trials',i,0,repeat($6,64),$4::uuid,$5::uuid,'2026-09-25T00:00:00Z' from generate_series($7::integer,$7::integer+$8::integer-1) i`,[athlete,date,source,receipt,admin,athlete.slice(0,1),start,n]);
}
beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 const directory=new URL("../supabase/migrations/",import.meta.url);
 for(const file of readdirSync(directory).filter(name=>name.endsWith('.sql')&&name<="202609060006_staff_performance_imports.sql").sort())await db.exec(readFileSync(new URL(file,directory),"utf8"));
 await db.exec(readFileSync(new URL("202610040001_home_measurement_summary.sql",directory),"utf8"));
 for(const [id,role] of [[admin,"admin"],[coach,"coach"],[player,"player"]]){
  await db.query("insert into auth.users(id) values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);
 }
 for(let i=0;i<ids.length;i++){
  await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,$2,'Fictional','Player')",[ids[i],`SYN-${i+1}`]);
  await db.query("insert into public.athlete_seasons(athlete_id,season,roster_status) values($1,'2026-27',$2)",[ids[i],["active","redshirt","inactive",null][i]]);
 }
 await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)",[player,ids[0]]);
 await db.query("insert into public.performance_imports(id,created_by) values($1,$2)",[receipt,admin]);
 today=(await db.query<{today:string}>("select ((now() at time zone 'America/Los_Angeles')::date)::text today")).rows[0].today;
});
beforeEach(async()=>{await db.exec("delete from public.performance_measurements;update public.app_accounts set is_active=true;");});
afterAll(async()=>db.close());
it("compresses history into coverage metadata while preserving eligible distinct players and dates",async()=>{
 await insert(12,"2026-09-01");await insert(1,"2026-09-20",ids[0],"RENPHO",20);await insert(1,"2026-09-02",ids[1]);await insert(1,"2026-09-02",ids[2]);await insert(1,"2026-08-31",ids[0],"Fictional testing",21);
 const compact=validateHomeCoverage(await asUser(coach,()=>summary()),null,today);
 expect(compact.playerIds).toEqual([ids[0],ids[1],ids[3]]);expect(compact.totalReadings).toBe(14);expect(compact.groups).toHaveLength(3);
 const full=(await asUser(coach,()=>db.query<{athleteId:string;source:string;date:string;importedAt:string}>(`select athlete_id as "athleteId",source,measured_at::text date,to_char(imported_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS')||'+00:00' as "importedAt" from public.performance_measurements`))).rows;
 expect(buildHomeSummary(compact.playerIds,compact.groups,[],today)).toEqual(buildHomeSummary(compact.playerIds,full,[],today));
 for(const row of compact.groups)expect(Object.keys(row).sort()).toEqual(["athleteId","count","date","importedAt","metric","source","unit"]);
});
it("keeps own-player and Admin-as-Player argument scopes exact and denies peers/anonymous",async()=>{
 await insert(3,"2026-09-01");await insert(7,"2026-09-01",ids[1]);
 for(const actor of [admin,player]){const compact=validateHomeCoverage(await asUser(actor,()=>summary(ids[0])),ids[0],today);expect(compact.totalReadings).toBe(3);expect(compact.playerIds).toEqual([ids[0]]);}
 await asUser(player,async()=>{await expect(summary(ids[1])).rejects.toThrow("Authorized player required");await expect(summary()).rejects.toThrow("Active staff required");});
 await asUser(null,async()=>{await expect(summary(ids[0])).rejects.toThrow("permission denied");});
});
it("rechecks inactive accounts and revoked staff roles without relying on cached claims",async()=>{
 for(const actor of [coach,player]){await db.query("update public.app_accounts set is_active=false where user_id=$1",[actor]);await asUser(actor,async()=>{await expect(summary(actor===player?ids[0]:null)).rejects.toThrow(/required/);});}
 await db.query("update public.app_accounts set is_active=true where user_id=$1",[coach]);await db.query("delete from public.account_roles where user_id=$1",[coach]);
 try{await asUser(coach,async()=>{await expect(summary()).rejects.toThrow("Active staff required");});}finally{await db.query("insert into public.account_roles(user_id,role) values($1,'coach')",[coach]);}
});
it("rejects oversized histories instead of silently displaying partial counts",async()=>{
 await insert(20001,"2026-09-01");await asUser(admin,async()=>{await expect(summary()).rejects.toThrow("exceeds reviewed bounds");});
});
it("uses invoker security, pinned search path and read-only table privileges",async()=>{
 const metadata=(await db.query<{prosecdef:boolean;proconfig:string[]}>("select prosecdef,proconfig from pg_proc where proname='home_measurement_summary' and pronamespace='public'::regnamespace")).rows[0];
 expect(metadata.prosecdef).toBe(false);expect(metadata.proconfig).toContain('search_path=""');
 await asUser(coach,async()=>{await expect(db.query("delete from public.performance_measurements")).rejects.toThrow("permission denied");});
});
