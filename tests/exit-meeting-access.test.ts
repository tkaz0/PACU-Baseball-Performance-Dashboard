import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),load:vi.fn(),pdf:vi.fn(),from:vi.fn(),performance:vi.fn(),games:vi.fn(),comparisons:vi.fn(),movement:vi.fn(),contacts:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth",()=>({getAccess:mocks.access}));
vi.mock("@/lib/exit-meeting-pdf",()=>({createExitMeetingPdf:mocks.pdf}));
vi.mock("@/lib/performance-server",()=>({loadAthletePerformance:mocks.performance}));
vi.mock("@/lib/game-server",()=>({loadGameStats:mocks.games}));
vi.mock("@/lib/game-comparison-server",()=>({loadGameComparisons:mocks.comparisons}));
vi.mock("@/lib/movement-server",()=>({loadMovementScreening:mocks.movement}));
vi.mock("@/lib/full-swing-contacts-server",()=>({loadFullSwingContacts:mocks.contacts}));
import { POST } from "@/app/(workspace)/exit-meetings/download/route";
import { loadExitMeetingReport } from "@/lib/exit-meeting-server";
type Access=Parameters<typeof loadExitMeetingReport>[0];
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",origin="https://dashboard.example.com";
const athlete={id,athlete_code:"PAC-9999",first_name:"Fictional",preferred_name:null,last_name:"Boxer",athlete_seasons:[{season:"2026-27",jersey_number:0,player_type:"position"}]};
const query={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn()};
const staff=(roles:Access["roles"]=["coach"],preview:Access["preview"]=null)=>({roles,preview,supabase:{from:mocks.from},athleteId:null}) as unknown as Access;
const request=(body:unknown={athleteId:id,meetingDate:"2026-09-27",talkingPoints:"Review the Fall"},headers:Record<string,string>={})=>new Request(`${origin}/exit-meetings/download`,{method:"POST",headers:{origin,"content-type":"application/json",...headers},body:typeof body==="string"?body:JSON.stringify(body)});
beforeEach(()=>{
 vi.resetAllMocks();mocks.access.mockResolvedValue({access:staff()});mocks.from.mockReturnValue(query);query.select.mockReturnValue(query);query.eq.mockReturnValue(query);query.maybeSingle.mockResolvedValue({data:athlete,error:null});
 mocks.performance.mockResolvedValue({measurements:[],batches:[],percentileOverrides:[]});mocks.games.mockResolvedValue([]);mocks.comparisons.mockResolvedValue([]);mocks.movement.mockResolvedValue(null);mocks.contacts.mockResolvedValue([]);mocks.pdf.mockResolvedValue(new Uint8Array([37,80,68,70]));
});
it("rechecks the live session for every PDF request and denies signed-out, Player and Player View before any player read",async()=>{
 for(const access of [null,staff(["player"]),staff(["player"],{version:1,actorId:id,role:"player",athleteId:id,expiresAt:Date.now()+10000})]){mocks.access.mockResolvedValue({access});const response=await POST(request());expect([401,403]).toContain(response.status);expect(response.headers.get("cache-control")).toContain("no-store");}
 expect(mocks.access).toHaveBeenCalledTimes(3);expect(mocks.from).not.toHaveBeenCalled();expect(mocks.pdf).not.toHaveBeenCalled();
});
it("generates PDFs for a Coach, Admin, and interactive Coach View without granting or changing access",async()=>{
 for(const access of [staff(["coach"]),staff(["admin"]),staff(["coach"],{version:1,actorId:id,role:"coach",athleteId:null,expiresAt:Date.now()+10000})]){mocks.access.mockResolvedValue({access});const response=await POST(request());expect(response.status).toBe(200);expect(response.headers.get("content-type")).toBe("application/pdf");expect(response.headers.get("cache-control")).toContain("no-store");expect(response.headers.get("content-disposition")).toBe('attachment; filename="PACU-Exit-Meeting-PAC-9999-2026-09-27.pdf"');expect(mocks.performance).toHaveBeenLastCalledWith(access,athlete);expect(mocks.games).toHaveBeenLastCalledWith(access,id);}
 expect(query.select).toHaveBeenCalledWith("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons(*)");expect(mocks.pdf.mock.calls[0][0]).not.toHaveProperty("pacific_email");
});
it("blocks cross-site downloads, forged report data, oversized notes, and invalid dates before querying results",async()=>{
 for(const req of [request(undefined,{origin:"https://other.example.com"}),request({...JSON.parse(await request().text()),stats:[{value:100}]}),request({athleteId:id,meetingDate:"2026-02-30"}),request({athleteId:id,meetingDate:"2026-09-27",talkingPoints:"x".repeat(1601)}),request("x".repeat(13000)),request(undefined,{"content-type":"text/plain"})]){const response=await POST(req);expect([400,403,413]).toContain(response.status);}
 expect(mocks.from).not.toHaveBeenCalled();expect(mocks.pdf).not.toHaveBeenCalled();
});
it("rejects unknown or invalid player identities without broadening the query",async()=>{
 expect((await POST(request({athleteId:"not-a-uuid",meetingDate:"2026-09-27"}))).status).toBe(400);expect(mocks.from).not.toHaveBeenCalled();
 query.maybeSingle.mockResolvedValue({data:null,error:null});expect((await POST(request())).status).toBe(404);expect(query.eq).toHaveBeenCalledWith("id",id);expect(mocks.performance).not.toHaveBeenCalled();
});
it("does not issue partial PDFs when any source reader fails and never returns provider errors",async()=>{
 mocks.contacts.mockRejectedValue(new Error("Private provider database or credential details"));const response=await POST(request({athleteId:id,meetingDate:"2026-09-27",format:"detailed"}));expect(response.status).toBe(503);expect(await response.text()).not.toContain("credential");expect(mocks.pdf).not.toHaveBeenCalled();
});
it("defends the report reader even if another server entry point passes Player access",async()=>{
 await expect(loadExitMeetingReport(staff(["player"]),id)).rejects.toThrow("coaches and admins");expect(mocks.from).not.toHaveBeenCalled();
});

it("defaults to a compact download and allows only an explicit detailed format",async()=>{
 const compact=await POST(request());expect(compact.status).toBe(200);expect(mocks.pdf.mock.calls[0][0].format).toBe("meeting");expect(mocks.contacts).not.toHaveBeenCalled();expect(mocks.movement).not.toHaveBeenCalled();
 const detailed=await POST(request({athleteId:id,meetingDate:"2026-09-27",format:"detailed"}));expect(detailed.status).toBe(200);expect(mocks.pdf.mock.calls[1][0].format).toBe("detailed");expect(mocks.contacts).toHaveBeenCalledTimes(1);expect(mocks.movement).toHaveBeenCalledTimes(1);expect(detailed.headers.get("content-disposition")).toContain("PACU-Detailed-Report-");
 const calls=mocks.from.mock.calls.length;expect((await POST(request({athleteId:id,meetingDate:"2026-09-27",format:"raw-admin-export"}))).status).toBe(400);expect(mocks.from.mock.calls).toHaveLength(calls);
});
