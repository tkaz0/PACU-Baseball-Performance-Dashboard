import {PGlite} from "@electric-sql/pglite";
import {readFileSync,readdirSync} from "node:fs";
import {beforeAll,beforeEach,afterAll,expect,it} from "vitest";
import {initializeStorageSchema} from "./fixtures/storage-schema";
const db=new PGlite();
const staff="11111111-1111-4111-8111-111111111111",player="22222222-2222-4222-8222-222222222222",a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",b="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",receipt="33333333-3333-4333-8333-333333333333";
async function asUser<T>(id:string,run:()=>Promise<T>){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);try{return await run();}finally{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");}}
async function session(hash:string,values:{ev:number;direction:number|null}[],kind='intrasquad',athlete=a,counts=true){
 const source=`Full Swing · ${kind==='practice'?'Practice':'Intrasquad'}`;
 for(const [key,label,value,column] of [['avg_exit_velocity','Average EV',values.reduce((sum,r)=>sum+r.ev,0)/values.length,3],['max_exit_velocity','Max EV',Math.max(...values.map(r=>r.ev)),2],['avg_bat_speed','Average Bat Speed',60,5]] as const){
  await db.query(`insert into public.performance_measurements(observation_id,athlete_id,metric_key,metric,unit,value,measured_at,source,source_file,source_sheet,source_row,source_column,file_hash,import_id,imported_by) values($1,$2,$3,$4,'mph',$5,'2026-09-11',$6,'fictional.csv','CSV · Full Swing session summaries v1',2,$7,$8,$9,$10)`,[`fictional-${hash}-${key}`,athlete,key,label,value,source,column,hash,receipt,staff]);
  if(counts)await db.query('insert into private.full_swing_session_samples(file_hash,athlete_id,metric_key,unit,source_row,sample_count) values($1,$2,$3,\'mph\',2,$4)',[hash,athlete,key,values.length]);
 }
 for(const [index,row] of values.entries())await db.query(`insert into public.full_swing_contacts(file_hash,source_row,pitch_number,athlete_id,source_file,played_on,category,exit_velocity,launch_angle,direction,distance,imported_by) values($1,$2,$2,$3,'fictional.csv','2026-09-11',$4,$5,20,$6,$7,$8)`,[hash,index+2,athlete,kind,row.ev,row.direction,row.direction===null?null:150,staff]);
}
async function board(metric='avg_exit_velocity',source='full swing · intrasquad'){return (await asUser(player,()=>db.query<{result:{value:number;sampleCount:number}[]}>('select public.team_leaderboard($1,$2,\'mph\',\'fall_2026\') result',[metric,source]))).rows[0].result;}
beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 await initializeStorageSchema(db);const directory=new URL('../supabase/migrations/',import.meta.url);for(const file of readdirSync(directory).filter(n=>n.endsWith('.sql')).sort())await db.exec(readFileSync(new URL(file,directory),'utf8'));
 for(const [id,role] of [[staff,'admin'],[player,'player']]){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into public.app_accounts(user_id,is_active) values($1,true)',[id]);await db.query('insert into public.account_roles(user_id,role) values($1,$2)',[id,role]);}
 await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'PAC-0001','Fictional','Hitter'),($2,'PAC-0002','Fictional','Peer')",[a,b]);await db.query("insert into public.athlete_seasons(athlete_id,season) values($1,'2026-27'),($2,'2026-27')",[a,b]);await db.query('insert into public.account_athletes(user_id,athlete_id) values($1,$2)',[player,a]);
},30000);
beforeEach(async()=>{await db.exec('delete from public.full_swing_contacts;delete from private.full_swing_session_samples;delete from public.performance_measurements;delete from public.performance_imports;update public.app_accounts set is_active=true;');await db.query("insert into public.performance_imports(id,created_by,created_count) values($1,$2,3)",[receipt,staff]);});
afterAll(()=>db.close());
it('preserves non-EV floating-point values exactly with reduced JSON precision',async()=>{
 await session('a'.repeat(64),[{ev:60,direction:46},{ev:100,direction:0}]);
 await db.exec("update public.performance_measurements set value=60.123456789012345 where metric_key='avg_bat_speed'; set extra_float_digits=-3;");
 try {expect((await db.query<{exact:boolean}>('select bool_and(d.value=m.value) exact from private.performance_display_measurements d join public.performance_measurements m using(id) where m.metric_key=\'avg_bat_speed\'')).rows[0].exact).toBe(true);}
 finally {await db.exec('reset extra_float_digits');}
});
it('adjusts EV, weights Fall by retained contacts and keeps practice/bat speed/originals separate',async()=>{
 await session('a'.repeat(64),[{ev:60,direction:46},{ev:80,direction:0},{ev:100,direction:-20}]);await session('b'.repeat(64),[{ev:120,direction:0}]);await session('c'.repeat(64),[{ev:90,direction:0}],'practice');
 expect((await board())[0]).toMatchObject({value:100,sampleCount:3});expect((await board('max_exit_velocity'))[0]).toMatchObject({value:120,sampleCount:3});expect((await board('avg_exit_velocity','full swing · practice'))[0]).toMatchObject({value:90,sampleCount:1});expect((await board('avg_bat_speed'))[0]).toMatchObject({value:60,sampleCount:4});
 const original=(await db.query<{value:number}>('select value from public.performance_measurements where metric_key=\'avg_exit_velocity\' and file_hash=$1',['a'.repeat(64)])).rows[0].value;expect(original).toBe(80);
 const blocks=(await asUser(player,()=>db.query<{data:{observationId:string;count:number;value:number}[]}>('select public.athlete_training_block_samples($1) data',[a]))).rows[0].data;
 expect(blocks.find(r=>r.observationId===`fictional-${'a'.repeat(64)}-avg_exit_velocity`)).toMatchObject({count:2,value:90});
 expect((await db.query<{sample_count:number}>('select sample_count from private.full_swing_session_samples where metric_key=\'avg_exit_velocity\' and file_hash=$1',['a'.repeat(64)])).rows[0].sample_count).toBe(3);
 const history=(await asUser(player,()=>db.query<{data:{metric_key:string;value:number}[]}>('select public.athlete_performance_measurements($1) data',[a]))).rows[0].data;expect(history.find(r=>r.metric_key==='avg_exit_velocity')?.value).toBe(90);
 const comparisons=(await asUser(player,()=>db.query<{data:{metricKey:string;observedValue:number}[]}>('select public.athlete_performance_summary($1) data',[a]))).rows[0].data;expect(comparisons.some(r=>r.metricKey==='avg_exit_velocity'&&r.observedValue===120)).toBe(true);
});
it('keeps soft balls inside the lines, boundary readings and unknown direction',async()=>{await session('a'.repeat(64),[{ev:40,direction:0},{ev:60,direction:45},{ev:70,direction:60},{ev:50,direction:null}]);expect((await board())[0]).toMatchObject({value:55,sampleCount:4});});
it('withholds all-foul EV or missing-count EV instead of inventing a denominator',async()=>{await session('a'.repeat(64),[{ev:60,direction:-46}]);expect(await board()).toEqual([]);expect(await board('max_exit_velocity')).toEqual([]);await session('b'.repeat(64),[{ev:60,direction:46},{ev:100,direction:0}],'intrasquad',a,false);expect(await board()).toEqual([]);expect(await board('avg_bat_speed')).toHaveLength(1);});
it('enforces invoker RLS, keeps peer raw data private and retains signed-in aggregate boards',async()=>{await session('a'.repeat(64),[{ev:60,direction:46},{ev:100,direction:0}]);await session('b'.repeat(64),[{ev:90,direction:0}],'intrasquad',b);await asUser(player,async()=>{expect((await db.query('select distinct athlete_id from public.performance_display_measurements')).rows).toEqual([{athlete_id:a}]);await expect(db.query('select * from private.full_swing_session_samples')).rejects.toThrow('permission denied');await expect(db.query('update public.performance_display_measurements set value=1')).rejects.toThrow();await expect(db.query('select public.athlete_performance_measurements($1)',[b])).rejects.toThrow('Athlete access denied');});expect(await board()).toHaveLength(2);await db.query('update public.app_accounts set is_active=false where user_id=$1',[player]);await asUser(player,async()=>expect((await db.query('select * from public.performance_display_measurements')).rows).toEqual([]));});
