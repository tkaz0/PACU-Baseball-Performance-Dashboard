import { beforeEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const mock=vi.hoisted(()=>({guard:vi.fn(),rpc:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/auth",()=>({requireAdminMutation:mock.guard}));
vi.mock("@/lib/analytics-server",()=>({loadTopPerformersData:vi.fn()}));
vi.mock("next/navigation",()=>({usePathname:()=>"/admin/bws-team"}));
import { saveBwsTeamPlan } from "@/app/(workspace)/admin/bws-team/actions";
import { loadBwsTeamPlan } from "@/lib/bws-team-server";
import { emptyBwsPlan } from "@/lib/bws-team";
import { Sidebar } from "@/components/sidebar";
const req={requestId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",expectedRevision:0,document:emptyBwsPlan("Fictional Team")};
const plan={revision:1,document:req.document,updatedAt:"2026-10-13T20:00:00Z",lastRequestId:req.requestId};
beforeEach(()=>{vi.resetAllMocks();mock.guard.mockResolvedValue({supabase:{rpc:mock.rpc}});});
it("performs fresh administrator mutation checks before any database call",async()=>{
  mock.guard.mockRejectedValue(new Error("Preview or role denied"));await expect(saveBwsTeamPlan(req)).rejects.toThrow("denied");expect(mock.rpc).not.toHaveBeenCalled();
});
it("validates inputs and verified receipts instead of assuming success",async()=>{
  expect((await saveBwsTeamPlan({...req,expectedRevision:-1})).ok).toBe(false);expect(mock.rpc).not.toHaveBeenCalled();
  mock.rpc.mockResolvedValue({data:{requestId:req.requestId,savedRevision:1,plan},error:null});expect(await saveBwsTeamPlan(req)).toEqual({ok:true,plan});
  mock.rpc.mockResolvedValue({data:{requestId:req.requestId,savedRevision:1,plan:{...plan,document:{...req.document,name:"Different"}}},error:null});expect((await saveBwsTeamPlan(req)).ok).toBe(false);
  mock.rpc.mockResolvedValue({data:null,error:{code:"40001"}});expect(await saveBwsTeamPlan(req)).toMatchObject({ok:false,message:expect.stringContaining("another tab")});
});
it("blocks preview, coach and player readers before database access",async()=>{
  for(const access of [{roles:["coach"],preview:null},{roles:["player"],preview:null},{roles:["admin"],preview:{role:"coach"}}]){
    await expect(loadBwsTeamPlan({...access,supabase:{rpc:mock.rpc}} as unknown as Parameters<typeof loadBwsTeamPlan>[0])).rejects.toThrow("private administrator");
  }
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("shows BWS Team navigation only to administrators outside View as, and no Draft Board link",()=>{
  for(const roles of [["admin"],["coach"],["player"]] as ("admin"|"coach"|"player")[][]){
    for(const isPreview of [false,true]){const html=renderToStaticMarkup(createElement(Sidebar,{roles,athleteId:null,isPreview}));expect(html.includes('href="/admin/bws-team"')).toBe(roles.includes("admin")&&!isPreview);expect(html).not.toContain('href="/admin/draft-board"');}
  }
});
