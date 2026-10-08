import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
import { emptyDraft, validateDraftSnapshot } from "@/lib/draft-board";
const db=new PGlite();
const admin="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222",coach="33333333-3333-4333-8333-333333333333",player="44444444-4444-4444-8444-444444444444";
const request="55555555-5555-4555-8555-555555555555",request2="66666666-6666-4666-8666-666666666666",pid="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const document=()=>({...emptyDraft(),players:[{id:pid,name:"Fictional Player",group:"Pitchers",positions:"P",athleteId:null}]});
async function asUser<T>(id:string|null,run:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await run();}finally{await db.exec("reset role");}}
const save=async(doc:unknown=document(),rev=0,req=request)=>(await db.query<{data:unknown}>("select public.save_my_boxer_draft($1::uuid,$2,$3::jsonb) data",[req,rev,JSON.stringify(doc)])).rows[0].data as {board:unknown;savedRevision:number};
const read=async()=>(await db.query<{data:unknown}>("select public.my_boxer_draft() data")).rows[0].data;
beforeAll(async()=>{
  await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
  const directory=new URL("../supabase/migrations/",import.meta.url);
  for(const file of readdirSync(directory).filter(name=>name.endsWith('.sql')&&name<="202609060006_staff_performance_imports.sql").sort())await db.exec(readFileSync(new URL(file,directory),"utf8"));
  await db.exec(readFileSync(new URL("202610080001_private_boxer_draft.sql",directory),"utf8"));
  await db.exec(readFileSync(new URL("202610080002_draft_planning.sql",directory),"utf8"));
  for(const [id,role] of [[admin,"admin"],[other,"admin"],[coach,"coach"],[player,"player"]]){
    await db.query("insert into auth.users(id) values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);
  }
});
beforeEach(async()=>{await db.exec("delete from private.boxer_draft_revisions;delete from public.boxer_draft_boards;update public.app_accounts set is_active=true;");});
afterAll(async()=>db.close());
it("saves only the administrator's own board; even another administrator cannot read it",async()=>{
  await asUser(admin,async()=>{expect(await read()).toBeNull();const result=await save();expect(validateDraftSnapshot(result.board)).toMatchObject({revision:1,document:document()});});
  await asUser(other,async()=>{expect(await read()).toBeNull();expect((await db.query("select * from public.boxer_draft_boards")).rows).toHaveLength(0);});
  for(const id of [coach,player,null])await asUser(id,async()=>{await expect(read()).rejects.toThrow(/required|permission denied/);await expect(save()).rejects.toThrow(/required|permission denied/);});
});
it("retains exact retries, rejects changed retries and stale competing picks, and audits undo",async()=>{
  await asUser(admin,async()=>{
    await save();await save();expect((await db.query("select revision from public.boxer_draft_boards")).rows[0]).toMatchObject({revision:1});
    await expect(save({...document(),title:"Different"})).rejects.toThrow("retry differs");
    const picked={...document(),picks:[pid]};await save(picked,1,request2);
    await expect(save(document(),1,"77777777-7777-4777-8777-777777777777")).rejects.toThrow("Draft changed");
    const old=await save();expect(old.savedRevision).toBe(1);expect(validateDraftSnapshot(old.board).revision).toBe(2);
    await save(document(),2,"88888888-8888-4888-8888-888888888888");expect(validateDraftSnapshot(await read()).document.picks).toEqual([]);
    await expect(db.query("delete from public.boxer_draft_boards")).rejects.toThrow("permission denied");await expect(db.query("select * from private.boxer_draft_revisions")).rejects.toThrow("permission denied");
  });
  expect((await db.query("select document from private.boxer_draft_revisions order by saved_revision")).rows).toHaveLength(3);
});
it("rejects malformed JSON, duplicates, unavailable picks, captain overlap and invalid profile links atomically",async()=>{
  const doc=document(),unavailable={...doc,players:[{...doc.players[0],group:"Injured / Student Assistants"}],picks:[pid]};
  for(const bad of [{},null,[],{...doc,extra:true},{...doc,players:[doc.players[0],doc.players[0]]},{...doc,picks:[pid,pid]},unavailable,
    {...doc,teams:[{name:"Team 1",captains:["Fictional Player"]},{name:"Team 2",captains:[]}]},
    {...doc,players:[{...doc.players[0],athleteId:pid}]}, {...doc,players:[{}]}, {...doc,title:"\nBad"}]){
    await asUser(admin,async()=>{await expect(save(bad)).rejects.toThrow("Invalid draft details");expect(await read()).toBeNull();});
  }
});
it("rechecks active status and roles at read and save time",async()=>{
  await asUser(admin,()=>save());await db.query("update public.app_accounts set is_active=false where user_id=$1",[admin]);
  await asUser(admin,async()=>{await expect(read()).rejects.toThrow("required");await expect(save()).rejects.toThrow("required");expect((await db.query("select * from public.boxer_draft_boards")).rows).toHaveLength(0);});
});
it("persists private rankings and captain depth while rejecting cross-team/undrafted placements and incomplete boards",async()=>{
  const base=document();base.teams[0].captains=["Fictional Captain"];
  const plan={bigBoard:[pid],placements:[[{playerId:"captain-0-0",position:"SS"}],[]]};
  await asUser(admin,async()=>{
    const saved=await save({...base,planning:plan});expect(validateDraftSnapshot(saved.board).document.planning).toEqual(plan);
    for(const bad of [{...plan,bigBoard:[]},{...plan,bigBoard:[pid,pid]},{...plan,extra:1},{...plan,placements:[[{playerId:pid,position:"P"}],[]]},{...plan,placements:[[],[{playerId:"captain-0-0",position:"SS"}]]},{...plan,placements:[[{playerId:"captain-0-0",position:"Bad"}],[]]},{...plan,placements:[[{playerId:"captain-0-0",position:"SS"},{playerId:"captain-0-0",position:"SS"}],[]]}])await expect(save({...base,planning:bad},1,request2)).rejects.toThrow("Invalid draft details");
    const drafted={...base,picks:[pid],planning:{...plan,placements:[[{playerId:pid,position:"P"},{playerId:pid,position:"CF"},{playerId:"captain-0-0",position:"SS"}],[]]}};
    await save(drafted,1,request2);expect(validateDraftSnapshot(await read()).document.planning).toEqual(drafted.planning);
  });
  await asUser(other,async()=>expect(await read()).toBeNull());
});
