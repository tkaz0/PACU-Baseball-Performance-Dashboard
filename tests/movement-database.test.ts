import {PGlite} from "@electric-sql/pglite";
import {afterAll,beforeAll,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const db=new PGlite(),admin="11111111-1111-4111-8111-111111111111",coach="22222222-2222-4222-8222-222222222222",player="33333333-3333-4333-8333-333333333333",athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",peer="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const payload=()=>({version:1,source:"1Uu-bmZT-ol7ccW96H_1DAFOEI7LdGYTFgJfFUvJdDsU",reports:[{athleteCode:"PAC-0001",sheetId:42,screenedOn:"2026-09-15",sourceHash:"a".repeat(64),readings:Array.from({length:24},(_,i)=>({row:i+2,sourceRow:i+2,value:i>=2&&i<=17?"45":"3",reference:null,color:"none"}))}]});
beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 for(const file of ["202609040001_identity_and_access.sql","202609210001_movement_screenings.sql"])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
 for(const [id,role]of [[admin,"admin"],[coach,"coach"],[player,"player"]]){await db.query("insert into auth.users values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);}
 await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'PAC-0001','Fictional','One'),($2,'PAC-0002','Fictional','Two')",[athlete,peer]);await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)",[player,athlete]);
});afterAll(()=>db.close());
async function as<T>(id:string|null,fn:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await fn();}finally{await db.exec("reset role");}}
async function save(p:unknown){return (await db.query<{result:{created:number;unchanged:number;ids:string[]}}>("select public.staff_import_movement_screenings($1::jsonb) result",[JSON.stringify(p)])).rows[0].result;}
it("lets coaches import, staff retry idempotently, and rejects remapping or changed readings",async()=>{
 expect(await as(coach,()=>save(payload()))).toMatchObject({created:1,unchanged:0});expect(await as(admin,()=>save(payload()))).toMatchObject({created:0,unchanged:1});
 const p=payload();p.reports[0].athleteCode="PAC-0002";await as(admin,async()=>{await expect(save(p)).rejects.toThrow("changed");});p.reports[0].athleteCode="PAC-0001";p.reports[0].readings[0].value="4";await as(coach,async()=>{await expect(save(p)).rejects.toThrow("changed");});
});
it("enforces own-player reads and blocks player, anonymous, inactive and direct writes",async()=>{
 const p=payload();p.reports[0].sheetId=43;p.reports[0].athleteCode="PAC-0002";await as(admin,()=>save(p));
 await as(player,async()=>{expect((await db.query("select * from public.movement_screenings")).rows).toHaveLength(1);await expect(save(payload())).rejects.toThrow("Active staff");await expect(db.exec("delete from public.movement_screenings")).rejects.toThrow("permission denied");});
 await as(null,async()=>{await expect(db.exec("select * from public.movement_screenings")).rejects.toThrow("permission denied");await expect(save(payload())).rejects.toThrow("permission denied");});
 await db.query("update public.app_accounts set is_active=false where user_id=$1",[coach]);await as(coach,async()=>{expect((await db.query("select * from public.movement_screenings")).rows).toHaveLength(0);await expect(save(payload())).rejects.toThrow("Active staff");});
});
it("validates all fields and rolls back mixed invalid batches",async()=>{
 for(const mutate of [(p:ReturnType<typeof payload>)=>{p.reports[0].readings[0].value="6";},(p:ReturnType<typeof payload>)=>{p.reports[0].readings[2].value="361";},(p:ReturnType<typeof payload>)=>{p.reports[0].screenedOn="2026-09-31";},(p:ReturnType<typeof payload>)=>{p.reports[0].readings[0].row=3;}]){const p=payload();p.reports[0].sheetId=99;mutate(p);await as(admin,async()=>{await expect(save(p)).rejects.toThrow();});}
 const p=payload();p.reports[0].sheetId=100;p.reports.push({...p.reports[0],sheetId:101,athleteCode:"PAC-9999"});await as(admin,async()=>{await expect(save(p)).rejects.toThrow("Unknown athlete");});expect((await db.query("select * from public.movement_screenings where source_sheet_id>=99")).rows).toHaveLength(0);
});
