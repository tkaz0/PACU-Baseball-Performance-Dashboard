import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Measurement } from "@/lib/imports/engine";
const mock=vi.hoisted(()=>({rows:[] as Record<string,unknown>[],summary:[] as Record<string,unknown>[],filters:[] as [string,unknown][],rpc:vi.fn(),requireAdmin:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth',()=>({requireAdminMutation:mock.requireAdmin}));
import { loadAthletePerformance,importReviewedPerformance } from '@/lib/performance-server';
const own='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const hash='a'.repeat(64),id=`observation:${JSON.stringify([hash,'Fictional tests',2,0])}`;
const row=()=>({observation_id:id,athlete_id:own,metric_key:'weight',metric:'Weight',unit:'lb',value:50,measured_at:'2026-08-20',source:'RENPHO',source_file:'fictional.csv',source_sheet:'Fictional tests',source_row:2,file_hash:hash,import_id:'11111111-1111-4111-8111-111111111111',imported_at:'2026-09-06T12:00:00.000Z'});
function access(roles=['player'],athleteId:string|null=own) {
  const query={select:()=>query,eq:(key:string,value:unknown)=>{mock.filters.push([key,value]);return query;},order:()=>query,range:async()=>({data:mock.rows,error:null})};
  return {roles,athleteId,supabase:{from:()=>query,rpc:mock.rpc}} as unknown as Parameters<typeof loadAthletePerformance>[0];
}
beforeEach(()=>{mock.rows=[row()];mock.summary=[];mock.filters=[];vi.clearAllMocks();mock.rpc.mockImplementation(async(name:string)=>({data:name==='athlete_performance_summary'?mock.summary:{import_id:'11111111-1111-4111-8111-111111111111',created:1,unchanged:0},error:null}));mock.requireAdmin.mockResolvedValue(access(['admin']));});
describe('server performance adapter boundaries',()=>{
  it('scopes player and admin-player-preview rows before querying and retains private source metadata',async()=>{
    const result=await loadAthletePerformance(access(),{id:own,athlete_code:'SYN-001'});
    expect(mock.filters).toEqual([['athlete_id',own]]);expect(result.measurements[0]).toMatchObject({id,athlete_code:'SYN-001',value:50,source_file:'fictional.csv'});
    expect(result.batches).toHaveLength(1);expect(result.measurements[0].batch_id).toBe(result.batches[0].id);
    expect(mock.rpc).toHaveBeenCalledWith('athlete_performance_summary',{p_athlete_id:own});
  });
  it('denies another player or unlinked identity before any database call',async()=>{
    await expect(loadAthletePerformance(access(),{id:other,athlete_code:'SYN-002'})).rejects.toThrow('access denied');
    await expect(loadAthletePerformance(access(['player'],null),{id:own,athlete_code:'SYN-001'})).rejects.toThrow('access denied');
    expect(mock.filters).toEqual([]);expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('rejects a mismatched returned athlete instead of serializing it',async()=>{
    mock.rows=[{...row(),athlete_id:other}];
    await expect(loadAthletePerformance(access(),{id:own,athlete_code:'SYN-001'})).rejects.toThrow('could not be verified');
    expect(mock.rpc).not.toHaveBeenCalled();
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
