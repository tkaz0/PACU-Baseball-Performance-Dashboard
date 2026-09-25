import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const db=new PGlite();
const admin="11111111-1111-4111-8111-111111111111",coach="22222222-2222-4222-8222-222222222222",player="33333333-3333-4333-8333-333333333333",other="44444444-4444-4444-8444-444444444444",athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
async function as<T>(id:string|null,run:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await run();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',false)");}}
const read=()=>db.query<{items:Array<Record<string,unknown>>}>("select public.athlete_focus_items($1) items",[athlete]);
const save=(id:string|null,title:string,shared=false,complete=false,note="Fictional private note")=>db.query<{id:string}>("select public.staff_save_focus_item($1,$2,$3,$4,$5,$6,$7) id",[athlete,id,title,note,"2026-10-10",shared,complete]);
beforeAll(async()=>{
  await db.exec("create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
  for(const name of ["202609040001_identity_and_access.sql","202609240001_coach_focus_items.sql","202609240002_due_coach_focus.sql"])await db.exec(readFileSync(new URL(`../supabase/migrations/${name}`,import.meta.url),"utf8"));
  for(const [id,role] of [[admin,"admin"],[coach,"coach"],[player,"player"],[other,"player"]]){await db.query("insert into auth.users(id) values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);}
  await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'SYN-001','Fictional','Player')",[athlete]);
  await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)",[player,athlete]);
});
afterAll(()=>db.close());
it("keeps staff notes private, shares only explicit active focus, and denies direct table reads",async()=>{
  const first=(await as(admin,()=>save(null,"Fictional goal one"))).rows[0].id;
  expect((await as(player,read)).rows[0].items).toEqual([]);
  expect((await as(coach,read)).rows[0].items[0]).toMatchObject({title:"Fictional goal one",staffNote:"Fictional private note",shared:false});
  await as(coach,()=>save(first,"Fictional goal one",true));
  expect((await as(player,read)).rows[0].items).toMatchObject([{title:"Fictional goal one",staffNote:null,shared:true}]);
  await as(player,async()=>{await expect(db.exec("select * from public.coach_focus_items")).rejects.toThrow();await expect(save(null,"Player edit",true)).rejects.toThrow();});
  await as(other,async()=>{await expect(read()).rejects.toThrow();});
  await as(null,async()=>{await expect(read()).rejects.toThrow();});
});
it("limits active priorities to two and hides completed goals from players",async()=>{
  const second=(await as(admin,()=>save(null,"Fictional goal two",true))).rows[0].id;
  await as(coach,async()=>{await expect(save(null,"Fictional goal three",true)).rejects.toThrow("Complete a focus item");});
  await as(coach,()=>save(second,"Fictional goal two",true,true));
  expect((await as(player,read)).rows[0].items.map(item=>item.title)).toEqual(["Fictional goal one"]);
  await as(admin,()=>save(null,"Fictional goal three"));
  await as(coach,async()=>{await expect(save(second,"Fictional goal two",true,false)).rejects.toThrow("Complete a focus item");});
  await db.query("update public.app_accounts set is_active=false where user_id=$1",[coach]);
  await as(coach,async()=>{await expect(read()).rejects.toThrow();await expect(save(null,"Revoked coach goal")).rejects.toThrow();});
});
it("shows due retests to active staff without including private notes",async()=>{
  const due=(await as(admin,()=>db.query<{items:Array<Record<string,unknown>>}>("select public.staff_due_focus_items('2026-10-17') items"))).rows[0].items;
  expect(due).toHaveLength(2);
  expect(due.every(item=>item.title&&item.playerName==="Fictional Player"&&item.targetDate==="2026-10-10")).toBe(true);
  expect(JSON.stringify(due)).not.toContain("staffNote");
  await as(player,async()=>{await expect(db.exec("select public.staff_due_focus_items('2026-10-17')")).rejects.toThrow();});
});
