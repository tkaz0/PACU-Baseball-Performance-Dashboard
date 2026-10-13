import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
import { emptyBwsPlan, validateBwsSnapshot } from "@/lib/bws-team";
// Fictional identities only.
const db=new PGlite();
const admin="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222",coach="33333333-3333-4333-8333-333333333333",player="44444444-4444-4444-8444-444444444444";
const request="55555555-5555-4555-8555-555555555555",request2="66666666-6666-4666-8666-666666666666",pid="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const document=()=>({...emptyBwsPlan("Fictional Team"),players:[{id:pid,name:"Fictional Player",athleteId:null,role:"pitcher"}]});
const legacy=()=>{const {series:_series,...rest}=document();void _series;return rest;};
async function asUser<T>(id:string|null,run:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await run();}finally{await db.exec("reset role");}}
const save=async(doc:unknown=document(),rev=0,req=request)=>(await db.query<{data:unknown}>("select public.save_my_bws_team_plan($1::uuid,$2,$3::jsonb) data",[req,rev,JSON.stringify(doc)])).rows[0].data as {plan:unknown;savedRevision:number};
const read=async()=>(await db.query<{data:unknown}>("select public.my_bws_team_plan() data")).rows[0].data;
beforeAll(async()=>{
  await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
  const directory=new URL("../supabase/migrations/",import.meta.url);
  for(const file of readdirSync(directory).filter(name=>name.endsWith('.sql')&&name<="202609060006_staff_performance_imports.sql").sort())await db.exec(readFileSync(new URL(file,directory),"utf8"));
  await db.exec(readFileSync(new URL("202610080001_private_boxer_draft.sql",directory),"utf8"));
  await db.exec(readFileSync(new URL("202610130001_bws_team_plans.sql",directory),"utf8"));
  await db.exec(readFileSync(new URL("202610130002_bws_series.sql",directory),"utf8"));
  for(const [id,role] of [[admin,"admin"],[other,"admin"],[coach,"coach"],[player,"player"]]){
    await db.query("insert into auth.users(id) values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);
  }
});
beforeEach(async()=>{await db.exec("delete from private.bws_team_plan_revisions;delete from public.bws_team_plans;update public.app_accounts set is_active=true;");});
afterAll(async()=>db.close());
it("saves only the administrator's own plan; another administrator, coaches, players and anonymous users cannot read it",async()=>{
  await asUser(admin,async()=>{expect(await read()).toBeNull();const result=await save();expect(validateBwsSnapshot(result.plan)).toMatchObject({revision:1,document:document()});});
  await asUser(other,async()=>{expect(await read()).toBeNull();expect((await db.query("select * from public.bws_team_plans")).rows).toHaveLength(0);});
  for(const id of [coach,player,null])await asUser(id,async()=>{await expect(read()).rejects.toThrow(/required|permission denied/);await expect(save()).rejects.toThrow(/required|permission denied/);});
});
it("keeps identical retries, rejects changed retries, stale revisions, malformed plans and unknown athlete links",async()=>{
  await asUser(admin,async()=>{
    await save();await save();expect((await db.query("select revision from public.bws_team_plans")).rows[0]).toMatchObject({revision:1});
    await expect(save({...document(),name:"Different"})).rejects.toThrow("retry differs");
    await save({...document(),name:"Renamed"},1,request2);
    await expect(save(document(),1,"77777777-7777-4777-8777-777777777777")).rejects.toThrow("changed");
    await expect(save({...document(),extra:true},2,"88888888-8888-4888-8888-888888888888")).rejects.toThrow("Invalid team plan");
    await expect(save({...document(),players:[{id:pid,name:"Fictional Player",athleteId:"99999999-9999-4999-8999-999999999999",role:"pitcher"}]},2,"88888888-8888-4888-8888-888888888889")).rejects.toThrow("Invalid team plan");
    await expect(db.query("delete from public.bws_team_plans")).rejects.toThrow("permission denied");await expect(db.query("select * from private.bws_team_plan_revisions")).rejects.toThrow("permission denied");
  });
  expect((await db.query("select document from private.bws_team_plan_revisions order by saved_revision")).rows).toHaveLength(2);
});
it("accepts plans with and without the series object and rejects unknown scouting links",async()=>{
  await asUser(admin,async()=>{
    await save(legacy());
    await save(document(),1,request2);
    await expect(save({...document(),series:{...document().series,opponents:[{athleteId:"99999999-9999-4999-8999-999999999999",role:"position"}]}},2,"88888888-8888-4888-8888-88888888888a")).rejects.toThrow("Invalid team plan");
  });
});
