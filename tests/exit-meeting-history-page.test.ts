import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const fake=vi.hoisted(()=>({access:vi.fn(),players:vi.fn(),current:vi.fn(),history:vi.fn(),saved:vi.fn(),push:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/render-access",()=>({requireRenderImportAccess:fake.access}));
vi.mock("@/lib/staff-athlete-search-server",()=>({loadStaffAthleteChoices:fake.players}));
vi.mock("@/lib/exit-meeting-server",()=>({loadExitMeetingReport:fake.current,ExitMeetingError:class extends Error{constructor(message:string,public status:number){super(message);}}}));
vi.mock("@/lib/exit-meeting-history-server",()=>({loadExitMeetingHistory:fake.history,loadSavedExitMeeting:fake.saved}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:fake.push}),notFound:()=>{throw new Error("NOT_FOUND");}}));
vi.mock("next/link",()=>({default:({href,children,prefetch:unusedPrefetch,...props}:{href:string;children:ReactNode;prefetch?:boolean})=>{void unusedPrefetch;return createElement("a",{href,...props},children);}}));
import Page from "@/app/(workspace)/exit-meetings/page";
import { fictionalHistoryAthlete as athlete, fictionalHistorySnapshot as meeting, fictionalHistoryReport, fictionalSavedMeeting } from "./fixtures/exit-meeting-history";
const access={roles:["coach"]};
beforeEach(()=>{vi.resetAllMocks();fake.access.mockResolvedValue(access);fake.players.mockResolvedValue([{id:athlete,name:"Fictional Player",athleteCode:"PAC-9999",searchName:"Fictional Player"}]);fake.current.mockResolvedValue(fictionalHistoryReport());fake.history.mockResolvedValue({items:[],hasMore:false});fake.saved.mockResolvedValue(fictionalSavedMeeting());});
it("requires staff before listing identities or either report source",async()=>{
 fake.access.mockRejectedValue(new Error("REDIRECT:/access-denied"));await expect(Page({searchParams:Promise.resolve({athlete})})).rejects.toThrow("REDIRECT");expect(fake.players).not.toHaveBeenCalled();expect(fake.current).not.toHaveBeenCalled();expect(fake.saved).not.toHaveBeenCalled();expect(fake.history).not.toHaveBeenCalled();
});
it("shows explicit unsaved meeting controls and an honest empty history without creating a meeting",async()=>{
 const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({athlete})}));expect(fake.current).toHaveBeenCalledWith(access,athlete,"meeting");expect(fake.history).toHaveBeenCalledWith(access,athlete);expect(fake.saved).not.toHaveBeenCalled();
 expect(html).toContain("No saved meetings yet");expect(html).toContain("Save a permanent snapshot for coaches and admins");expect(html).toMatch(/disabled=""[^>]*>[^<]*<svg[^]*?Save Snapshot/);expect(html).not.toContain("checked=\"\"");expect(fake.push).not.toHaveBeenCalled();
});
it("opens exact historical data with readonly options without reading current performance",async()=>{
 const stored=fictionalSavedMeeting();const {report:unusedReport,talkingPoints:unusedNotes,...meta}=stored;void unusedReport;void unusedNotes;fake.history.mockResolvedValue({items:[meta],hasMore:false});
 const element=await Page({searchParams:Promise.resolve({athlete,meeting,format:"detailed"})}),html=renderToStaticMarkup(element);
 expect(element.key).toBe(`${athlete}:${meeting}`);expect(fake.current).not.toHaveBeenCalled();expect(fake.saved).toHaveBeenCalledWith(access,athlete,meeting);expect(html).toContain("Download Saved PDF");expect(html).toContain("Fictional coach talking points");expect(html).toContain("These results and notes do not change");expect(html).toContain('value="2026-10-01"');expect(html).toContain('aria-current="page"');expect(html).not.toContain("Save Meeting Snapshot");expect(html).not.toContain("Download Detailed PDF");
});
it("does not confuse a saved meeting with the current draft and rejects incomplete saved URLs",async()=>{
 const current=await Page({searchParams:Promise.resolve({athlete})});const detailed=await Page({searchParams:Promise.resolve({athlete,format:"detailed"})});expect(current.key).toBe(`${athlete}:current`);expect(detailed.key).toBe(current.key);
 await expect(Page({searchParams:Promise.resolve({meeting})})).rejects.toThrow("NOT_FOUND");
});
