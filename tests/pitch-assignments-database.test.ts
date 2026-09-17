import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const db=new PGlite(), admin="11111111-1111-4111-8111-111111111111",coach="22222222-2222-4222-8222-222222222222",player="33333333-3333-4333-8333-333333333333",hash="a".repeat(64);
beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 for(const file of ["202609040001_identity_and_access.sql","202609170001_pitch_assignments.sql"])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
 for(const [id,role] of [[admin,"admin"],[coach,"coach"],[player,"player"]]){await db.query("insert into auth.users values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);}
});
afterAll(()=>db.close());
async function as<T>(id:string|null,fn:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await fn();}finally{await db.exec("reset role");}}
async function call(version:number|null=null,rows:unknown=null){return (await db.query<{result:{version:number;assignments:unknown[]}}>("select public.staff_full_swing_pitch_labels($1,$2,$3::jsonb) result",[hash,version,rows===null?null:JSON.stringify(rows)])).rows[0].result;}
it("shares reviewed labels between staff, protects newer edits and supports exact retries",async()=>{
 const original=[{sourceRow:2,pitchType:"Fastball"}];
 expect(await as(coach,()=>call())).toEqual({version:0,assignments:[]});
 expect(await as(coach,()=>call(0,original))).toEqual({version:1,assignments:original});
 expect(await as(admin,()=>call())).toEqual({version:1,assignments:original});
 expect(await as(coach,()=>call(0,original))).toEqual({version:1,assignments:original});
 await as(admin,async()=>{await expect(call(0,[{sourceRow:2,pitchType:"Slider"}])).rejects.toThrow("changed");});
 expect(await as(admin,()=>call(1,[]))).toEqual({version:2,assignments:[]});
});
it("rejects player, anonymous, inactive staff and direct table access",async()=>{
 await as(player,async()=>{await expect(call()).rejects.toThrow("Active administrator or coach required");await expect(call(2,[])).rejects.toThrow();});
 await as(null,async()=>{await expect(call()).rejects.toThrow("permission denied");});
 await db.query("update public.app_accounts set is_active=false where user_id=$1",[coach]);
 await as(coach,async()=>{await expect(call()).rejects.toThrow("Active administrator or coach required");});
 await as(admin,async()=>{await expect(db.exec("select * from private.full_swing_pitch_assignments")).rejects.toThrow("permission denied");});
});
it("rejects malformed rows atomically",async()=>{
 for(const rows of [[{sourceRow:2,pitchType:"Slider",raw:"no"}],[{sourceRow:2,pitchType:"Slider"},{sourceRow:2,pitchType:"Curveball"}],[{sourceRow:2.5,pitchType:"Fastball"}],[{sourceRow:2,pitchType:"Invented"}]])await as(admin,async()=>{await expect(call(2,rows)).rejects.toThrow();});
 expect(await as(admin,()=>call())).toEqual({version:2,assignments:[]});
});
