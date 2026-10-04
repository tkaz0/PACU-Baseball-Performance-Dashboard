import { beforeEach,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
import { loadTeamGameTrends } from "@/lib/game-trends-server";
import { latestDailySnapshots,teamGameTrends,type GameSnapshotRow } from "@/lib/game-trends";
const source="qpa_fall_2026" as const;
const snapshot=(id:string,at:string,hits=1):GameSnapshotRow=>({id,source,fetched_at:at,observations:Object.entries({ab:4,base_hit:hits,pa:4,bb:0,hbp:0,sac_fly:0}).map(([metric,value])=>({athleteCode:"SYN-001",metric,value,unit:"count",scope:"cumulative_fall"}))});
const snapshots=[snapshot("old","2026-10-02T12:00:00Z"),snapshot("new","2026-10-02T20:00:00Z",2),snapshot("next","2026-10-03T12:00:00Z",3)];
const from=vi.fn();
const access=(roles:string[])=>({roles,supabase:{from}}) as unknown as Parameters<typeof loadTeamGameTrends>[0];
beforeEach(()=>vi.resetAllMocks());
it("fetches only authoritative daily observation payloads and preserves chart values",async()=>{
 const calls:{fields:string;ids?:string[];limit?:number}[]=[];
 from.mockImplementation(()=>{const call:{fields:string;ids?:string[];limit?:number}={fields:""};calls.push(call);const q={select:(fields:string)=>{call.fields=fields;return q;},order:()=>q,in:(_key:string,ids:string[])=>{call.ids=ids;return q;},limit:async(limit:number)=>{call.limit=limit;return {data:call.ids?snapshots.filter(s=>call.ids!.includes(s.id)):snapshots.map(({id,source,fetched_at})=>({id,source,fetched_at})),error:null};}};return q;});
 expect(await loadTeamGameTrends(access(["coach"]))).toEqual(teamGameTrends(snapshots));
 expect(calls).toEqual([{fields:"id,source,fetched_at",limit:40},{fields:"id,source,fetched_at,observations",ids:["new","next"],limit:40}]);
});
it("denies player and Player View before requesting snapshot metadata",async()=>{
 expect(await loadTeamGameTrends(access(["player"]))).toEqual({});expect(from).not.toHaveBeenCalled();
});
it.each(["missing","extra","changed","invalid","provider"])("does not draw stale or partial history after a %s response",async failure=>{
 let n=0;from.mockImplementation(()=>{const q={select:()=>q,order:()=>q,in:()=>q,limit:async()=>{n++;return n===1?{data:snapshots.map(({id,source,fetched_at})=>({id,source,fetched_at})),error:null}:{data:failure==="missing"?[snapshots[1]]:failure==="extra"?snapshots:failure==="changed"?[{...snapshots[1],fetched_at:"2026-10-04T00:00:00Z"},snapshots[2]]:failure==="invalid"?[{...snapshots[1],observations:null},snapshots[2]]:null,error:failure==="provider"?{}:null};}};return q;});
 expect(await loadTeamGameTrends(access(["admin"]))).toEqual({});
});
it("uses Pacific days, deterministic ties, and never resurrects an earlier valid rate",()=>{
 const sameDay=[snapshot("a","2026-10-03T05:00:00Z"),snapshot("b","2026-10-03T06:00:00Z",2),{...snapshot("c","2026-10-03T06:00:00Z"),observations:[]},snapshot("d","2026-10-03T08:00:00Z",3)];
 expect(latestDailySnapshots(sameDay).map(s=>s.id)).toEqual(["c","d"]);
 expect(teamGameTrends(sameDay).qpa_fall_2026?.batting_avg).toEqual([{date:"2026-10-03",value:.75}]);
});
