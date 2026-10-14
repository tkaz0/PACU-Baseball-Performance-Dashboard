import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({from:vi.fn(),performance:vi.fn(),games:vi.fn(),comparisons:vi.fn(),rpc:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/performance-server",()=>({loadAthletePerformance:mocks.performance}));
vi.mock("@/lib/game-server",()=>({loadGameStats:mocks.games}));
vi.mock("@/lib/game-comparison-server",()=>({loadGameComparisons:mocks.comparisons}));
vi.mock("@/lib/player-fall-summaries-server",()=>({loadPlayerFallSummaries:async()=>[]}));
vi.mock("@/lib/game-weeks-server",()=>({loadAthleteGameWeeks:async()=>null}));
vi.mock("@/lib/contacts-allowed-server",()=>({loadContactsAllowed:async()=>null}));
vi.mock("@/lib/pitch-grades-server",()=>({loadOwnPitchGrades:async()=>null}));
import { loadExitMeetingReport } from "@/lib/exit-meeting-server";
// Fictional identities only. The meeting handout is the only report format.
type Access=Parameters<typeof loadExitMeetingReport>[0];
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const athlete={id,athlete_code:"PAC-9999",first_name:"Fictional",preferred_name:null,last_name:"Boxer",athlete_seasons:[{season:"2026-27",jersey_number:0,player_type:"position"}]};
const query={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn()};
const staff=(roles:Access["roles"]=["coach"],preview:Access["preview"]=null)=>({roles,preview,supabase:{from:mocks.from,rpc:mocks.rpc},athleteId:null}) as unknown as Access;
beforeEach(()=>{
 vi.resetAllMocks();mocks.from.mockReturnValue(query);query.select.mockReturnValue(query);query.eq.mockReturnValue(query);query.maybeSingle.mockResolvedValue({data:athlete,error:null});
 mocks.performance.mockResolvedValue({measurements:[],batches:[],percentileOverrides:[]});mocks.games.mockResolvedValue([]);mocks.comparisons.mockResolvedValue([]);
});
it("denies Player and Player View before any player read",async()=>{
 for(const access of [staff(["player"]),staff(["admin"],{version:1,actorId:id,role:"player",athleteId:id,expiresAt:Date.now()+10000} as Access["preview"])])await expect(loadExitMeetingReport(access,id)).rejects.toThrow("coaches and admins");
 expect(mocks.from).not.toHaveBeenCalled();
});
it("builds the meeting handout for Coach, Admin and Coach View without contact details",async()=>{
 for(const access of [staff(["coach"]),staff(["admin"]),staff(["coach"],{version:1,actorId:id,role:"coach",athleteId:null,expiresAt:Date.now()+10000} as Access["preview"])]){const report=await loadExitMeetingReport(access,id);expect(report.format).toBe("meeting");expect(JSON.stringify(report)).not.toContain("pacific_email");}
 expect(query.select).toHaveBeenCalledWith("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons(*)");
});
it("rejects unknown or invalid player identities without broadening the query",async()=>{
 await expect(loadExitMeetingReport(staff(),"not-a-uuid")).rejects.toThrow("Choose a rostered player");expect(mocks.from).not.toHaveBeenCalled();
 query.maybeSingle.mockResolvedValue({data:null,error:null});await expect(loadExitMeetingReport(staff(),id)).rejects.toThrow("current roster");expect(query.eq).toHaveBeenCalledWith("id",id);expect(mocks.performance).not.toHaveBeenCalled();
});
it("fails rather than building a partial handout when a required reader fails",async()=>{
 mocks.games.mockRejectedValue(new Error("Private provider database or credential details"));
 await expect(loadExitMeetingReport(staff(),id)).rejects.toThrow();
});
