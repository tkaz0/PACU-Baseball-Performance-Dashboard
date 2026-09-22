import {PGlite} from "@electric-sql/pglite";
import {beforeAll,afterAll,expect,it} from "vitest";
import {readFileSync} from "node:fs";
const db=new PGlite();
const admin="11111111-1111-4111-8111-111111111111",coach="22222222-2222-4222-8222-222222222222",player="33333333-3333-4333-8333-333333333333",outside="44444444-4444-4444-8444-444444444444";
beforeAll(async()=>{
 await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
 create table auth.users(id uuid primary key,email text,invited_at timestamptz,email_confirmed_at timestamptz,last_sign_in_at timestamptz,encrypted_password text,confirmation_token text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 for(const name of ["202609040001_identity_and_access.sql","202609060002_coach_rollout.sql","202609220001_account_setup_status.sql"])await db.exec(readFileSync(new URL(`../supabase/migrations/${name}`,import.meta.url),"utf8"));
 for(const [id,role,email] of [[admin,"admin","fictional.admin@example.com"],[coach,"coach","fictional.coach@example.com"],[player,"player","fictional.player@example.com"],[outside,null,"fictional.outside@example.com"]]){
  await db.query("insert into auth.users(id,email,invited_at,encrypted_password,confirmation_token) values($1,$2,'2026-09-21T18:00:00Z','','fictional-private-token')",[id,email]);
  if(role){await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);}
 }
 await db.query("insert into public.coach_invitation_candidates(display_name,email,created_by) values('Fictional Coach','fictional.coach@example.com',$1)",[admin]);
 await db.query("update auth.users set email_confirmed_at='2026-09-22T01:00:00Z',encrypted_password='fictional-hash-never-return' where id=$1",[admin]);
 await db.query("update auth.users set email_confirmed_at='2026-09-22T01:00:00Z',last_sign_in_at='2026-09-22T01:00:00Z',encrypted_password=null where id=$1",[coach]);
 await db.query("update public.app_accounts set is_active=false where user_id=$1",[coach]);
});
afterAll(()=>db.close());
async function as<T>(id:string|null,fn:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await fn();}finally{await db.exec("reset role");}}
const read=()=>db.query<{result:Record<string,unknown>[]}>("select public.admin_account_setup_status() result");
it("shows password presence independently of acceptance and sign-in, for configured accounts only",async()=>{
 const rows=(await as(admin,read)).rows[0].result;expect(rows).toHaveLength(3);expect(rows.find(r=>r.userId===outside)).toBeUndefined();
 expect(rows.find(r=>r.userId===admin)?.passwordSet).toBe(true);
 expect(rows.find(r=>r.userId===coach)).toMatchObject({name:"Fictional Coach",active:false,passwordSet:false,lastSignInAt:expect.any(String),acceptedAt:expect.any(String)});
 expect(rows.find(r=>r.userId===player)).toMatchObject({passwordSet:false,acceptedAt:null,lastSignInAt:null});
 expect(JSON.stringify(rows)).not.toMatch(/fictional-hash|fictional-private-token|encrypted_password|confirmation_token/);
 expect(Object.keys(rows[0]).sort()).toEqual(["userId","active","roles","athleteId","code","name","email","invitedAt","acceptedAt","lastSignInAt","passwordSet"].sort());
});
it("does not grant direct Auth-table access, writes, or public function execution",async()=>{
 await as(admin,async()=>{await expect(db.exec("select encrypted_password from auth.users")).rejects.toThrow();});
 for(const id of [coach,player,outside,null])await as(id,async()=>{await expect(read()).rejects.toThrow();});
 expect((await db.query<{n:number}>("select count(*)::int n from public.audit_events")).rows[0].n).toBe(0);
});
it("rechecks administrator revocation rather than relying on a cached role",async()=>{
 await db.query("update public.app_accounts set is_active=false where user_id=$1",[admin]);await as(admin,async()=>{await expect(read()).rejects.toThrow("Active administrator required");});
});
