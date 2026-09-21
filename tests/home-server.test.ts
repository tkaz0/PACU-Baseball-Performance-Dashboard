import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({staff:vi.fn(),performance:vi.fn(),games:vi.fn(),from:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/analytics-server",()=>({loadStaffHomeSummary:mocks.staff}));vi.mock("@/lib/performance-server",()=>({loadAthletePerformance:mocks.performance}));vi.mock("@/lib/game-server",()=>({loadGameStats:mocks.games}));
import {loadHomeSummary} from "@/lib/home-server";
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(()=>vi.resetAllMocks());
const access=(roles:string[],athleteId:string|null=id,preview:unknown=null)=>({roles,athleteId,preview,supabase:{from:mocks.from}}) as unknown as Parameters<typeof loadHomeSummary>[0];
it("routes staff through the independently guarded staff loader",async()=>{mocks.staff.mockResolvedValue({players:2});expect(await loadHomeSummary(access(["coach"]))).toEqual({players:2});expect(mocks.from).not.toHaveBeenCalled();});
it("an unlinked player performs no queries",async()=>{expect(await loadHomeSummary(access(["player"],null))).toBeNull();expect(mocks.staff).not.toHaveBeenCalled();expect(mocks.from).not.toHaveBeenCalled();});
it("Admin-as-Player reads only the presented athlete and never requests team summaries",async()=>{
 const athlete={id,athlete_code:"SYN-001",athlete_seasons:[]};const query={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:athlete,error:null})};query.select.mockReturnValue(query);query.eq.mockReturnValue(query);mocks.from.mockReturnValue(query);mocks.performance.mockResolvedValue({measurements:[],batches:[],percentileOverrides:[]});mocks.games.mockResolvedValue([]);
 const current=access(["player"],id,{role:"player"});const result=await loadHomeSummary(current);expect(query.eq).toHaveBeenCalledWith("id",id);expect(mocks.games).toHaveBeenCalledWith(current,id);expect(mocks.performance).toHaveBeenCalledWith(current,athlete);expect(mocks.staff).not.toHaveBeenCalled();expect(result?.players).toBe(1);
});
it("fails rather than displaying another player's data or fabricated zeros",async()=>{
 const query={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:{id:"other"},error:null})};query.select.mockReturnValue(query);query.eq.mockReturnValue(query);mocks.from.mockReturnValue(query);await expect(loadHomeSummary(access(["player"]))).rejects.toThrow("could not be loaded");expect(mocks.performance).not.toHaveBeenCalled();
});
