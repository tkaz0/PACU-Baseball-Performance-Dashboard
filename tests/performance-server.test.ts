import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Measurement } from "@/lib/imports/engine";
const mock=vi.hoisted(()=>({rows:[] as Record<string,unknown>[],summary:[] as Record<string,unknown>[],rpc:vi.fn(),requireAdmin:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth',()=>({requireImportAccess:mock.requireAdmin}));
import { loadAthletePerformance,importReviewedPerformance } from '@/lib/performance-server';
const own='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const hash='a'.repeat(64),id=`observation:${JSON.stringify([hash,'Fictional tests',2,0])}`;
const row=()=>({observation_id:id,athlete_id:own,metric_key:'weight',metric:'Weight',unit:'lb',value:50,measured_at:'2026-08-20',source:'RENPHO',source_file:'fictional.csv',source_sheet:'Fictional tests',source_row:2,file_hash:hash,import_id:'11111111-1111-4111-8111-111111111111',imported_at:'2026-09-06T12:00:00.000Z'});
function access(roles=['player'],athleteId:string|null=own) {
  return {roles,athleteId,supabase:{rpc:mock.rpc}} as unknown as Parameters<typeof loadAthletePerformance>[0];
}
beforeEach(()=>{mock.rows=[row()];mock.summary=[];vi.clearAllMocks();mock.rpc.mockImplementation(async(name:string,args:{p_offset:number})=>({data:name==='athlete_performance_measurements'?mock.rows.slice(args.p_offset,args.p_offset+1000):name==='athlete_performance_summary'?mock.summary:{import_id:'11111111-1111-4111-8111-111111111111',created:1,unchanged:0},error:null}));mock.requireAdmin.mockResolvedValue(access(['admin']));});
describe('server performance adapter boundaries',()=>{
  it('scopes player and admin-player-preview rows before querying and retains private source metadata',async()=>{
    const result=await loadAthletePerformance(access(),{id:own,athlete_code:'SYN-001'});
    expect(mock.rpc.mock.calls[0]).toEqual(['athlete_performance_measurements',{p_athlete_id:own,p_offset:0}]);expect(result.measurements[0]).toMatchObject({id,athlete_code:'SYN-001',value:50,source_file:'fictional.csv'});
    expect(result.batches).toHaveLength(1);expect(result.measurements[0].batch_id).toBe(result.batches[0].id);
    expect(mock.rpc).toHaveBeenCalledWith('athlete_performance_summary',{p_athlete_id:own});
  });
  it('denies another player or unlinked identity before any database call',async()=>{
    await expect(loadAthletePerformance(access(),{id:other,athlete_code:'SYN-002'})).rejects.toThrow('access denied');
    await expect(loadAthletePerformance(access(['player'],null),{id:own,athlete_code:'SYN-001'})).rejects.toThrow('access denied');
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('rejects a mismatched returned athlete instead of serializing it',async()=>{
    mock.rows=[{...row(),athlete_id:other}];
    await expect(loadAthletePerformance(access(),{id:own,athlete_code:'SYN-001'})).rejects.toThrow('could not be verified');
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc.mock.calls[0][0]).toBe('athlete_performance_measurements');
  });
  it('validates bounded page shapes and rejects unexpected fields before serializing a profile',async()=>{
    for(const data of [null,{},[null],[{...row(),value:NaN}],[{...row(),import_id:'invalid'}],[{...row(),imported_by:other}],Array.from({length:1001},row)]) {
      mock.rpc.mockResolvedValueOnce({data,error:null});
      await expect(loadAthletePerformance(access(),{id:own,athlete_code:'SYN-001'})).rejects.toThrow('page format is invalid');
    }
    mock.rpc.mockResolvedValueOnce({data:[],error:{message:'unavailable'}});
    await expect(loadAthletePerformance(access(),{id:own,athlete_code:'SYN-001'})).rejects.toThrow('could not be loaded');
  });
  it('loads fixed pages in sequence, retains order and stops after the final partial page',async()=>{
    mock.rows=Array.from({length:1001},(_,i)=>({...row(),observation_id:`observation:${JSON.stringify([hash,'Fictional tests',2,i])}`}));
    const result=await loadAthletePerformance(access(),{id:own,athlete_code:'SYN-001'});
    expect(result.measurements.map(item=>item.id)).toEqual(mock.rows.map(item=>item.observation_id));
    expect(mock.rpc.mock.calls.map(([name,args])=>[name,args.p_offset])).toEqual([
      ['athlete_performance_measurements',0],['athlete_performance_measurements',1000],['athlete_performance_summary',undefined],
    ]);
  });
  it('refuses duplicate observations and histories over twenty thousand rows',async()=>{
    mock.rows=[row(),row()];
    await expect(loadAthletePerformance(access(),{id:own,athlete_code:'SYN-001'})).rejects.toThrow('changed while loading');
    vi.clearAllMocks();
    mock.rows=Array.from({length:20001},(_,i)=>({...row(),source_row:i+1,observation_id:`observation:${JSON.stringify([hash,'Fictional tests',i+1,0])}`}));
    await expect(loadAthletePerformance(access(),{id:own,athlete_code:'SYN-001'})).rejects.toThrow('exceeds the supported measurement history');
    expect(mock.rpc.mock.calls).toHaveLength(21);
    expect(mock.rpc.mock.calls.at(-1)).toEqual(['athlete_performance_measurements',{p_athlete_id:own,p_offset:20000}]);
  });
  it('accepts only validated fixed-metric summary shapes without peer rows',async()=>{
    mock.summary=[{metricKey:'weight',measuredAt:'2026-08-20',observedValue:50,unit:'lb',source:'RENPHO',period:'summer_2026',direction:'neutral',sampleSize:1,value:null}];
    const result=await loadAthletePerformance(access(),{id:own,athlete_code:'SYN-001'});
    expect(result.percentileOverrides).toEqual([{...mock.summary[0],athleteCode:'SYN-001'}]);
    mock.summary[0].value=99;
    await expect(loadAthletePerformance(access(),{id:own,athlete_code:'SYN-001'})).rejects.toThrow('summary format is invalid');
  });
  it('requires fresh administrator mutation guard before import validation or RPC',async()=>{
    mock.requireAdmin.mockRejectedValueOnce(new Error('Preview is read-only'));
    await expect(importReviewedPerformance([])).rejects.toThrow('Preview is read-only');expect(mock.rpc).not.toHaveBeenCalled();
    const m:Measurement={id,athlete_code:'SYN-001',metric:'Weight',unit:'lb',value:50,measured_at:'2026-08-20',source:'RENPHO',source_file:'fictional.csv',source_sheet:'Fictional tests',source_row:2,file_hash:hash};
    expect(await importReviewedPerformance([m])).toMatchObject({created:1,unchanged:0});
    expect(mock.rpc.mock.calls[0][1].p_rows[0]).toMatchObject({athlete_code:'SYN-001',metric_key:'weight',value:50});
  });
});
