import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),from:vi.fn(),games:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/auth",()=>({requireImportAccess:mocks.access}));
vi.mock("@/lib/game-server",()=>({loadGameStats:mocks.games}));
import { analyticsPages, loadAnalytics } from "@/lib/analytics-server";
beforeEach(()=>{vi.resetAllMocks();mocks.games.mockResolvedValue([]);});
it("denies unauthorized access before any team query",async()=>{mocks.access.mockRejectedValue(Error("DENIED"));await expect(loadAnalytics()).rejects.toThrow("DENIED");expect(mocks.from).not.toHaveBeenCalled();expect(mocks.games).not.toHaveBeenCalled();});
it("detects provider truncation and changing page counts instead of returning false missing data",async()=>{await expect(analyticsPages(async()=>({data:[1],count:2,error:null}),x=>x,1000)).rejects.toThrow("could not be verified");const req=vi.fn().mockResolvedValueOnce({data:Array(500).fill(1),count:501,error:null}).mockResolvedValueOnce({data:[1,2],count:502,error:null});await expect(analyticsPages(req,x=>x,1000)).rejects.toThrow("could not be verified");});
it("reads the full final page and fails on provider errors",async()=>{const req=vi.fn().mockResolvedValueOnce({data:Array(500).fill(1),count:501,error:null}).mockResolvedValueOnce({data:[2],count:501,error:null});expect(await analyticsPages(req,x=>x,1000)).toHaveLength(501);await expect(analyticsPages(async()=>({data:null,count:0,error:"unavailable"}),x=>x,1000)).rejects.toThrow("could not be verified");});
it("returns only eligible roster fields and numerical readings through the signed-in client",async()=>{
 const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
 const athlete={id,athlete_code:"SYN-001",first_name:"Fictional",last_name:"Player",preferred_name:null,athlete_seasons:[{season:"2026-27",academic_class:"freshman",primary_position:"OF",player_type:"position",bats:"R",throws:"R",roster_status:"active"}]};
 const measurement={observation_id:"fictional-obs",athlete_id:id,metric_key:"weight",metric:"Weight",unit:"lb",value:180,measured_at:"2026-09-06",source:"Fictional",imported_at:"2026-09-06T00:00:00Z"};
 const make=(data:unknown[])=>{const chain={select:vi.fn(),eq:vi.fn(),in:vi.fn(),gte:vi.fn(),lte:vi.fn(),order:vi.fn(),range:vi.fn().mockResolvedValue({data,count:data.length,error:null})};for(const key of ["select","eq","in","gte","lte","order"] as const)chain[key].mockReturnValue(chain);return chain;};
 const roster=make([athlete]),readings=make([measurement]);mocks.from.mockImplementation(table=>table==="athletes"?roster:readings);mocks.access.mockResolvedValue({supabase:{from:mocks.from}});
 const result=await loadAnalytics();expect(result.players).toHaveLength(1);expect(result.readings[0].value).toBe(180);expect(Object.keys(result.players[0]).sort()).toEqual(["id","code","name","academicClass","position","playerType","bats","throws"].sort());expect(readings.in).toHaveBeenCalledWith("athlete_id",[id]);expect(readings.gte).toHaveBeenCalledWith("measured_at","2026-06-01");
});
