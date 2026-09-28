import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
const db=new PGlite(),admin="11111111-1111-4111-8111-111111111111",coach="22222222-2222-4222-8222-222222222222",player="33333333-3333-4333-8333-333333333333",other="44444444-4444-4444-8444-444444444444",athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",view="aaaaaaaa-1111-4111-8111-111111111111";
const config={version:1,x:JSON.stringify(["weight","lb","renpho"]),y:JSON.stringify(["muscle_mass","lb","renpho"]),period:"fall",colorBy:"academicClass",classFilter:"",positionFilter:"",window:30,hidden:[]};
async function as<T>(id:string|null,run:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await run();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',false)");}}
const save=(id=view,value:unknown=config)=>db.query("select public.save_my_analytics_view($1,'Fictional comparison',$2)",[id,value]);
beforeAll(async()=>{
 await db.exec("create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
 for(const file of ["202609040001_identity_and_access.sql","202609280003_personal_dashboard_tools.sql"])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
 for(const [id,role] of [[admin,"admin"],[coach,"coach"],[player,"player"],[other,"player"]]){await db.query("insert into auth.users values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);}
 await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'SYN-001','Fictional','Athlete')",[athlete]);await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)",[player,athlete]);
});
afterAll(()=>db.close());
it("keeps saved views per account, validates config and permits identical retries only",async()=>{
 await as(admin,()=>save());await as(admin,()=>save());
 expect((await as(admin,()=>db.query<{v:unknown[]}>("select public.my_saved_analytics_views() v"))).rows[0].v).toHaveLength(1);
 expect((await as(coach,()=>db.query<{v:unknown[]}>("select public.my_saved_analytics_views() v"))).rows[0].v).toEqual([]);
 await as(coach,async()=>{await expect(save()).rejects.toThrow();await expect(db.query("select public.archive_my_analytics_view($1)",[view])).rejects.toThrow();});
 await as(admin,async()=>{await expect(save(view,{...config,window:7})).rejects.toThrow();for(const patch of [{version:null},{period:null},{window:null},{colorBy:null},{hidden:[null]},{x:'["bad"]'},{x:config.y},{unexpected:"x"}])await expect(save("bbbbbbbb-1111-4111-8111-111111111111",{...config,...patch})).rejects.toThrow();});
});
it("denies anonymous, player and revoked staff views and direct private state access",async()=>{
 for(const id of [null,player,other])await as(id,async()=>{await expect(save()).rejects.toThrow();await expect(db.exec("select public.my_saved_analytics_views()")).rejects.toThrow();});
 await as(admin,async()=>{await expect(db.exec("select * from public.saved_analytics_views")).rejects.toThrow();await expect(db.exec("select * from public.dashboard_visits")).rejects.toThrow();});
 await db.query("update public.app_accounts set is_active=false where user_id=$1",[coach]);await as(coach,async()=>{await expect(db.exec("select public.my_saved_analytics_views()")).rejects.toThrow();});await db.query("update public.app_accounts set is_active=true where user_id=$1",[coach]);
});
it("records only the account's own allowed visit scope with stale/future guards and monotonic retries",async()=>{
 const scope=`athlete:${athlete}`;
 await as(player,async()=>{expect((await db.query<{v:unknown}>("select public.my_dashboard_visit($1) v",[scope])).rows[0].v).toBeNull();await db.query("select public.record_my_dashboard_visit($1,now()-interval '1 minute')",[scope]);await db.query("select public.record_my_dashboard_visit($1,now()-interval '2 minutes')",[scope]);await expect(db.query("select public.record_my_dashboard_visit($1,now()+interval '1 minute')",[scope])).rejects.toThrow();await expect(db.query("select public.record_my_dashboard_visit($1,now()-interval '1 hour')",[scope])).rejects.toThrow();await expect(db.exec("select public.my_dashboard_visit('staff')")).rejects.toThrow();});
 for(const id of [null,other])await as(id,async()=>{await expect(db.query("select public.my_dashboard_visit($1)",[scope])).rejects.toThrow();await expect(db.query("select public.record_my_dashboard_visit($1,now())",[scope])).rejects.toThrow();});
 await db.query("update public.dashboard_visits set seen_at=now()-interval '2 hours' where user_id=$1",[player]);
 await as(player,()=>db.query("select public.record_my_dashboard_visit($1,now()-interval '1 minute')",[scope]));
 const first=(await as(player,()=>db.query<{v:{seenAt:string;previousSeenAt:string}}>("select public.my_dashboard_visit($1) v",[scope]))).rows[0].v;
 expect(Date.parse(first.seenAt)-Date.parse(first.previousSeenAt)).toBeGreaterThan(30*60_000);
 await as(player,()=>db.query("select public.record_my_dashboard_visit($1,now())",[scope]));
 const again=(await as(player,()=>db.query<{v:{previousSeenAt:string}}>("select public.my_dashboard_visit($1) v",[scope]))).rows[0].v;expect(again.previousSeenAt).toBe(first.previousSeenAt);
 expect((await as(admin,()=>db.query<{v:unknown}>("select public.my_dashboard_visit('staff') v"))).rows[0].v).toBeNull();
});
