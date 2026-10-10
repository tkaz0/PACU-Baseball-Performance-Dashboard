import { initializeStorageSchema } from "./fixtures/storage-schema";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
// Fictional identities and readings only.
const db = new PGlite();
const admin="11111111-1111-4111-8111-111111111111",player="33333333-3333-4333-8333-333333333333";
const batter="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",peer="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const hash="a".repeat(64),other="b".repeat(64);
async function as<T>(id:string|null,run:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await run();}finally{await db.exec("reset role");}}
const details=(athlete:string)=>db.query<{file_hash:string;source_row:number;pitch_type:string|null;pitcher_throws:string|null;squared_up:number|null;potential_exit_velocity:number|null}>("select * from public.athlete_contact_details($1)",[athlete]).then(r=>r.rows);
beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 await initializeStorageSchema(db);
 const dir=new URL("../supabase/migrations/",import.meta.url);
 for(const file of readdirSync(dir).filter(n=>n.endsWith(".sql")).sort())await db.exec(readFileSync(new URL(file,dir),"utf8"));
 for(const [id,role]of[[admin,"admin"],[player,"player"]]){await db.query("insert into auth.users values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);}
 for(const [id,code]of[[batter,"PAC-0001"],[peer,"PAC-0002"]])await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,$2,'Fictional','Player')",[id,code]);
 await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)",[player,batter]);
 await as(admin,async()=>{
  const contact=(code:string,h:string,row:number)=>({athleteCode:code,fileHash:h,sourceFile:"fictional.csv",sourceRow:row,pitchNumber:row-1,playedOn:"2026-09-11",category:"intrasquad",exitVelocity:90,launchAngle:20});
  await db.query("select public.staff_import_full_swing_contacts($1::jsonb)",[JSON.stringify([contact("PAC-0001",hash,2),contact("PAC-0001",hash,3),contact("PAC-0001",other,2),contact("PAC-0002",hash,4)])]);
  await db.query("select public.staff_full_swing_pitch_labels($1,0,$2::jsonb)",[hash,JSON.stringify([{sourceRow:2,pitchType:"Slider"},{sourceRow:4,pitchType:"Curveball"}])]);
  await db.query("select public.save_full_swing_contact_quality($1,$2::jsonb)",[hash,JSON.stringify([{sourceRow:2,exitVelocity:90,squaredUp:.9,potentialExitVelocity:100}])]);
 });
 await db.query("insert into private.full_swing_contact_pitchers(file_hash,source_row,pitcher_athlete_id,linked_by) values($1,4,$2,$3)",[hash,batter,admin]);
});
afterAll(()=>db.close());
it("joins staff labels and quality only at the exact readable file/row, preserving unknown coverage",async()=>{
 const rows=await as(player,()=>details(batter));expect(rows).toHaveLength(3);
 expect(rows.find(r=>r.file_hash===hash&&r.source_row===2)).toMatchObject({pitch_type:"Slider",squared_up:.9,potential_exit_velocity:100});
 expect(rows.find(r=>r.file_hash===other)).toMatchObject({pitch_type:null,squared_up:null});
 expect(rows.find(r=>r.source_row===3)).toMatchObject({pitch_type:null});
 expect(rows.every(r=>Object.keys(r).sort().join(",")==="file_hash,pitch_type,pitcher_throws,potential_exit_velocity,source_row,squared_up")).toBe(true);
});
it("lets the pitcher see contact against each exact classified pitch without batter/file identifiers",async()=>{
 const result=await as(player,()=>db.query<{pitch_type:string|null}>("select * from public.athlete_contacts_allowed_by_pitch($1)",[batter]));
 expect(result.rows).toHaveLength(1);expect(result.rows[0].pitch_type).toBe("Curveball");
 expect(Object.keys(result.rows[0]).some(key=>/athlete|file|row/.test(key))).toBe(false);
 await as(player,async()=>{await expect(db.query("select * from public.athlete_contacts_allowed_by_pitch($1)",[peer])).rejects.toThrow("access denied");});
});
it("reads the latest reviewed labels without rewriting contact rows",async()=>{
 await as(admin,()=>db.query("select public.staff_full_swing_pitch_labels($1,1,$2::jsonb)",[hash,JSON.stringify([{sourceRow:2,pitchType:"Changeup"}])]));
 expect((await as(player,()=>details(batter))).find(r=>r.file_hash===hash&&r.source_row===2)?.pitch_type).toBe("Changeup");
});
it("denies peer, inactive and anonymous access and direct private-table reads",async()=>{
 await as(player,async()=>{await expect(details(peer)).rejects.toThrow("access denied");await expect(db.query("select * from private.full_swing_pitch_assignments")).rejects.toThrow();});
 await as(null,async()=>{await expect(details(batter)).rejects.toThrow();});
 await db.query("update public.app_accounts set is_active=false where user_id=$1",[player]);
 await as(player,async()=>{await expect(details(batter)).rejects.toThrow("access denied");});
});
