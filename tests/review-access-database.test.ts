import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
const db = new PGlite();
const admin="11111111-1111-4111-8111-111111111111",coach="22222222-2222-4222-8222-222222222222",linked="33333333-3333-4333-8333-333333333333",unlinked="44444444-4444-4444-8444-444444444444",inactive="55555555-5555-4555-8555-555555555555";
const athletes=["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","cccccccc-cccc-4ccc-8ccc-cccccccccccc","dddddddd-dddd-4ddd-8ddd-dddddddddddd"];
beforeAll(async()=>{
  await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
  for(const file of ["202609040001_identity_and_access.sql","202609210003_bulk_player_invitations.sql","202610010001_invitation_rate_limit_recovery.sql","202610010002_athlete_headshots.sql","202610020001_review_access_fixes.sql"])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
  for(const [id,role,active] of [[admin,"admin",true],[coach,"coach",true],[linked,"player",true],[unlinked,"player",true],[inactive,"player",false]] as const){await db.query("insert into auth.users values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,$2)",[id,active]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);}
  for(const [i,id] of athletes.entries()){
    await db.query("insert into public.athletes(id,athlete_code,first_name,last_name,pacific_email) values($1,$2,'Fictional','Player',$3)",[id,`SYN-00${i}`,`fictional.${i}@example.com`]);
    await db.query("insert into public.athlete_seasons(athlete_id,season,roster_status) values($1,$2,$3)",[id,i===3?"2025-26":"2026-27",["active","redshirt","inactive","active"][i]]);
    await db.query("insert into public.athlete_headshots(athlete_id,image_path) values($1,$2)",[id,`/images/2026/2/23/Fictional_${i}.jpg`]);
  }
  await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)",[linked,athletes[0]]);
});
afterAll(()=>db.close());
async function as<T>(id:string|null,fn:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await fn();}finally{await db.exec("reset role");}}
it("denies anonymous, inactive and unlinked players before the team photo projection",async()=>{for(const id of [null,inactive,unlinked])await as(id,async()=>{await expect(db.exec("select * from public.team_headshots()")).rejects.toThrow();});});
it("returns only eligible current-season public photo fields to linked players and staff",async()=>{
  for(const id of [linked,admin,coach]){
    const rows=(await as(id,()=>db.query("select * from public.team_headshots() order by athlete_code"))).rows;
    expect(rows).toEqual([0,1].map(i=>({athlete_code:`SYN-00${i}`,image_path:`/images/2026/2/23/Fictional_${i}.jpg`})));
  }
  expect((await as(linked,()=>db.query("select * from public.athlete_headshots"))).rows).toHaveLength(1);
  expect((await as(unlinked,()=>db.query("select * from public.athlete_headshots"))).rows).toHaveLength(0);
});
it("keeps invitation history admin-only and preserves the attempted email after a roster correction",async()=>{
  const receipt=(await as(admin,()=>db.query<{result:{id:string}}>("select public.admin_claim_player_invite($1,$2) result",[athletes[1],"fictional.1@example.com"]))).rows[0].result;
  await db.query("update public.athletes set pacific_email='fictional.corrected@example.com' where id=$1",[athletes[1]]);
  const history=(await as(admin,()=>db.query<{result:{id:string;email:string}[]}>("select public.admin_player_invite_attempts() result"))).rows[0].result;
  expect(history[0]).toMatchObject({id:receipt.id,email:"fictional.1@example.com"});
  await as(admin,async()=>{
    await expect(db.query("select public.admin_mark_player_invite_rejected($1,$2,$3)",[receipt.id,athletes[1],"fictional.corrected@example.com"])).rejects.toThrow("No matching pending");
    await db.query("select public.admin_mark_player_invite_rejected($1,$2,$3)",[receipt.id,athletes[1],"fictional.1@example.com"]);
    const next=(await db.query<{result:{claimed:boolean}}>("select public.admin_claim_player_invite($1,$2) result",[athletes[1],"fictional.corrected@example.com"])).rows[0].result;
    expect(next.claimed).toBe(true);
  });
  for(const id of [linked,unlinked,coach,null])await as(id,async()=>{await expect(db.exec("select public.admin_player_invite_attempts()")).rejects.toThrow();});
  expect((await db.query("select * from public.account_athletes")).rows).toHaveLength(1);
});
