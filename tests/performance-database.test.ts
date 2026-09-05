import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

const db = new PGlite();
const users = {
  admin: "11111111-1111-4111-8111-111111111111", coach: "22222222-2222-4222-8222-222222222222",
  playerA: "33333333-3333-4333-8333-333333333333", playerB: "44444444-4444-4444-8444-444444444444",
  disabled: "55555555-5555-4555-8555-555555555555", unlinked: "66666666-6666-4666-8666-666666666666",
};
const athlete = (i: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12,"0")}`;
const code = (i: number) => `SYN-P${String(i).padStart(2,"0")}`;
async function asUser<T>(id: string | null, run: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${id ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id ?? ""]);
  try { return await run(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
type Row = {observation_id:string;athlete_code:string;metric_key:string;measured_at:string;value:number;unit:string;source:string;source_file:string;source_sheet:string;source_row:number;file_hash:string};
function row(i=1, changes:Partial<Row>={}, column=0): Row {
  const file_hash=i.toString(16).padStart(64,"0"), source_sheet="Fictional tests",source_row=2;
  const r = {athlete_code:code(i),metric_key:"max_exit_velocity",measured_at:"2026-09-12",value:10*i,unit:"mph",source:"Fictional radar protocol",source_file:"fictional.csv",source_sheet,source_row,file_hash,...changes};
  return {observation_id:`observation:${JSON.stringify([r.file_hash,r.source_sheet,r.source_row,column])}`,...r};
}
async function importRows(rows:unknown) {
  return (await db.query<{receipt:{import_id:string;created:number;unchanged:number}}>("select public.admin_import_performance($1::jsonb) receipt",[JSON.stringify(rows)])).rows[0].receipt;
}
type Summary = {metricKey:string;measuredAt:string;observedValue:number;value:number|null;sampleSize:number;period:string;unit:string;source:string;direction:string};
async function summary(id=athlete(1)):Promise<Summary[]> {
  return (await db.query<{data:Summary[]}>("select public.athlete_performance_summary($1::uuid) data",[id])).rows[0].data;
}
async function counts() {
  return (await db.query<{n:number;imports:number;audit:number}>("select (select count(*)::integer from public.performance_measurements) n,(select count(*)::integer from public.performance_imports) imports,(select count(*)::integer from public.audit_events where event_type='performance_imported') audit")).rows[0];
}
beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
  const dir=new URL("../supabase/migrations/",import.meta.url);
  for(const file of readdirSync(dir).filter(f=>f.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(file,dir),"utf8"));
  for(const id of Object.values(users)) await db.query("insert into auth.users(id) values($1)",[id]);
  for(const [key,id] of Object.entries(users)) {
    await db.query("insert into public.app_accounts(user_id,is_active) values($1,$2)",[id,key!=="disabled"]);
    await db.query("insert into public.account_roles(user_id,role) values($1,$2)",[id,key==="admin"?"admin":key==="coach"?"coach":"player"]);
  }
  for(let i=1;i<=7;i++) {
    await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,$2,'Fictional',$3)",[athlete(i),code(i),`Player ${i}`]);
    await db.query("insert into public.athlete_seasons(athlete_id,season,roster_status) values($1,$2,$3)",[athlete(i),i===7?"2025-26":"2026-27",i===6?"inactive":null]);
  }
  await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2),($3,$4),($5,$6)",[users.playerA,athlete(1),users.playerB,athlete(2),users.disabled,athlete(3)]);
});
beforeEach(async () => {
  await db.exec("delete from public.performance_measurements;delete from public.performance_imports;delete from public.audit_events where event_type='performance_imported';");
  await db.query("update public.app_accounts set is_active=true where user_id<>$1",[users.disabled]);
});
afterAll(async()=>{await db.close();});

describe("shared performance authorization",()=>{
  it("denies anonymous reads, imports, percentile summaries and private catalog access",async()=>{
    await asUser(null,async()=>{
      await expect(db.query("select * from public.performance_measurements")).rejects.toThrow("permission denied");
      await expect(importRows([row()])).rejects.toThrow("permission denied");
      await expect(summary()).rejects.toThrow("permission denied");
      await expect(db.query("select * from private.performance_metric_catalog")).rejects.toThrow("permission denied");
    });
  });
  it("staff read all, independent players read only linked rows, unlinked/disabled read none",async()=>{
    await asUser(users.admin,()=>importRows([row(1),row(2)]));
    for(const [userId,expected] of [[users.admin,2],[users.coach,2],[users.playerA,1],[users.playerB,1],[users.unlinked,0],[users.disabled,0]] as const) {
      const result=await asUser(userId,()=>db.query<{athlete_id:string}>("select athlete_id from public.performance_measurements"));
      expect(result.rows).toHaveLength(expected);
      if(userId===users.playerA) expect(result.rows[0].athlete_id).toBe(athlete(1));
      if(userId===users.playerB) expect(result.rows[0].athlete_id).toBe(athlete(2));
    }
  });
  it("players, coaches and disabled administrators cannot import or mutate tables directly",async()=>{
    for(const id of [users.playerA,users.coach,users.disabled]) await asUser(id,async()=>{
      await expect(importRows([row()])).rejects.toThrow("Active administrator required");
      await expect(db.query("update public.performance_measurements set value=99")).rejects.toThrow("permission denied");
      await expect(db.query("delete from public.performance_measurements")).rejects.toThrow("permission denied");
    });
    await db.query("update public.app_accounts set is_active=false where user_id=$1",[users.admin]);
    await asUser(users.admin,async()=>{await expect(importRows([row()])).rejects.toThrow("Active administrator required");});
  });
  it("requires exact linked athlete for the definer summary and hides import history from players/coaches",async()=>{
    await asUser(users.admin,()=>importRows([row(1),row(2)]));
    for(const id of [users.playerA,users.coach]) expect((await asUser(id,()=>db.query("select * from public.performance_imports"))).rows).toHaveLength(0);
    await asUser(users.playerA,async()=>{expect(await summary()).toHaveLength(1);await expect(summary(athlete(2))).rejects.toThrow("Athlete access denied");});
    await asUser(users.unlinked,async()=>{await expect(summary()).rejects.toThrow("Athlete access denied");});
    await asUser(users.disabled,async()=>{await expect(summary(athlete(3))).rejects.toThrow("Athlete access denied");});
  });
  it("revokes current-subject reads and summary immediately after account disable",async()=>{
    await asUser(users.admin,()=>importRows([row()]));
    expect((await asUser(users.playerA,()=>summary())).length).toBe(1);
    await db.query("update public.app_accounts set is_active=false where user_id=$1",[users.playerA]);
    expect((await asUser(users.playerA,()=>db.query("select * from public.performance_measurements"))).rows).toEqual([]);
    await asUser(users.playerA,async()=>{await expect(summary()).rejects.toThrow("Athlete access denied");});
  });
});

describe("reviewed numerical import integrity",()=>{
  it("imports immutable reviewed observations and retries preserve original filename",async()=>{
    const input=row();
    const first=await asUser(users.admin,()=>importRows([input]));
    const retry=await asUser(users.admin,()=>importRows([{...input,source_file:"renamed-fictional.csv"}]));
    expect(first).toMatchObject({created:1,unchanged:0});expect(retry).toMatchObject({created:0,unchanged:1});
    const saved=(await db.query<{source_file:string;imported_by:string;metric:string}>("select source_file,imported_by,metric from public.performance_measurements")).rows[0];
    expect(saved).toEqual({source_file:"fictional.csv",imported_by:users.admin,metric:"Max Exit Velocity"});
    expect(await counts()).toEqual({n:1,imports:2,audit:2});
  });
  it("refuses source identity remaps, different values and changed metric/unit without overwriting",async()=>{
    const input=row();await asUser(users.admin,()=>importRows([input]));
    for(const changes of [{athlete_code:code(2)},{value:999},{metric_key:"bat_speed"},{unit:"km/h"},{measured_at:"2026-09-13"},{source:"Changed protocol"}])
      await asUser(users.admin,async()=>{await expect(importRows([{...input,...changes}])).rejects.toThrow("Source observation already exists");});
    expect((await db.query<{value:number}>("select value from public.performance_measurements")).rows[0].value).toBe(10);
    expect(await counts()).toEqual({n:1,imports:1,audit:1});
  });
  it("rolls back all rows, receipt and audit when a later observation is invalid",async()=>{
    const invalids:unknown[]=[{...row(2),value:-1},{...row(2),metric_key:"invented_metric"},{...row(2),unit:"bananas"},{...row(2),measured_at:"2026-02-30"},{...row(2),athlete_code:"UNKNOWN"},{...row(2),value:"25"},{...row(2),report_text:"Unrequested report content"},{...row(2),file_hash:"BAD"},{...row(2),observation_id:"unverified-id"},{...row(2),source_row:2.5}];
    for(const invalid of invalids) {
      await asUser(users.admin,async()=>{await expect(importRows([row(),invalid])).rejects.toThrow();});
      expect(await counts()).toEqual({n:0,imports:0,audit:0});
    }
  });
  it("rejects empty/oversize/duplicate inputs and ambiguous RENPHO report metric rows",async()=>{
    for(const input of [[],{},Array.from({length:501},(_,i)=>row(i+1)),[row(),row()]]) await asUser(users.admin,async()=>{await expect(importRows(input)).rejects.toThrow();});
    const a=row(1,{metric_key:"weight",unit:"lb",source:"RENPHO",source_sheet:"RENPHO report · Page 1"});
    const b=row(1,{metric_key:"weight",unit:"lb",source:"RENPHO",source_sheet:"RENPHO report · Page 1",source_row:3},1);
    await asUser(users.admin,async()=>{await expect(importRows([a,b])).rejects.toThrow("performance_report_metric_unique");});
    expect(await counts()).toEqual({n:0,imports:0,audit:0});
  });
  it("requires positive height/weight/timings and 0–100 percentages while preserving valid zero measurements",async()=>{
    for(const input of [row(1,{metric_key:"height",unit:"in",value:0}),row(1,{metric_key:"weight",unit:"lb",value:0}),row(1,{metric_key:"home_to_first",unit:"s",value:0}),row(1,{metric_key:"body_fat_pct",unit:"%",value:101})]) await asUser(users.admin,async()=>{await expect(importRows([input])).rejects.toThrow("Unsupported metric");});
    expect(await asUser(users.admin,()=>importRows([row(1,{value:0}),row(2,{metric_key:"body_fat_pct",unit:"%",value:0})]))).toMatchObject({created:2});
  });
});

describe("fixed cohort percentiles",()=>{
  it("counts measured eligible cohort athletes only, computes tied numeric ranks, excludes older/prior-season/inactive peers",async()=>{
    await asUser(users.admin,()=>importRows([10,20,20,30,40,999,999].map((value,i)=>row(i+1,{value}))));
    await asUser(users.admin,()=>importRows([row(2,{value:999,measured_at:"2026-09-01",file_hash:"f".repeat(64)})]));
    const result=await asUser(users.playerB,()=>summary(athlete(2)));
    expect(result).toEqual([{metricKey:"max_exit_velocity",measuredAt:"2026-09-12",observedValue:20,value:37.5,sampleSize:5,period:"fall_2026",unit:"mph",source:"Fictional radar protocol",direction:"higher"}]);
    expect(JSON.stringify(result)).not.toContain(athlete(1));
  });
  it("inverts lower-is-better timings and keeps neutral weight numeric rather than judging health",async()=>{
    await asUser(users.admin,()=>importRows([10,20,20,30,40].flatMap((value,i)=>[row(i+1,{metric_key:"home_to_first",unit:"s",value},0),row(i+1,{metric_key:"weight",unit:"lb",value},1)])));
    const result=await asUser(users.playerB,()=>summary(athlete(2)));
    expect(result.find(m=>m.metricKey==="home_to_first")).toMatchObject({value:62.5,direction:"lower",sampleSize:5});
    expect(result.find(m=>m.metricKey==="weight")).toMatchObject({value:37.5,direction:"neutral",sampleSize:5});
  });
  it("suppresses ranks below five and never mixes units, protocols or baseball summer dates",async()=>{
    await asUser(users.admin,()=>importRows([row(1),row(2),row(3,{unit:"km/h"}),row(4,{source:"Different protocol"}),row(5,{measured_at:"2026-08-20"})]));
    expect(await asUser(users.playerA,()=>summary())).toEqual([expect.objectContaining({sampleSize:2,value:null})]);
    expect(await asUser(users.admin,()=>summary(athlete(5)))).toEqual([]);
  });
  it("separates Fall body metrics and summer baseline and normalizes protocol whitespace/case",async()=>{
    await asUser(users.admin,()=>importRows(Array.from({length:5},(_,i)=>row(i+1,{metric_key:"weight",unit:"lb",source:i?"fictional   SCALE":"Fictional scale",measured_at:"2026-08-20"}))));
    await asUser(users.admin,()=>importRows([row(1,{metric_key:"weight",unit:"lb",source:"Fictional scale",file_hash:"f".repeat(64)})]));
    const result=await asUser(users.playerA,()=>summary());
    expect(result.find(m=>m.period==="summer_2026")).toMatchObject({sampleSize:5,value:0});
    expect(result.find(m=>m.period==="fall_2026")).toMatchObject({sampleSize:1,value:null});
  });
  it("derives muscle percentage only from same-report equal-unit RENPHO pairs without storing synthetic readings",async()=>{
    const rows=Array.from({length:5},(_,i)=>{
      const shared={source:"RENPHO",source_sheet:"RENPHO report · Page 1",unit:"lb",measured_at:"2026-08-20"};
      return [row(i+1,{...shared,metric_key:"weight",value:100},0),row(i+1,{...shared,metric_key:"muscle_mass",value:40+10*i},1)];
    }).flat();
    await asUser(users.admin,()=>importRows(rows));
    expect((await asUser(users.playerA,()=>summary())).find(m=>m.metricKey==="muscle_mass_pct")).toMatchObject({observedValue:40,value:0,sampleSize:5,period:"summer_2026"});
    expect((await db.query("select id from public.performance_measurements where metric_key='muscle_mass_pct'")).rows).toHaveLength(0);
  });
  it("omits derived muscle percentage when a report has extra mass-unit candidates",async()=>{
    const shared={source:"RENPHO",source_sheet:"RENPHO report · Page 1",measured_at:"2026-08-20"};
    await asUser(users.admin,()=>importRows([row(1,{...shared,metric_key:"weight",unit:"lb",value:100},0),row(1,{...shared,metric_key:"muscle_mass",unit:"lb",value:50},1),row(1,{...shared,metric_key:"weight",unit:"kg",value:45},2)]));
    expect((await asUser(users.playerA,()=>summary())).some(m=>m.metricKey==="muscle_mass_pct")).toBe(false);
  });
  it("matches browser millisecond timestamp ties before stable hash ordering",async()=>{
    await asUser(users.admin,()=>importRows([row(1,{value:10,file_hash:"a".repeat(64)}),row(1,{value:20,file_hash:"b".repeat(64)})]));
    await db.query("update public.performance_measurements set imported_at=case when value=10 then '2026-09-06T12:00:00.123100Z'::timestamptz else '2026-09-06T12:00:00.123900Z'::timestamptz end");
    expect(await asUser(users.playerA,()=>summary())).toEqual([expect.objectContaining({observedValue:10})]);
  });
  it("does not let another protocol suppress same-report RENPHO muscle derivation",async()=>{
    const shared={source:"RENPHO",source_sheet:"RENPHO report · Page 1",measured_at:"2026-08-20"};
    await asUser(users.admin,()=>importRows([row(1,{...shared,metric_key:"weight",unit:"lb",value:100},0),row(1,{...shared,metric_key:"muscle_mass",unit:"lb",value:50},1),row(1,{metric_key:"muscle_mass_pct",unit:"%",value:60,measured_at:"2026-08-20",source:"Other protocol"},2)]));
    const result=await asUser(users.playerA,()=>summary());
    expect(result.find(m=>m.metricKey==="muscle_mass_pct" && m.source==="RENPHO")).toMatchObject({observedValue:50});
    expect(result.find(m=>m.metricKey==="muscle_mass_pct" && m.source==="Other protocol")).toMatchObject({observedValue:60});
  });
});
