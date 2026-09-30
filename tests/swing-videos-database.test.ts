import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll,beforeEach,afterAll,expect,it } from "vitest";
const db=new PGlite();
const admin="11111111-1111-4111-8111-111111111111",coach="22222222-2222-4222-8222-222222222222",player="33333333-3333-4333-8333-333333333333",other="44444444-4444-4444-8444-444444444444";
const athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",second="aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbbb",id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",hash="a".repeat(64),path=`${athlete}/${id}.mp4`;
async function as<T>(user:string|null,fn:()=>Promise<T>){await db.exec(`set role ${user?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user??""]);try{return await fn();}finally{await db.exec("reset role");}}
async function reserve(changes:Record<string,unknown>={}){const v={id,athlete,hash,row:2,title:"Fictional side angle",mime:"video/mp4",bytes:100,...changes};return(await db.query<{data:{id:string;path:string;status:string}}>("select public.staff_reserve_swing_video($1,$2,$3,$4,$5,$6,$7) data",Object.values(v))).rows[0].data;}
async function finish(archive=false){return(await db.query<{data:{id:string;status:string}}>("select public.staff_finish_swing_video($1,$2,$3) data",[id,athlete,archive])).rows[0].data;}
async function list(target=athlete){return(await db.query<{data:unknown[]}>("select public.athlete_swing_videos($1) data",[target])).rows[0].data;}
async function upload(){await db.query("insert into storage.objects(bucket_id,name,metadata) values('swing-videos',$1,'{\"size\":100,\"mimetype\":\"video/mp4\"}')",[path]);}
beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text,metadata jsonb,unique(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated;");
 for(const name of ["202609040001_identity_and_access.sql","202609220002_full_swing_contacts.sql","202609300003_swing_videos.sql"])await db.exec(readFileSync(new URL(`../supabase/migrations/${name}`,import.meta.url),"utf8"));
 for(const [user,role] of [[admin,"admin"],[coach,"coach"],[player,"player"],[other,"player"]]){await db.query("insert into auth.users(id) values($1)",[user]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[user]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[user,role]);}
 await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'SYN-001','Fictional','Batter'),($2,'SYN-002','Fictional','Other')",[athlete,second]);
 await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2),($3,$4)",[player,athlete,other,second]);
});
beforeEach(async()=>{
 await db.exec("delete from public.swing_videos;delete from storage.objects;delete from public.full_swing_contacts;delete from public.audit_events;update public.app_accounts set is_active=true;");
 await db.query("insert into public.full_swing_contacts(file_hash,source_row,pitch_number,athlete_id,source_file,played_on,category,exit_velocity,launch_angle,imported_by) values($1,2,1,$2,'fictional.csv','2026-09-11','intrasquad',90,20,$3)",[hash,athlete,admin]);
});
afterAll(()=>db.close());
it("reserves only exact existing swings for active staff; private bucket and tables stay closed",async()=>{
 expect((await db.query<{public:boolean}>("select public from storage.buckets where id='swing-videos'")).rows[0].public).toBe(false);
 await as(player,async()=>{await expect(reserve()).rejects.toThrow("Active staff");await expect(db.exec("select * from public.swing_videos")).rejects.toThrow();await expect(upload()).rejects.toThrow();});
 await as(null,async()=>{await expect(reserve()).rejects.toThrow();await expect(list()).rejects.toThrow();});
 await as(coach,async()=>{await expect(reserve({athlete:second})).rejects.toThrow("Swing no longer");await expect(reserve({row:3})).rejects.toThrow();await expect(reserve({mime:"text/html"})).rejects.toThrow();await expect(reserve({bytes:52428801})).rejects.toThrow();expect(await reserve()).toMatchObject({id,path,status:"pending"});});
});
it("requires a matching stored object, isolates the uploader and never permits overwrite",async()=>{
 await as(coach,()=>reserve());
 await as(coach,async()=>{await expect(finish()).rejects.toThrow("not ready");});
 await as(admin,async()=>{await expect(upload()).rejects.toThrow();});
 await as(coach,upload);
 await as(coach,async()=>{await expect(upload()).rejects.toThrow();expect((await db.query("update storage.objects set metadata='{}' returning *")).rows).toHaveLength(0);expect((await db.query("delete from storage.objects returning *")).rows).toHaveLength(0);});
 await db.exec("update storage.objects set metadata='{\"size\":99,\"mimetype\":\"video/mp4\"}'");
 await as(coach,async()=>{await expect(finish()).rejects.toThrow("not ready");});
 await db.exec("update storage.objects set metadata='{\"size\":100,\"mimetype\":\"video/mp4\"}'");
 expect(await as(coach,()=>finish())).toEqual({id,status:"ready"});
});
it("publishes idempotently and permits only own player/staff reading",async()=>{
 await as(coach,()=>reserve());await as(coach,upload);await as(coach,()=>finish());
 expect(await as(coach,()=>finish())).toEqual({id,status:"ready"});expect(await as(coach,()=>reserve())).toMatchObject({status:"ready"});
 await as(coach,async()=>{await expect(reserve({title:"different"})).rejects.toThrow("Upload changed");});
 expect(await as(player,list)).toHaveLength(1);expect(JSON.stringify(await as(player,list))).not.toContain("objectPath");
 await as(player,async()=>{expect((await db.query("select name from storage.objects")).rows).toHaveLength(1);await expect(finish(true)).rejects.toThrow("Active staff");});
 await as(other,async()=>{await expect(list()).rejects.toThrow("access denied");expect(await list(second)).toEqual([]);expect((await db.query("select name from storage.objects")).rows).toEqual([]);});
 await db.query("update public.app_accounts set is_active=false where user_id=$1",[player]);
 await as(player,async()=>{await expect(list()).rejects.toThrow("access denied");expect((await db.query("select name from storage.objects")).rows).toEqual([]);});
});
it("hides removed or reassigned contacts immediately and detaches without deleting a file",async()=>{
 await as(coach,()=>reserve());await as(coach,upload);await as(coach,()=>finish());
 await db.query("update public.full_swing_contacts set athlete_id=$1",[second]);
 expect(await as(player,list)).toEqual([]);expect(await as(other,()=>list(second))).toEqual([]);
 await as(coach,async()=>{expect((await db.query("select name from storage.objects")).rows).toEqual([]);});
 await db.query("update public.full_swing_contacts set athlete_id=$1",[athlete]);
 expect(await as(admin,()=>finish(true))).toEqual({id,status:"archived"});expect(await as(player,list)).toEqual([]);
 expect((await db.query("select name from storage.objects")).rows).toHaveLength(1);
 await as(coach,async()=>{await expect(finish()).rejects.toThrow("no longer");});
});
it("audits detach once without any clip content, including an identical retry",async()=>{
 await as(coach,()=>reserve());await as(coach,upload);await as(coach,()=>finish());
 expect(await as(admin,()=>finish(true))).toEqual({id,status:"archived"});expect(await as(admin,()=>finish(true))).toEqual({id,status:"archived"});
 const events=(await db.query<{event_type:string;details:unknown}>("select event_type,details from public.audit_events order by created_at")).rows;
 expect(events.filter(event=>event.event_type==="swing_video_detached")).toEqual([{event_type:"swing_video_detached",details:{video_id:id}}]);
 expect(JSON.stringify(events)).not.toContain("Fictional side angle");expect(JSON.stringify(events)).not.toContain(path);
});
