import { beforeEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const mock=vi.hoisted(()=>({guard:vi.fn(),rpc:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/auth",()=>({requireAdminMutation:mock.guard}));
vi.mock("next/navigation",()=>({usePathname:()=>"/admin/draft-board"}));
import { saveBoxerDraft } from "@/app/(workspace)/admin/draft-board/actions";
import { loadDraftBoard } from "@/lib/draft-board-server";
import { emptyDraft } from "@/lib/draft-board";
import { Sidebar } from "@/components/sidebar";
const req={requestId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",expectedRevision:0,document:emptyDraft()};
const board={revision:1,document:req.document,updatedAt:"2026-10-08T20:00:00Z",lastRequestId:req.requestId};
beforeEach(()=>{vi.resetAllMocks();mock.guard.mockResolvedValue({supabase:{rpc:mock.rpc}});});
it("performs fresh administrator mutation checks before any database call",async()=>{
  mock.guard.mockRejectedValue(new Error("Preview or role denied"));await expect(saveBoxerDraft(req)).rejects.toThrow("denied");expect(mock.rpc).not.toHaveBeenCalled();
});
it("validates inputs and verified receipts instead of assuming success",async()=>{
  expect((await saveBoxerDraft({...req,expectedRevision:-1})).ok).toBe(false);expect(mock.rpc).not.toHaveBeenCalled();
  mock.rpc.mockResolvedValue({data:{requestId:req.requestId,savedRevision:1,board},error:null});expect(await saveBoxerDraft(req)).toEqual({ok:true,board});
  mock.rpc.mockResolvedValue({data:{requestId:req.requestId,savedRevision:1,board:{...board,document:{...req.document,title:"Different"}}},error:null});expect((await saveBoxerDraft(req)).ok).toBe(false);
  mock.rpc.mockResolvedValue({data:null,error:{code:"40001"}});expect(await saveBoxerDraft(req)).toMatchObject({ok:false,message:expect.stringContaining("another tab")});
});
it("blocks preview, coach and player readers before database access",async()=>{
  for(const access of [{roles:["coach"],preview:null},{roles:["player"],preview:null},{roles:["admin"],preview:{role:"coach"}}]){
    await expect(loadDraftBoard({...access,supabase:{rpc:mock.rpc}} as unknown as Parameters<typeof loadDraftBoard>[0])).rejects.toThrow("private administrator");
  }
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("shows Draft Board navigation only outside administrator View as",()=>{
  for(const roles of [["admin"],["coach"],["player"]] as ("admin"|"coach"|"player")[][]){
    for(const isPreview of [false,true]){const html=renderToStaticMarkup(createElement(Sidebar,{roles,athleteId:null,isPreview}));expect(html.includes('href="/admin/draft-board"')).toBe(roles.includes("admin")&&!isPreview);}
  }
});
