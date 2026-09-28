import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),rpc:vi.fn(),report:vi.fn(),pdf:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth",()=>({getAccess:mocks.access}));
vi.mock("@/lib/exit-meeting-server",()=>({loadExitMeetingReport:mocks.report,ExitMeetingError:class extends Error{constructor(message:string,public status:number){super(message);}}}));
vi.mock("@/lib/exit-meeting-pdf",()=>({createExitMeetingPdf:mocks.pdf}));
import { POST as save } from "@/app/(workspace)/exit-meetings/history/route";
import { POST as download } from "@/app/(workspace)/exit-meetings/history/download/route";
import { loadExitMeetingHistory, loadSavedExitMeeting, saveExitMeetingSnapshot } from "@/lib/exit-meeting-history-server";
import { fictionalHistoryAthlete as athleteId, fictionalHistoryRequest as requestId, fictionalHistorySnapshot as snapshotId, fictionalHistoryReport, fictionalSavedMeeting } from "./fixtures/exit-meeting-history";
type Access=Parameters<typeof loadSavedExitMeeting>[0];
const staff=(roles:Access["roles"]=["coach"],preview:Access["preview"]=null)=>({roles,preview,supabase:{rpc:mocks.rpc},athleteId:null}) as unknown as Access;
const command=()=>({athleteId,requestId,meetingDate:"2026-10-01",talkingPoints:"Fictional coach talking points",reviewed:true as const});
const origin="https://dashboard.example.com";
const req=(body:unknown=command(),headers:Record<string,string>={})=>new Request(`${origin}/exit-meetings/history`,{method:"POST",headers:{origin,"content-type":"application/json",...headers},body:typeof body==="string"?body:JSON.stringify(body)});
beforeEach(()=>{
 vi.resetAllMocks();mocks.access.mockResolvedValue({access:staff()});mocks.report.mockResolvedValue(fictionalHistoryReport());mocks.pdf.mockResolvedValue(new Uint8Array([37,80,68,70]));
 mocks.rpc.mockImplementation(async(name:string)=>({data:name==="staff_exit_meeting_attempt"?null:name==="staff_exit_meeting_history"?{items:[],hasMore:false}:fictionalSavedMeeting(),error:null}));
});
it("rechecks live authorization and denies signed-out, Player and Player View before any read or write",async()=>{
 for(const access of [null,staff(["player"]),staff(["admin"],{version:1,actorId:requestId,role:"player",athleteId,expiresAt:Date.now()+10000})]){
  mocks.access.mockResolvedValue({access});for(const handler of [save,download]){const response=await handler(req(handler===save?command():{athleteId,snapshotId}));expect([401,403]).toContain(response.status);expect(response.headers.get("cache-control")).toContain("no-store");}
 }
 expect(mocks.access).toHaveBeenCalledTimes(6);expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.report).not.toHaveBeenCalled();expect(mocks.pdf).not.toHaveBeenCalled();
});
it("builds and validates snapshots on the server and returns only the saved receipt to Admin/Coach/Coach View",async()=>{
 for(const access of [staff(["admin"]),staff(),staff(["coach"],{version:1,actorId:requestId,role:"coach",athleteId:null,expiresAt:Date.now()+10000})]){
  mocks.access.mockResolvedValue({access});const response=await save(req());expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");expect(await response.json()).toEqual({id:snapshotId,athleteId,meetingDate:"2026-10-01",createdAt:fictionalSavedMeeting().createdAt});expect(mocks.report).toHaveBeenLastCalledWith(access,athleteId,"meeting");
  expect(mocks.rpc).toHaveBeenLastCalledWith("staff_save_exit_meeting_snapshot",{p_request_id:requestId,p_athlete_id:athleteId,p_meeting_date:"2026-10-01",p_talking_points:"Fictional coach talking points",p_report:fictionalHistoryReport()});
 }
 expect(mocks.pdf).not.toHaveBeenCalled();
});
it("validates origin, body bounds, explicit review and option keys before sources or database calls",async()=>{
 for(const request of [req(undefined,{origin:"https://different.example.com"}),req({...command(),report:fictionalHistoryReport()}),req({...command(),reviewed:false}),req({...command(),talkingPoints:"x".repeat(1601)}),req({...command(),meetingDate:"2026-02-30"}),req("x".repeat(12001)),req(undefined,{"content-type":"text/plain"}),req("{bad-json")])expect([400,403,413]).toContain((await save(request)).status);
 expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.report).not.toHaveBeenCalled();
});
it("replays a verified immutable receipt after an uncertain save without rebuilding today's results",async()=>{
 mocks.rpc.mockResolvedValue({data:fictionalSavedMeeting(),error:null});mocks.report.mockResolvedValue({...fictionalHistoryReport(),sections:[]});
 expect((await save(req())).status).toBe(200);expect(mocks.rpc).toHaveBeenCalledTimes(1);expect(mocks.rpc).toHaveBeenCalledWith("staff_exit_meeting_attempt",{p_request_id:requestId});expect(mocks.report).not.toHaveBeenCalled();
 const conflict=await save(req({...command(),talkingPoints:"Different options"}));expect(conflict.status).toBe(409);expect(mocks.report).not.toHaveBeenCalled();
});
it("never retries an uncertain write blindly or returns private provider errors",async()=>{
 mocks.rpc.mockResolvedValue({data:null,error:{message:"Private provider secret"}});const lookup=await save(req());expect(lookup.status).toBe(503);expect(await lookup.text()).not.toContain("Private provider");expect(mocks.report).not.toHaveBeenCalled();
 mocks.rpc.mockImplementation(async(name:string)=>({data:null,error:name==="staff_exit_meeting_attempt"?null:{message:"Private provider secret"}}));const write=await save(req());expect(write.status).toBe(503);expect(await write.text()).toContain("Retry this same save");
});
it("does not write a partial or invalid server report when a source fails",async()=>{
 mocks.report.mockRejectedValue(new Error("PRIVATE source details"));const failed=await save(req());expect(failed.status).toBe(503);expect(await failed.text()).not.toContain("PRIVATE");expect(mocks.rpc.mock.calls.map(call=>call[0])).toEqual(["staff_exit_meeting_attempt"]);
 mocks.rpc.mockClear();mocks.report.mockResolvedValue({...fictionalHistoryReport(),email:"PRIVATE@example.com"});expect((await save(req())).status).toBe(503);expect(mocks.rpc.mock.calls.map(call=>call[0])).toEqual(["staff_exit_meeting_attempt"]);
});
it("downloads exactly the saved report/date/notes with no current source reads or caller replacement",async()=>{
 const response=await download(req({athleteId,snapshotId}));expect(response.status).toBe(200);expect(response.headers.get("content-type")).toBe("application/pdf");expect(response.headers.get("cache-control")).toContain("no-store");expect(response.headers.get("content-disposition")).toBe('attachment; filename="PACU-Saved-Meeting-PAC-9999-2026-10-01.pdf"');
 expect(mocks.rpc).toHaveBeenCalledWith("staff_exit_meeting_snapshot",{p_athlete_id:athleteId,p_snapshot_id:snapshotId});expect(mocks.pdf).toHaveBeenCalledWith(fictionalHistoryReport(),{meetingDate:"2026-10-01",talkingPoints:"Fictional coach talking points",format:"meeting"});expect(mocks.report).not.toHaveBeenCalled();
 mocks.rpc.mockClear();for(const extra of [{report:{}},{meetingDate:"2026-10-02"},{talkingPoints:"Different"},{format:"detailed"}])expect((await download(req({athleteId,snapshotId,...extra}))).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();
});
it("scopes history and snapshots and rejects corrupted or other-player database receipts",async()=>{
 const access=staff();await expect(loadExitMeetingHistory(access,athleteId)).resolves.toEqual({items:[],hasMore:false});
 mocks.rpc.mockResolvedValue({data:null,error:null});await expect(loadSavedExitMeeting(access,athleteId,snapshotId)).rejects.toMatchObject({status:404});
 mocks.rpc.mockResolvedValue({data:fictionalSavedMeeting({athleteId:requestId}),error:null});expect((await download(req({athleteId,snapshotId}))).status).toBe(503);expect(mocks.pdf).not.toHaveBeenCalled();
 const {report:unusedReport,talkingPoints:unusedNotes,...meta}=fictionalSavedMeeting();expect(unusedReport).toBeDefined();expect(unusedNotes).toBeDefined();
 for(const data of [{items:[meta,meta],hasMore:false},{items:Array(51).fill(meta),hasMore:true},{items:[],hasMore:false,notes:"private"}]){mocks.rpc.mockResolvedValue({data,error:null});await expect(loadExitMeetingHistory(access,athleteId)).rejects.toThrow();}
});
it("defends server helpers independently of routes",async()=>{
 const access=staff(["player"]);await expect(loadExitMeetingHistory(access,athleteId)).rejects.toMatchObject({status:403});await expect(loadSavedExitMeeting(access,athleteId,snapshotId)).rejects.toMatchObject({status:403});await expect(saveExitMeetingSnapshot(access,command())).rejects.toMatchObject({status:403});expect(mocks.rpc).not.toHaveBeenCalled();
});
