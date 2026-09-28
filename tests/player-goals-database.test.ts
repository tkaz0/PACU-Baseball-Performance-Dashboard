import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll,beforeEach,afterAll,expect,it } from "vitest";
import type { PlayerGoalData } from "@/lib/player-goals";
const db=new PGlite();
const admin="11111111-1111-4111-8111-111111111111",coach="22222222-2222-4222-8222-222222222222",player="33333333-3333-4333-8333-333333333333",other="44444444-4444-4444-8444-444444444444";
const athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",second="aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbbb",goal=(n=1)=>`bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12,"0")}`;
async function as<T>(id:string|null,run:()=>Promise<T>){await db.exec(`set role ${id?"authenticated":"anon"}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);try{return await run();}finally{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',false)");}}
async function read(id=athlete){return (await db.query<{data:PlayerGoalData}>("select public.athlete_numeric_goals($1) data",[id])).rows[0].data;}
const defaults={p_athlete_id:athlete,p_goal_id:goal(),p_expected_revision:0,p_baseline_observation_id:"fictional-baseline",p_baseline_value:80,p_title:"Fictional bat speed target",p_target_value:90,p_target_date:"2026-10-15",p_staff_note:"Fictional private coach note",p_shared:false,p_completed:false};
async function save(changes:Partial<typeof defaults>|Record<string,unknown>={}){const p={...defaults,...changes};return (await db.query<{data:{id:string;revision:number}}>("select public.staff_save_numeric_goal($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) data",Object.values(p))).rows[0].data;}
async function reading(id:string,value:number,date="2026-09-12",changes:{source?:string;unit?:string;athlete?:string;metric?:string}={}){
 await db.query("insert into public.performance_measurements(observation_id,athlete_id,metric_key,metric,unit,measured_at,value,source,source_file,source_sheet,source_row,source_column,file_hash,import_id,imported_by) values($1,$2,$3,'Max Exit Velocity',$4,$5,$6,$7,'fictional.csv',$1,2,0,repeat('a',64),(select id from public.performance_imports limit 1),$8)",[id,changes.athlete??athlete,changes.metric??"max_exit_velocity",changes.unit??"mph",date,value,changes.source??"Full Swing · Intrasquad",admin]);
}
beforeAll(async()=>{
 await db.exec("create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
 for(const file of ["202609040001_identity_and_access.sql","202609060001_performance_profiles.sql","202609280001_player_goals.sql"])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
 for(const [id,role] of [[admin,"admin"],[coach,"coach"],[player,"player"],[other,"player"]]){await db.query("insert into auth.users(id) values($1)",[id]);await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[id]);await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,role]);}
 await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'SYN-001','Fictional','Athlete'),($2,'SYN-002','Fictional','Other')",[athlete,second]);
 await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2),($3,$4)",[player,athlete,other,second]);
 await db.query("insert into public.performance_imports(created_by) values($1)",[admin]);
});
beforeEach(async()=>{await db.exec("delete from public.player_numeric_goals;delete from public.performance_measurements;update public.app_accounts set is_active=true;");await reading("fictional-baseline",80,"2026-09-11");});
afterAll(()=>db.close());
it("keeps source baselines staff-only and exposes only shared own goals without notes",async()=>{
 expect((await as(player,read)).choices).toEqual([]);expect((await as(coach,read)).choices).toHaveLength(1);
 await as(coach,()=>save());expect((await as(player,read)).goals).toEqual([]);
 expect((await as(admin,read)).goals[0]).toMatchObject({staffNote:defaults.p_staff_note,baselineValue:80,source:"Full Swing · Intrasquad",metricKey:"max_exit_velocity",revision:1});
 await as(admin,()=>save({p_expected_revision:1,p_baseline_observation_id:null,p_baseline_value:null,p_shared:true}));
 const visible=(await as(player,read)).goals[0];expect(visible).toMatchObject({shared:true,staffNote:null,currentValue:80,currentDate:"2026-09-11"});expect(JSON.stringify(visible)).not.toContain("observation");
 await as(other,async()=>{await expect(read()).rejects.toThrow("access denied");});
 await as(null,async()=>{await expect(read()).rejects.toThrow();});
 await as(player,async()=>{await expect(save({p_goal_id:goal(2)})).rejects.toThrow("Active staff");await expect(db.exec("select * from public.player_numeric_goals")).rejects.toThrow();await expect(db.exec("update public.player_numeric_goals set shared_with_player=true")).rejects.toThrow();});
});
it("uses only newer matching source, canonical metric, unit and Fall readings",async()=>{
 await as(admin,()=>save({p_shared:true}));
 await reading("fictional-new",85);await reading("fictional-game",199,"2026-09-13",{source:"Full Swing · Game"});
 await reading("fictional-practice",198,"2026-09-13",{source:"Full Swing · Practice"});await reading("fictional-kph",197,"2026-09-13",{unit:"km/h"});
 await reading("fictional-other",196,"2026-09-13",{athlete:second});await reading("fictional-outside-fall",195,"2027-01-01");await reading("fictional-metric",194,"2026-09-13",{metric:"avg_exit_velocity"});
 expect((await as(player,read)).goals[0]).toMatchObject({currentValue:85,currentDate:"2026-09-12",baselineValue:80});
 await reading("fictional-latest",83,"2026-09-14");expect((await as(player,read)).goals[0]).toMatchObject({currentValue:83,currentDate:"2026-09-14"});
});
it("rejects stale revisions, foreign baselines and baseline changes without altering goal identity",async()=>{
 await as(admin,()=>save());
 await as(coach,async()=>{await expect(save({p_target_value:92})).rejects.toThrow("Goal changed");await expect(save({p_expected_revision:1,p_baseline_observation_id:"changed"})).rejects.toThrow("baseline cannot change");await expect(save({p_athlete_id:second,p_expected_revision:1,p_baseline_observation_id:null,p_baseline_value:null})).rejects.toThrow("Goal changed");});
 await reading("fictional-other-baseline",80,"2026-09-11",{athlete:second});
 await as(coach,async()=>{await expect(save({p_goal_id:goal(2),p_baseline_observation_id:"fictional-other-baseline"})).rejects.toThrow("Baseline changed");await expect(save({p_goal_id:goal(2),p_baseline_value:79})).rejects.toThrow("Baseline changed");});
 expect((await as(admin,read)).goals[0]).toMatchObject({revision:1,targetValue:90});
});
it("withholds progress after a corrected, removed or reassigned baseline",async()=>{
 await as(admin,()=>save({p_shared:true}));await reading("fictional-new",85);
 await db.exec("update public.performance_measurements set value=81 where observation_id='fictional-baseline'");
 expect((await as(player,read)).goals[0]).toMatchObject({baselineValid:false,currentValue:null,currentDate:null,baselineValue:80});
 await db.exec("delete from public.performance_measurements where observation_id='fictional-baseline'");
 expect((await as(player,read)).goals[0]).toMatchObject({baselineValid:false,currentValue:null});
});
it("freezes coach-completed readings, allows reviewed reopening and keeps completion explicitly shared",async()=>{
 await as(admin,()=>save({p_shared:true}));await reading("fictional-new",91);
 const updated=await as(coach,()=>save({p_expected_revision:1,p_baseline_observation_id:null,p_baseline_value:null,p_shared:true,p_completed:true}));expect(updated.revision).toBe(2);
 await reading("fictional-after-completion",95,"2026-09-13");
 expect((await as(player,read)).goals[0]).toMatchObject({currentValue:91,currentDate:"2026-09-12"});expect((await as(player,read)).goals[0].completedAt).not.toBeNull();
 await as(coach,()=>save({p_expected_revision:2,p_baseline_observation_id:null,p_baseline_value:null,p_shared:true,p_completed:false}));
 expect((await as(player,read)).goals[0]).toMatchObject({currentValue:95,completedAt:null});
});
it("requires distinct valid explicit targets, denies unsupported baselines, and limits active goals",async()=>{
 await as(admin,async()=>{for(const target of [80,-1,Infinity,NaN])await expect(save({p_target_value:target})).rejects.toThrow();});
 await reading("fictional-blast",80,"2026-09-11",{source:"Blast · Average · 2026-09-01–2026-09-07"});
 await as(admin,async()=>{await expect(save({p_baseline_observation_id:"fictional-blast"})).rejects.toThrow("Baseline changed");});
 expect((await as(coach,read)).choices.every(choice=>!choice.source.startsWith("Blast"))).toBe(true);
 for(let n=1;n<=4;n++)await as(admin,()=>save({p_goal_id:goal(n)}));
 await as(coach,async()=>{await expect(save({p_goal_id:goal(5)})).rejects.toThrow("Complete a goal");});
 await db.query("update public.app_accounts set is_active=false where user_id=$1",[coach]);
 await as(coach,async()=>{await expect(read()).rejects.toThrow("access denied");await expect(save({p_goal_id:goal(5)})).rejects.toThrow("Active staff");});
});
