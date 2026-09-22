import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const db = new PGlite();
const admin="11111111-1111-4111-8111-111111111111", coach="22222222-2222-4222-8222-222222222222";
const player="33333333-3333-4333-8333-333333333333", own="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", peer="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const one=()=>({athleteCode:"PAC-0001",fileHash:"a".repeat(64),sourceFile:"fictional-session.csv",sourceRow:2,pitchNumber:1,playedOn:"2026-09-11",category:"intrasquad",exitVelocity:94.321,launchAngle:-12.5});
beforeAll(async()=>{
  await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
  for(const file of ["202609040001_identity_and_access.sql","202609220002_full_swing_contacts.sql","202609220003_full_swing_contact_file_consistency.sql"])
    await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
  for(const [id,role] of [[admin,"admin"],[coach,"coach"],[player,"player"]]) {
    await db.query("insert into auth.users values($1)",[id]);
    await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);
    await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);
  }
  await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'PAC-0001','Fictional','One'),($2,'PAC-0002','Fictional','Two')",[own,peer]);
  await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)",[player,own]);
});
afterAll(()=>db.close());
async function as<T>(id:string|null,fn:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await fn();}finally{await db.exec("reset role");}}
async function save(rows:unknown){return (await db.query<{result:{created:number;unchanged:number}}>("select public.staff_import_full_swing_contacts($1::jsonb) result",[JSON.stringify(rows)])).rows[0].result;}

it("saves paired events for staff, supports identical retries, and never moves a source row",async()=>{
  expect(await as(coach,()=>save([one()]))).toEqual({created:1,unchanged:0});
  expect(await as(admin,()=>save([one()]))).toEqual({created:0,unchanged:1});
  await as(admin,async()=>{await expect(save([{...one(),athleteCode:"PAC-0002"}])).rejects.toThrow("changed");});
  await as(coach,async()=>{await expect(save([{...one(),launchAngle:5}])).rejects.toThrow("changed");});
});
it("allows only own-player reads and blocks player and anonymous imports",async()=>{
  await as(player,async()=>{
    expect((await db.query("select launch_angle from public.full_swing_contacts")).rows).toHaveLength(1);
    await expect(save([one()])).rejects.toThrow("Active staff");
    await expect(db.exec("delete from public.full_swing_contacts")).rejects.toThrow("permission denied");
  });
  await as(null,async()=>{await expect(db.exec("select * from public.full_swing_contacts")).rejects.toThrow("permission denied");});
  await db.query("update public.app_accounts set is_active=false where user_id=$1",[coach]);
  await as(coach,async()=>{await expect(save([one()])).rejects.toThrow("Active staff");});
});
it("rejects invalid pairs atomically",async()=>{
  for(const row of [{...one(),exitVelocity:0},{...one(),launchAngle:91},{...one(),sourceRow:2.5},{...one(),category:"bullpen"}])
    await as(admin,async()=>{await expect(save([row])).rejects.toThrow();});
  const next={...one(),sourceRow:3,pitchNumber:2},bad={...one(),sourceRow:4,pitchNumber:3,athleteCode:"PAC-9999"};
  await as(admin,async()=>{await expect(save([next,bad])).rejects.toThrow("Unknown reviewed athlete");});
  expect((await db.query("select source_row from public.full_swing_contacts")).rows).toHaveLength(1);
});
it("keeps one date and category for an original file across additive saves",async()=>{
  const next={...one(),sourceRow:3,pitchNumber:2};
  await as(admin,async()=>{await expect(save([{...next,category:"practice"}])).rejects.toThrow("category");});
  await as(admin,async()=>{await expect(save([{...next,playedOn:"2026-09-12"}])).rejects.toThrow("date");});
  expect(await as(admin,()=>save([next]))).toEqual({created:1,unchanged:0});
});
