import { beforeEach, expect, it, vi } from "vitest";
vi.mock('server-only',()=>({}));
import { loadPhysicalityComposite } from "@/lib/physicality-composite-server";
const rpc=vi.fn();
const own='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',peer='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const access={roles:['player'],athleteId:own,supabase:{rpc}} as unknown as Parameters<typeof loadPhysicalityComposite>[0];
beforeEach(()=>{ rpc.mockReset(); });
it('denies unauthorized roles before any provider call',async()=>{
  await expect(loadPhysicalityComposite({...access,roles:[]})).rejects.toThrow('access denied');expect(rpc).not.toHaveBeenCalled();
});
it('uses only the minimal leaderboard RPCs and keeps peer profile links unavailable',async()=>{
  rpc.mockImplementation(async(name,args)=>{
    if(name==='team_leaderboard_options')return {data:([['height','in'],['muscle_mass','lb'],['body_fat_pct','%']] as const).map(([metricKey,unit])=>({metricKey,unit,source:'renpho',period:'fall_2026',athleteCount:5})),error:null};
    const fat=args.p_metric_key==='body_fat_pct';
    return {data:Array.from({length:5},(_,i)=>({rank:i+1,athleteCode:`PAC-000${i+1}`,name:`Fictional Player ${i+1}`,jerseyNumber:null,position:null,profileId:i===0?own:peer,value:fat?10+i:75-i,measuredAt:'2026-09-06',source:'renpho',derived:false})),error:null};
  });
  const result=await loadPhysicalityComposite(access);
  expect(result.rows).toHaveLength(5);expect(result.rows[0].profileId).toBe(own);expect(result.rows.slice(1).every(r=>r.profileId===null)).toBe(true);
  expect(rpc.mock.calls.map(c=>c[0])).toEqual(['team_leaderboard_options','team_leaderboard','team_leaderboard','team_leaderboard']);
});
it('does not invent an empty cohort when a provider request fails',async()=>{
  rpc.mockResolvedValue({data:null,error:{message:'Fictional failure'}});
  await expect(loadPhysicalityComposite(access)).rejects.toThrow('could not be loaded');
});
