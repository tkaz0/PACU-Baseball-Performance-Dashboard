import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({staff:vi.fn(),performance:vi.fn(),games:vi.fn(),from:vi.fn(),rpc:vi.fn(),designChoices:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/analytics-server",()=>({loadStaffHomeSummary:mocks.staff}));vi.mock("@/lib/performance-server",()=>({loadAthletePerformance:mocks.performance}));vi.mock("@/lib/game-server",()=>({loadGameStats:mocks.games}));
vi.mock("@/lib/staff-athlete-search-server",()=>({loadDesignAthleteChoices:mocks.designChoices}));
import {pacificTestingDate} from "@/lib/testing-checklist";
import {loadHomeSummary,loadHomeSnapshot,loadHomeActivity} from "@/lib/home-server";
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(()=>{vi.resetAllMocks();mocks.designChoices.mockResolvedValue([{id}]);});
const access=(roles:string[],athleteId:string|null=id,preview:unknown=null)=>({roles,athleteId,preview,supabase:{from:mocks.from,rpc:mocks.rpc}}) as unknown as Parameters<typeof loadHomeSummary>[0];
it("routes staff through the independently guarded staff loader",async()=>{mocks.staff.mockResolvedValue({players:2});expect(await loadHomeSummary(access(["coach"]))).toEqual({players:2});expect(mocks.from).not.toHaveBeenCalled();});
it("an unlinked player performs no queries",async()=>{expect(await loadHomeSummary(access(["player"],null))).toBeNull();expect(mocks.staff).not.toHaveBeenCalled();expect(mocks.from).not.toHaveBeenCalled();});
it("Admin-as-Player reads only the presented athlete and never requests team summaries",async()=>{
 const athlete={id,athlete_code:"SYN-001",athlete_seasons:[]};const query={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:athlete,error:null})};query.select.mockReturnValue(query);query.eq.mockReturnValue(query);mocks.from.mockReturnValue(query);mocks.performance.mockResolvedValue({measurements:[],batches:[],percentileOverrides:[]});mocks.games.mockResolvedValue([]);
 const current=access(["player"],id,{role:"player"});const result=await loadHomeSummary(current);expect(query.eq).toHaveBeenCalledWith("id",id);expect(mocks.games).toHaveBeenCalledWith(current,id);expect(mocks.performance).toHaveBeenCalledWith(current,athlete,{includePercentiles:false});expect(mocks.staff).not.toHaveBeenCalled();expect(result?.players).toBe(1);
});
it("fails rather than displaying another player's data or fabricated zeros",async()=>{
 const query={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:{id:"other"},error:null})};query.select.mockReturnValue(query);query.eq.mockReturnValue(query);mocks.from.mockReturnValue(query);await expect(loadHomeSummary(access(["player"]))).rejects.toThrow("could not be loaded");expect(mocks.performance).not.toHaveBeenCalled();
});

it("passes the presented player's role and normalized core Blast readings into the visit digest",async()=>{
 const season={season:"2026-27",player_type:"position",primary_position:"OF",secondary_position:null};
 const athlete={id,athlete_code:"SYN-001",athlete_seasons:[season]};
 const query={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:athlete,error:null})};query.select.mockReturnValue(query);query.eq.mockReturnValue(query);mocks.from.mockReturnValue(query);
 const blastSource="Blast Motion · Average · 2026-09-13:2026-09-20";
 const measurements=[
  {id:"hand",metric:"Peak Hand Speed",unit:"mph",value:21,source:blastSource},
  {id:"angle",metric:"Vertical Bat Angle",unit:"deg",value:-30,source:blastSource},
  {id:"hitting",metric:"Max Exit Velocity",unit:"mph",value:90,source:"Full Swing · Intrasquad"},
  {id:"pitch",metric:"Pitch Type Max Velocity",unit:"mph",value:80,source:"Full Swing · Intrasquad · Fastball"},
 ].map(row=>({...row,athlete_code:"SYN-001",measured_at:"2026-09-20",batch_id:"fictional-batch"}));
 mocks.performance.mockResolvedValue({measurements,batches:[{id:"fictional-batch",importedAt:"2026-09-25T00:00:00Z"}],percentileOverrides:[]});mocks.games.mockResolvedValue([]);
 const visit={since:"2026-09-21T00:00:00Z",viewedAt:"2026-09-27T00:00:00Z",record:true};
 const hitter=await loadHomeSummary(access(["player"]),visit);
 expect(hitter).toMatchObject({visitDigest:{newResults:3,updatedPlayers:1,newBests:0}});
 season.player_type="pitcher";season.primary_position="P";
 const pitcher=await loadHomeSummary(access(["player"]),visit);
 expect(pitcher).toMatchObject({visitDigest:{newResults:1,updatedPlayers:1,newBests:0}});
 expect(mocks.staff).not.toHaveBeenCalled();expect(query.eq).toHaveBeenCalledWith("id",id);
});

