import { PGlite } from "@electric-sql/pglite";
import { afterAll,beforeAll,beforeEach,describe,expect,it } from "vitest";
import { readdirSync,readFileSync } from "node:fs";
const db=new PGlite();
const admin="11111111-1111-4111-8111-111111111111",coach="22222222-2222-4222-8222-222222222222",player="33333333-3333-4333-8333-333333333333",unlinked="44444444-4444-4444-8444-444444444444";
const a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",b="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const row=(changes:Record<string,unknown>={})=>({athleteCode:"PAC-0001",metric:"pa",value:3,unit:"count",scope:"cumulative_fall",eventId:null,playedOn:null,sourceRow:2,sourceColumn:2,derivedFrom:[],...changes});
const rateRows=()=>[row(),row({metric:"qpa",sourceColumn:3,value:1}),row({metric:"qpa_pct",sourceColumn:8,value:100*(1/3),unit:"%",derivedFrom:[3,2]})];
async function asUser<T>(id:string|null,run:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await run();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',false)");}}
async function save(rows:unknown=[row()],hash="a".repeat(64),fetched="2026-09-13T12:00:00Z",source="qpa_fall_2026"){return(await db.query<{receipt:{snapshot_id:string;changed:boolean;observations:number}}>("select public.import_game_snapshot($1,$2,$3,$4::jsonb) receipt",[source,hash,fetched,JSON.stringify(rows)])).rows[0].receipt;}
async function read(id:string|null=null){return(await db.query<{data:Record<string,unknown>[]}>("select public.read_game_stats($1) data",[id])).rows[0].data;}
async function counts(){return(await db.query("select (select count(*)::int from public.game_stats) observations,(select count(*)::int from public.game_stat_snapshots) snapshots,(select count(*)::int from public.audit_events where event_type='game_snapshot_imported') audit")).rows[0];}
beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 const dir=new URL("../supabase/migrations/",import.meta.url);for(const file of readdirSync(dir).filter(f=>f.endsWith(".sql")&&f<="202609060009_fall_game_dates.sql").sort())await db.exec(readFileSync(new URL(file,dir),"utf8"));
 await db.exec("create or replace function private.game_sync_now() returns timestamptz language sql stable set search_path='' as $$select '2026-09-15T12:00:00Z'::timestamptz$$;");
 for(const[id,role]of[[admin,"admin"],[coach,"coach"],[player,"player"],[unlinked,"player"]]){await db.query("insert into auth.users values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);}
 for(const[id,code]of[[a,"PAC-0001"],[b,"PAC-0002"]]){await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,$2,'Fictional','Player')",[id,code]);await db.query("insert into public.athlete_seasons(athlete_id,season) values($1,'2026-27')",[id]);}
 await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)",[player,a]);
});
beforeEach(async()=>{await db.exec("delete from public.game_stats;delete from public.game_sync_state;delete from public.game_stat_snapshots;delete from public.audit_events where event_type='game_snapshot_imported';update public.app_accounts set is_active=true;reset extra_float_digits;");});
afterAll(async()=>db.close());
describe("reviewed Fall game snapshots",()=>{
 it("allows staff, preserves precision, and retries without appending cumulative observations",async()=>{
  const first=await asUser(coach,()=>save(rateRows()));expect(first).toMatchObject({changed:true,observations:3});expect(await asUser(admin,()=>save(rateRows()))).toEqual({...first,changed:false});expect(await counts()).toEqual({observations:3,snapshots:1,audit:1});
  await db.exec("set extra_float_digits=0");const rows=await asUser(player,()=>read(a));expect(rows.find(r=>r.metric==="qpa_pct")?.value).toBe(100*(1/3));expect(Object.keys(rows[0]).sort()).toEqual(["source","athlete_id","metric","value","unit","scope","event_id","played_on","source_row","source_column","derived_from","snapshot_id","fetched_at","content_hash"].sort());expect((await db.query<{v:string}>("select current_setting('extra_float_digits') v")).rows[0].v).toBe("0");
 });
 it("replaces the full current source only when newer, and archives its previous snapshot",async()=>{
  await asUser(admin,()=>save());await asUser(coach,()=>save([row({value:4})],"b".repeat(64),"2026-09-14T12:00:00Z"));expect((await asUser(player,()=>read(a)))[0].value).toBe(4);expect(await counts()).toEqual({observations:1,snapshots:2,audit:2});
  await asUser(coach,async()=>{await expect(save([row({value:5})],"c".repeat(64))).rejects.toThrow("newer source");await expect(save([row({athleteCode:"PAC-0002"})],"a".repeat(64))).rejects.toThrow("mapped differently");});expect((await asUser(player,()=>read(a)))[0].value).toBe(4);
 });
 it("refuses partial replacement and changed athlete mappings rather than erasing old entries",async()=>{
  await asUser(admin,()=>save(rateRows()));for(const rows of [[row()],[row({athleteCode:"PAC-0002"})]])await asUser(coach,async()=>{await expect(save(rows,"b".repeat(64),"2026-09-14T12:00:00Z")).rejects.toThrow("Previously recorded source entries are missing");});expect(await counts()).toEqual({observations:3,snapshots:1,audit:1});
 });
 it("rejects unauthorized, inactive and revoked staff with the same JWT, without direct writes",async()=>{
  for(const id of [player,unlinked])await asUser(id,async()=>{await expect(save()).rejects.toThrow("Active import staff required");});await asUser(null,async()=>{await expect(save()).rejects.toThrow("permission denied");});
  await db.query("update public.app_accounts set is_active=false where user_id=$1",[coach]);await asUser(coach,async()=>{await expect(save()).rejects.toThrow("Active import staff required");});
  await asUser(admin,async()=>{await db.exec("reset role");await db.query("delete from public.account_roles where user_id=$1",[admin]);await db.exec("set role authenticated");try{await expect(save()).rejects.toThrow("Active import staff required");}finally{await db.exec("reset role");await db.query("insert into public.account_roles values($1,'admin')",[admin]);await db.exec("set role authenticated");}});
  await asUser(admin,async()=>{await expect(db.query("delete from public.game_stats")).rejects.toThrow("permission denied");});expect(await counts()).toEqual({observations:0,snapshots:0,audit:0});
 });
 it("isolates Player reads and snapshot archives, preserving stricter RLS and revoked SELECT",async()=>{
  await asUser(coach,()=>save([row(),row({athleteCode:"PAC-0002",sourceRow:3})]));expect(await asUser(player,()=>read(a))).toHaveLength(1);expect(await asUser(coach,()=>read())).toHaveLength(2);
  await asUser(player,async()=>{await expect(read()).rejects.toThrow("linked athlete");await expect(read(b)).rejects.toThrow("Athlete access denied");expect((await db.query("select * from public.game_stat_snapshots")).rows).toEqual([]);expect((await db.query("select * from public.game_sync_state")).rows).toEqual([]);});await asUser(unlinked,async()=>{await expect(read(a)).rejects.toThrow("Athlete access denied");});
  await db.exec("create policy fictional_stricter on public.game_stats as restrictive for select to authenticated using(false)");try{expect(await asUser(admin,()=>read())).toEqual([]);}finally{await db.exec("drop policy fictional_stricter on public.game_stats");}
  await db.exec("revoke select on public.game_stats from authenticated");try{await asUser(admin,async()=>{await expect(read()).rejects.toThrow("permission denied");});}finally{await db.exec("grant select on public.game_stats to authenticated");}
 });
 it("fails the entire batch on invalid counts, unsupported metrics, unknown athletes or rate evidence",async()=>{
  for(const invalid of [row({value:-1}),row({value:0.5}),row({athleteCode:"PAC-0999"}),row({metric:"k_pct"}),row({sourceColumn:3}),row({privateText:"must not enter archive"}),row({metric:"qpa_pct",value:10,unit:"%",sourceColumn:8,derivedFrom:[3,2]})])await asUser(admin,async()=>{await expect(save([row({athleteCode:"PAC-0002",sourceRow:3}),invalid])).rejects.toThrow();});expect(await counts()).toEqual({observations:0,snapshots:0,audit:0});
 });
 it("rejects future/start timestamps, malformed hashes and oversized snapshots",async()=>{
  await asUser(admin,async()=>{for(const stamp of ["2026-09-16T00:00:00Z","2026-09-11T23:00:00-07:00","bad","infinity"])await expect(save([row()],"a".repeat(64),stamp)).rejects.toThrow();for(const hash of ["a".repeat(64)+"\n","A".repeat(64),""])await expect(save([row()],hash)).rejects.toThrow("bounded game");await expect(save(Array(10001).fill(row()))).rejects.toThrow("bounded game");});
 });
 it.each(["2026-09-01","2026-09-11"])("accepts an actual Fall game on %s captured after the daily start",async playedOn=>{
  const pitch=row({metric:"pitches",sourceColumn:3,scope:"pitching_event",eventId:"fictional-early-fall",playedOn,sourceRow:40});await asUser(coach,()=>save([pitch],"a".repeat(64),"2026-09-13T12:00:00Z","pitching_fall_2026"));expect((await asUser(player,()=>read(a)))[0].played_on).toBe(playedOn);
  await asUser(coach,async()=>{await expect(save([{...pitch,playedOn:"2026-08-31"}],"b".repeat(64),"2026-09-14T12:00:00Z","pitching_fall_2026")).rejects.toThrow("outside the observed Fall period");});
 });
 it("keeps pitching events distinct and rejects conflicting event dates or source rows",async()=>{
  const pitch=(changes:Record<string,unknown>={})=>row({metric:"pitches",sourceColumn:3,value:20,scope:"pitching_event",eventId:"fictional-game",playedOn:"2026-09-12",sourceRow:40,...changes});
  const rows=[pitch(),pitch({metric:"strikes",sourceColumn:4,value:10}),pitch({metric:"strike_pct",sourceColumn:5,value:50,unit:"%",derivedFrom:[4,3]}),pitch({eventId:"fictional-game-2",playedOn:"2026-09-13",sourceRow:76})];await asUser(coach,()=>save(rows,"a".repeat(64),"2026-09-13T20:00:00Z","pitching_fall_2026"));expect(await asUser(player,()=>read(a))).toHaveLength(4);
  for(const invalid of [[pitch(),pitch({athleteCode:"PAC-0002",playedOn:"2026-09-13"})],[pitch(),pitch({metric:"strikes",sourceColumn:4,sourceRow:41})],[pitch({playedOn:"2026-09-14"})]])await asUser(coach,async()=>{await expect(save(invalid,"b".repeat(64),"2026-09-13T20:00:00Z","pitching_fall_2026")).rejects.toThrow();});expect(await counts()).toEqual({observations:4,snapshots:1,audit:1});
 });
});
