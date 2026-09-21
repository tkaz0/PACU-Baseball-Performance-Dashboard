import { PGlite } from "@electric-sql/pglite";
import { readdirSync,readFileSync } from "node:fs";
import { beforeAll,beforeEach,afterAll,it,expect } from "vitest";
import {parseHittingTeamAverages} from "@/lib/hitting-team-averages";
const db=new PGlite(), admin="11111111-1111-4111-8111-111111111111",coach="22222222-2222-4222-8222-222222222222",player="33333333-3333-4333-8333-333333333333",athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",peer="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",hash="a".repeat(64);
async function asUser<T>(id:string|null,run:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await run();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',false)");}}
const observation=(column=9,key="blast_vertical_bat_angle",value=-28.2,unit="deg",source="Blast Motion · Average · 2026-09-13:2026-09-20",fileHash=hash)=>({observation_id:`observation:${JSON.stringify([fileHash,"CSV",2,column])}`,athlete_code:"SYN-001",metric_key:key,measured_at:"2026-09-20",value,unit,source,source_file:"fictional.csv",source_sheet:"CSV",source_row:2,file_hash:fileHash});
const save=(rows:ReturnType<typeof observation>[])=>db.query<{data:{created:number;unchanged:number}}>("select public.admin_import_performance($1::jsonb) data",[JSON.stringify(rows)]);
beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 const dir=new URL("../supabase/migrations/",import.meta.url);for(const f of readdirSync(dir).filter(n=>n.endsWith('.sql')).sort())await db.exec(readFileSync(new URL(f,dir),'utf8'));
 for(const [id,role] of [[admin,"admin"],[coach,"coach"],[player,"player"]]){await db.query("insert into auth.users(id) values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);}
 await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'SYN-001','Fictional','One'),($2,'SYN-002','Fictional','Two')",[athlete,peer]);
 await db.query("insert into public.athlete_seasons(athlete_id,season) values($1,'2026-27'),($2,'2026-27')",[athlete,peer]);
 await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)",[player,athlete]);
});
beforeEach(async()=>{await db.exec("delete from private.csv_measurement_archives;delete from public.performance_measurements;delete from public.performance_imports;delete from public.audit_events;update public.app_accounts set is_active=true;update public.athlete_seasons set roster_status=null;");});
afterAll(()=>db.close());

async function averages(){return parseHittingTeamAverages((await db.query<{data:unknown}>("select public.hitting_team_averages() data")).rows[0].data);}
function report(code="SYN-001",h="a",start="2026-09-13",end="2026-09-20",count=10,speed=60,kind="Average"){
 return [[2,"blast_swing_count",count,"count"],[3,kind==="P95"?"p95_bat_speed":"avg_bat_speed",speed,"mph"],[9,"blast_vertical_bat_angle",-30,"deg"]].map(([col,key,value,unit])=>({...observation(Number(col),String(key),Number(value),String(unit),`Blast Motion · ${kind} · ${start}:${end}`,h.repeat(64)),athlete_code:code,measured_at:end}));
}
it("weights saved Fall swings, never doubles paired peaks, and exposes only aggregates to players",async()=>{
 await asUser(admin,()=>save([...report(),...report("SYN-002","b",undefined,undefined,30,80),...report("SYN-001","c","2026-09-21","2026-09-27",10,70),...report("SYN-001","d",undefined,undefined,10,100,"P95")]));
 await asUser(player,async()=>{const rows=await averages();expect(rows).toHaveLength(2);expect(rows.find(r=>r.metricKey==="avg_bat_speed")).toMatchObject({value:74,athleteCount:2,swingCount:50,source:"blast_fall"});expect(rows.find(r=>r.metricKey==="blast_vertical_bat_angle")?.value).toBe(-30);const raw=await db.query<{athlete_id:string}>("select athlete_id from public.performance_measurements");expect(raw.rows.every(r=>r.athlete_id===athlete)).toBe(true);});
});
it("withholds incomplete player metrics and invalid count reports; excludes ineligible players",async()=>{
 await asUser(admin,()=>save([...report(),...report("SYN-001","b","2026-09-21","2026-09-27").filter(r=>r.metric_key!=="avg_bat_speed"),...report("SYN-002","c")]));
 await asUser(coach,async()=>{expect((await averages()).find(r=>r.metricKey==="avg_bat_speed")).toMatchObject({athleteCount:1,swingCount:10});});
 await db.query("update public.athlete_seasons set roster_status='inactive' where athlete_id=$1",[peer]);
 await asUser(player,async()=>{expect((await averages()).some(r=>r.metricKey==="avg_bat_speed")).toBe(false);});
 await db.query("delete from public.performance_measurements where metric_key='blast_swing_count' and athlete_id=$1",[athlete]);
 await asUser(player,async()=>{expect(await averages()).toEqual([]);});
});
it("Full Swing uses latest player values and keeps source, units, metric and season separate",async()=>{
 const fs=(code:string,h:string,value:number,source="Full Swing · Intrasquad",unit="mph",date="2026-09-20",key="avg_bat_speed")=>({...observation(0,key,value,unit,source,h.repeat(64)),athlete_code:code,measured_at:date});
 await asUser(admin,()=>save([fs("SYN-001","a",60),fs("SYN-002","b",80),fs("SYN-001","c",100,"Full Swing · Practice"),fs("SYN-001","d",90,"Full Swing · Game"),fs("SYN-001","e",40,undefined,undefined,"2026-09-10"),fs("SYN-001","f",120,undefined,"km/h"),fs("SYN-001","1",20,undefined,undefined,"2026-08-20"),fs("SYN-001","2",95,undefined,undefined,undefined,"max_bat_speed")]));
 await asUser(player,async()=>{const rows=await averages();expect(rows).toHaveLength(5);expect(rows.find(r=>r.source==="full swing · intrasquad"&&r.metricKey==="avg_bat_speed"&&r.unit==="mph")).toMatchObject({value:70,athleteCount:2,swingCount:null});expect(rows.find(r=>r.source==="full swing · practice")?.value).toBe(100);});
});
it("denies anonymous and inactive accounts immediately",async()=>{
 await asUser(null,async()=>{await expect(averages()).rejects.toThrow();});
 await db.query("update public.app_accounts set is_active=false where user_id=$1",[player]);
 await asUser(player,async()=>{await expect(averages()).rejects.toThrow();});
});
it("withholds legacy overlapping periods even if they predate the import guard",async()=>{
 await asUser(admin,()=>save([...report(),...report("SYN-001","b","2026-09-21","2026-09-27")]));
 await db.query("update public.performance_measurements set source='Blast Motion · Average · 2026-09-20:2026-09-27' where file_hash=$1",["b".repeat(64)]);
 await asUser(player,async()=>{expect(await averages()).toEqual([]);});
});