it("loads staff coverage without requiring numerical history for the initial Home",async()=>{
 mocks.rpc.mockResolvedValue({data:{version:1,athleteId:null,today:pacificTestingDate(),playerIds:[id],totalReadings:0,groups:[]},error:null});mocks.games.mockResolvedValue([]);
 const current=access(["coach"],null),result=await loadHomeSnapshot(current);expect(result?.players).toBe(1);expect(mocks.rpc).toHaveBeenCalledWith("home_measurement_summary",{p_athlete_id:null});expect(mocks.staff).not.toHaveBeenCalled();expect(mocks.performance).not.toHaveBeenCalled();expect(mocks.from).not.toHaveBeenCalled();
 expect(mocks.designChoices).toHaveBeenCalledWith(current,"swing");
 expect(result?.coverage.filter(row=>row.positionOnly).map(row=>row.eligiblePlayers)).toEqual([1,1]);
});
it("checks own scope and suppresses pitcher-only speed coverage before computing totals",async()=>{
 const athlete={id,athlete_seasons:[{season:"2026-27",player_type:"pitcher",primary_position:"P"}]};const query={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:athlete,error:null})};query.select.mockReturnValue(query);query.eq.mockReturnValue(query);mocks.from.mockReturnValue(query);
 mocks.rpc.mockResolvedValue({data:{version:1,athleteId:id,today:pacificTestingDate(),playerIds:[id],totalReadings:1,groups:[{athleteId:id,metric:"Home to First",unit:"s",source:"Fictional testing",date:"2026-09-01",importedAt:"2026-09-02T00:00:00Z",count:1}]},error:null});mocks.games.mockResolvedValue([]);
 const current=access(["player"],id,{role:"player"});const summary=await loadHomeSnapshot(current);expect(summary?.playersWithResults).toBe(0);expect(query.eq).toHaveBeenCalledWith("id",id);expect(mocks.rpc).toHaveBeenCalledWith("home_measurement_summary",{p_athlete_id:id});expect(mocks.games).toHaveBeenCalledWith(current,id);expect(mocks.performance).not.toHaveBeenCalled();
 expect(summary?.coverage.filter(row=>row.positionOnly).map(row=>row.eligiblePlayers)).toEqual([0,0]);
 expect(mocks.designChoices).not.toHaveBeenCalled();
});
it("intersects staff position choices with eligible coverage IDs without counting pitcher results",async()=>{
 const position="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",twoWay="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
 mocks.designChoices.mockResolvedValue([{id:position},{id:twoWay},{id:"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}]);
 const groups=[id,position,twoWay].map(athleteId=>({athleteId,metric:"Bat Speed",unit:"mph",source:"Full Swing · Practice",date:"2026-09-01",importedAt:"2026-09-02T00:00:00Z",count:1}));
 mocks.rpc.mockResolvedValue({data:{version:1,athleteId:null,today:pacificTestingDate(),playerIds:[id,position,twoWay],totalReadings:3,groups},error:null});mocks.games.mockResolvedValue([]);
 const summary=await loadHomeSnapshot(access(["coach"],null));
 expect(summary?.coverage.find(row=>row.key==="practice")).toMatchObject({players:2,eligiblePlayers:2});
 expect(summary?.players).toBe(3);expect(summary?.playersWithResults).toBe(3);
});
it("falls back to the standard reader instead of fabricated coverage when the compact RPC fails",async()=>{
 const standard={fictional:"standard summary"};mocks.staff.mockResolvedValue(standard);mocks.games.mockResolvedValue([]);
 const reasons:string[]=[];
 mocks.rpc.mockResolvedValue({data:null,error:{code:"PGRST202"}});expect(await loadHomeSnapshot(access(["coach"],null),r=>reasons.push(r))).toBe(standard);
 mocks.rpc.mockResolvedValue({data:{version:1,athleteId:id,today:pacificTestingDate(),playerIds:[id],totalReadings:0,groups:[]},error:null});expect(await loadHomeSnapshot(access(["coach"],null),r=>reasons.push(r))).toBe(standard);
 expect(reasons).toEqual([expect.stringContaining("could not be loaded (PGRST202)"),expect.stringContaining("could not be verified")]);
 mocks.staff.mockRejectedValue(new Error("Fictional error"));mocks.rpc.mockResolvedValue({data:null,error:{code:"PGRST202"}});await expect(loadHomeSnapshot(access(["coach"],null))).rejects.toThrow("Fictional error");
});
it("does not query an unlinked player and reports streamed-history failure explicitly",async()=>{
 expect(await loadHomeSnapshot(access(["player"],null))).toBeNull();expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.games).not.toHaveBeenCalled();
 mocks.staff.mockRejectedValue(new Error("Fictional error"));expect(await loadHomeActivity(access(["coach"],null),{since:null,viewedAt:"2026-10-04T00:00:00Z",record:false})).toEqual({ok:false});
});
