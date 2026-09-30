import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll,beforeEach,afterAll,expect,it } from "vitest";
import type { DevelopmentPlan } from "@/lib/development-plans";
const db=new PGlite();
const admin="11111111-1111-4111-8111-111111111111",coach="22222222-2222-4222-8222-222222222222",player="33333333-3333-4333-8333-333333333333",other="44444444-4444-4444-8444-444444444444";
const athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",second="aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbbb",plan="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",drill="cccccccc-cccc-4ccc-8ccc-cccccccccccc",request=(n=1)=>`dddddddd-dddd-4ddd-8ddd-${String(n).padStart(12,"0")}`;
async function as<T>(id:string|null,run:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await run();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',false)");}}
async function read(id=athlete){return (await db.query<{data:DevelopmentPlan[]}>("select public.athlete_development_plans($1) data",[id])).rows[0].data;}
const defaults={athlete,plan,request:request(),revision:0,week:"2026-09-28",focus:"Fictional weekly focus",drills:[{id:drill,title:"Fictional drill",cue:"Fictional coach cue"}],note:"Fictional staff-only note",shared:false,archived:false};
async function save(changes:Partial<typeof defaults>|Record<string,unknown>={}){const p={...defaults,...changes};return (await db.query<{data:{id:string;revision:number}}>("select public.staff_save_development_plan($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) data",[p.athlete,p.plan,p.request,p.revision,p.week,p.focus,JSON.stringify(p.drills),p.note,p.shared,p.archived])).rows[0].data;}
async function complete(changes:Record<string,unknown>={}){const p={athlete,plan,request:request(2),revision:1,drill,completed:true,...changes};return (await db.query<{data:{id:string;revision:number}}>("select public.complete_my_development_drill($1,$2,$3,$4,$5,$6) data",Object.values(p))).rows[0].data;}
beforeAll(async()=>{
  await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
  for(const file of ["202609040001_identity_and_access.sql","202609300001_development_plans.sql"])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
  for(const [id,role] of [[admin,"admin"],[coach,"coach"],[player,"player"],[other,"player"]]){await db.query("insert into auth.users(id) values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);}
  await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'SYN-001','Fictional','Player'),($2,'SYN-002','Fictional','Other')",[athlete,second]);await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2),($3,$4)",[player,athlete,other,second]);
});
beforeEach(async()=>{await db.exec("delete from private.development_plan_requests;delete from public.player_development_plans;delete from public.audit_events;update public.app_accounts set is_active=true;");});
afterAll(()=>db.close());
it("saves an explicit staff draft and exposes only shared own-player plans without staff notes",async()=>{
  await as(coach,()=>save());expect(await as(player,read)).toEqual([]);
  expect((await as(admin,read))[0]).toMatchObject({focus:defaults.focus,staffNote:defaults.note,shared:false,revision:1});
  await as(coach,()=>save({request:request(3),revision:1,shared:true}));const visible=(await as(player,read))[0];expect(visible).toMatchObject({shared:true,staffNote:null,revision:2});expect(visible.drills[0]).toMatchObject({completedAt:null,cue:defaults.drills[0].cue});expect(JSON.stringify(visible)).not.toContain(defaults.note);
  await as(other,async()=>{await expect(read()).rejects.toThrow("access denied");});await as(null,async()=>{await expect(read()).rejects.toThrow();});
});
it("prevents all direct table access and staff impersonation of player completion",async()=>{
  await as(coach,()=>save({shared:true}));
  for(const id of [admin,coach,player])await as(id,async()=>{await expect(db.exec("select * from public.player_development_plans")).rejects.toThrow();await expect(db.exec("update public.player_development_plans set shared_with_player=true")).rejects.toThrow();await expect(db.exec("select * from private.development_plan_requests")).rejects.toThrow();});
  await as(player,async()=>{await expect(save({request:request(3),revision:1})).rejects.toThrow("Active staff");});await as(coach,async()=>{await expect(complete()).rejects.toThrow("Own player");});await as(other,async()=>{await expect(complete()).rejects.toThrow("Own player");});
});
it("lets a player complete and undo a shared own drill with exact idempotent retries",async()=>{
  await as(coach,()=>save({shared:true}));const response=await as(player,()=>complete());expect(response).toEqual({id:plan,revision:2});expect(await as(player,()=>complete())).toEqual(response);
  const completed=(await as(player,read))[0];expect(completed.revision).toBe(2);expect(completed.drills[0].completedAt).not.toBeNull();
  await as(player,async()=>{await expect(complete({completed:false})).rejects.toThrow("Request changed");});
  await as(player,()=>complete({request:request(4),revision:2,completed:false}));expect((await as(player,read))[0].drills[0].completedAt).toBeNull();
});
it("rechecks sharing and account access for completion and uncertain-save retries",async()=>{
  await as(coach,()=>save());await as(player,async()=>{await expect(complete()).rejects.toThrow("Shared plan");});
  await as(coach,()=>save({request:request(3),revision:1,shared:true}));await as(player,()=>complete({revision:2}));
  await db.query("update public.app_accounts set is_active=false where user_id=$1",[player]);await as(player,async()=>{await expect(complete({revision:2})).rejects.toThrow("Own player");await expect(read()).rejects.toThrow("access denied");});
  await db.query("update public.app_accounts set is_active=true where user_id=$1",[player]);await as(coach,()=>save({request:request(4),revision:3,shared:false}));await as(player,async()=>{await expect(complete({revision:2})).rejects.toThrow("Shared plan");});
});
it("checks revisions, immutable athlete/week identity, and one plan per athlete/week",async()=>{
  await as(coach,()=>save({shared:true}));await as(player,()=>complete());
  await as(coach,async()=>{await expect(save({request:request(3),revision:1})).rejects.toThrow("Plan changed");await expect(save({request:request(4),revision:2,athlete:second})).rejects.toThrow("Plan changed");await expect(save({request:request(5),revision:2,week:"2026-10-05"})).rejects.toThrow("Plan changed");await expect(save({request:request(6),plan:second})).rejects.toThrow("already has a plan");});
  await as(player,async()=>{await expect(complete({request:request(7)})).rejects.toThrow("Plan changed");await expect(complete({request:request(8),revision:2,drill:second})).rejects.toThrow("Drill no longer");});
});
it("deduplicates same staff request, rejects changed requests, and keeps receipts actor-scoped",async()=>{
  const response=await as(coach,()=>save());expect(await as(coach,()=>save())).toEqual(response);expect((await as(coach,read))[0].revision).toBe(1);
  await as(coach,async()=>{await expect(save({focus:"Changed request"})).rejects.toThrow("Request changed");});await as(admin,async()=>{await expect(save()).rejects.toThrow("Plan changed");});
  await db.query("update public.app_accounts set is_active=false where user_id=$1",[coach]);await as(coach,async()=>{await expect(save()).rejects.toThrow("Active staff");});
});
it("retains unchanged drill checks and clears a check only when the coach changes its assignment",async()=>{
  await as(coach,()=>save({shared:true}));await as(player,()=>complete());const before=(await as(coach,read))[0].drills[0].completedAt;
  await as(coach,()=>save({request:request(3),revision:2,shared:true,note:"Updated private note"}));expect((await as(player,read))[0].drills[0].completedAt).toBe(before);
  await as(coach,()=>save({request:request(4),revision:3,shared:true,drills:[{...defaults.drills[0],cue:"A newly assigned cue"}]}));expect((await as(player,read))[0].drills[0].completedAt).toBeNull();
});
it("hides archived plans from players, preserves the staff record and blocks completion",async()=>{
  await as(coach,()=>save({shared:true}));await as(coach,()=>save({request:request(3),revision:1,shared:true,archived:true}));expect(await as(player,read)).toEqual([]);expect((await as(coach,read))[0].archived).toBe(true);await as(player,async()=>{await expect(complete()).rejects.toThrow("Shared plan");});
});
it.each<Record<string,unknown>>([{week:"2026-09-29"},{week:"2028-01-03"},{focus:""},{focus:"bad\nfocus"},{drills:[]},{drills:Array(5).fill(defaults.drills[0])},{drills:[defaults.drills[0],defaults.drills[0]]},{drills:[{...defaults.drills[0],completedAt:"2026-09-29"}]},{drills:[{...defaults.drills[0],cue:""}]},{drills:[{...defaults.drills[0],id:"bad"}]}])("rejects invalid or forged plans before mutation %#",async change=>{await as(coach,async()=>{await expect(save(change)).rejects.toThrow();expect(await read()).toEqual([]);});});
it("keeps text and cue content out of audit details",async()=>{await as(coach,()=>save({shared:true}));await as(player,()=>complete());const audits=JSON.stringify((await db.query("select details from public.audit_events")).rows);expect(audits).not.toContain("Fictional");expect(audits).toContain("revision");});
