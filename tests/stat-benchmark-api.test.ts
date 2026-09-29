import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),board:vi.fn(),games:vi.fn()}));
vi.mock("@/lib/auth",()=>({getAccess:mocks.access}));
vi.mock("@/lib/leaderboard-server",()=>({loadLeaderboard:mocks.board}));
vi.mock("@/lib/game-comparison-server",()=>({loadGameLeaderboards:mocks.games}));
import { GET } from "@/app/api/stat-benchmarks/route";
const request=(query="metric=avg_exit_velocity&source=Full%20Swing%20%C2%B7%20Game&unit=mph")=>new Request(`https://example.com/api/stat-benchmarks?${query}`);
beforeEach(()=>{vi.resetAllMocks();mocks.access.mockResolvedValue({access:{roles:["player"],athleteId:"fictional-own"}});mocks.board.mockResolvedValue([60,70,80,90,100].map(value=>({value,name:"Fictional Player",profileId:"private-fictional-id"})));});
it("denies anonymous and unlinked players before any ranking reader",async()=>{
 for(const access of [null,{roles:["player"],athleteId:null}]){mocks.access.mockResolvedValue({access});expect((await GET(request())).status).toBe(403);}
 expect(mocks.board).not.toHaveBeenCalled();expect(mocks.games).not.toHaveBeenCalled();
});
it("returns aggregate ranges only through an existing authorized ranking reader",async()=>{
 const response=await GET(request()),data=await response.json();
 expect(response.status).toBe(200);expect(response.headers.get("Cache-Control")).toBe("private, no-store");
 expect(data.benchmark.n).toBe(5);expect(JSON.stringify(data)).not.toContain("Fictional Player");expect(JSON.stringify(data)).not.toContain("private-fictional-id");
 expect(mocks.board.mock.calls[0][1]).toEqual({metricKey:"avg_exit_velocity",source:"full swing · game",unit:"mph",period:"fall_2026"});
});
it("rejects unsupported units, periods and arbitrary metric lookups",async()=>{
 for(const query of ["metric=avg_exit_velocity&source=renpho&unit=password","metric=not_a_metric&source=renpho&unit=mph","metric=qpa_pct&source=qpa_fall_2026&unit=%&period=summer_2026"]){expect((await GET(request(query))).status).toBe(400);}
 expect(mocks.board).not.toHaveBeenCalled();expect(mocks.games).not.toHaveBeenCalled();
});
it("keeps game sources and periods separate and never reads peer game rows",async()=>{
 mocks.games.mockResolvedValue([1,2,3,4,5].map(value=>({value,source:"qpa_fall_2026",metric:"qpa_pct",eventId:"",unit:"%",name:"Fictional Player"})).concat([{value:99,source:"pitching_fall_2026",metric:"qpa_pct",eventId:"",unit:"%",name:"Fictional Player"}]));
 const response=await GET(request("metric=qpa_pct&source=qpa_fall_2026&unit=%25"));expect((await response.json()).benchmark.n).toBe(5);expect(mocks.board).not.toHaveBeenCalled();
});
it("returns no invented ranges for fewer than five athletes or unavailable reads",async()=>{
 mocks.board.mockResolvedValue([{value:70}]);expect((await (await GET(request())).json()).benchmark).toBeNull();
 mocks.board.mockRejectedValue(Error("unavailable"));expect((await GET(request())).status).toBe(503);
});
