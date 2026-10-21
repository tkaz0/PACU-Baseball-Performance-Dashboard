import {beforeEach,expect,it,vi} from "vitest";
const rpc=vi.hoisted(()=>vi.fn());vi.mock("server-only",()=>({}));
import {loadGameComparisons,loadGameLeaderboards} from "@/lib/game-comparison-server";
const own="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",other="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const access={roles:["player"],athleteId:own,supabase:{rpc}} as unknown as Parameters<typeof loadGameComparisons>[0];
const comparison={metric:"batting_avg",source:"qpa_fall_2026",eventId:"",value:.3,percentile:50,sampleSize:5,snapshotId:own};
beforeEach(()=>{rpc.mockReset();rpc.mockResolvedValue({data:[],error:null});});
it("blocks a player's peer comparison before querying",async()=>{await expect(loadGameComparisons(access,other)).rejects.toThrow("access denied");expect(rpc).not.toHaveBeenCalled();});
const byName=(comparisons:unknown[],board:unknown[]=[])=>rpc.mockImplementation(async(name:string)=>({data:name==="game_comparisons"?comparisons:board,error:null}));
it("accepts only an exact own-summary whitelist and valid cohorts",async()=>{byName([comparison]);
 // Not on the qualified team board: the value is kept and the percentile withheld.
 expect(await loadGameComparisons(access,own)).toEqual([{...comparison,percentile:null}]);
 for(const item of [{...comparison,email:"fictional@example.com"},{...comparison,sampleSize:4},{...comparison,percentile:NaN},{...comparison,source:"other"}]){byName([item]);await expect(loadGameComparisons(access,own)).rejects.toThrow("verified");}});
it("re-ranks game percentiles among qualified players only",async()=>{
 const lb=(code:string,metric:string,value:number,opportunities:number,profileId:string|null=null)=>({metric,source:"qpa_fall_2026",eventId:"",playedOn:null,value,unit:metric==="qpa_pct"?"%":"avg",rank:1,name:"Fictional Player",code,profileId,updatedAt:"2026-09-12T23:00:00Z",percentile:null,sampleSize:7,opportunities});
 const peers=["PAC-9001","PAC-9002","PAC-9003","PAC-9004","PAC-9005"];
 const board=[...peers.flatMap((code,i)=>[lb(code,"batting_avg",[.2,.25,.3,.35,.4][i],30),lb(code,"qpa_pct",50,30)]),lb("PAC-9000","batting_avg",.3,30,own),lb("PAC-9000","qpa_pct",50,30,own),lb("PAC-9009","batting_avg",.9,1),lb("PAC-9009","qpa_pct",90,1)];
 byName([comparison],board);
 // Qualified AVG: .20 .25 .30(own) .30 .35 .40 → two worse, one tie, n = 6 → 100 × (2 + .5) / 5. The 1-PA player is left out.
 expect((await loadGameComparisons(access,own))[0]).toMatchObject({qualified:true,sampleSize:6,percentile:50});
 byName([comparison],board.map(r=>r.code==="PAC-9000"?{...r,opportunities:1}:r));
 expect((await loadGameComparisons(access,own))[0]).toMatchObject({qualified:false,percentile:null});
});
it("removes peer links in player presentation while retaining authorized ranking fields",async()=>{const row={metric:"batting_avg",source:"qpa_fall_2026",eventId:"",playedOn:null,value:.3,unit:"avg",rank:1,name:"Fictional Player",code:"PAC-0002",profileId:other,updatedAt:"2026-09-12T23:00:00Z",percentile:null,sampleSize:1};rpc.mockResolvedValue({data:[row],error:null});expect((await loadGameLeaderboards(access))[0].profileId).toBeNull();rpc.mockResolvedValue({data:[{...row,metric:"pa",unit:"count"}],error:null});await expect(loadGameLeaderboards(access)).rejects.toThrow("verified");});

it("validates optional opportunity counts during compatible deployment",async()=>{
 const row={metric:"batting_avg",source:"qpa_fall_2026",eventId:"",playedOn:null,value:.3,unit:"avg",rank:1,name:"Fictional Player",code:"PAC-0002",profileId:other,updatedAt:"2026-09-12T23:00:00Z",percentile:null,sampleSize:1};
 for(const opportunities of [20,null]){rpc.mockResolvedValue({data:[{...row,opportunities}],error:null});expect((await loadGameLeaderboards(access))[0]).toMatchObject({opportunities,profileId:null});}
 for(const opportunities of [0,-1,NaN,2.5,"20",4000000001]){rpc.mockResolvedValue({data:[{...row,opportunities}],error:null});await expect(loadGameLeaderboards(access)).rejects.toThrow("verified");}
});

it("accepts estimated and pitching efficiency ranks only with their exact units",async()=>{
 for(const [source,metric,unit] of [["qpa_fall_2026","batting_production_plus","index"],["qpa_fall_2026","batting_ops","avg"],["qpa_fall_2026","batting_est_slg","avg"],["qpa_fall_2026","batting_est_iso","avg"],["qpa_fall_2026","batting_est_wobacon","avg"],["pitching_fall_2026","pitching_whip","decimal"],["pitching_fall_2026","pitching_k_bb","decimal"]]){
  const row={source,metric,unit,eventId:source==="qpa_fall_2026"?"":"fall-2026-cumulative",playedOn:null,value:1.2,rank:1,name:"Fictional Player",code:"PAC-0002",profileId:other,updatedAt:"2026-09-28T23:00:00Z",percentile:null,sampleSize:1,opportunities:12};
  rpc.mockResolvedValue({data:[row],error:null});expect((await loadGameLeaderboards(access))[0]).toMatchObject({metric,unit,profileId:null});
  rpc.mockResolvedValue({data:[{...row,unit:"count"}],error:null});await expect(loadGameLeaderboards(access)).rejects.toThrow("verified");
 }
});
