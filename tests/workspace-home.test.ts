import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/types";
import { workspaceHome, workspacePreviewQuery } from "@/lib/workspace-home";
import { buildHomeSummary } from "@/lib/home-summary";

const fake = vi.hoisted(() => ({ access: vi.fn(), from: vi.fn(), rpc:vi.fn(), home: vi.fn(), leaderboards: vi.fn(), due: vi.fn(), status: vi.fn(), navigation: vi.fn() }));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/design-navigation-server", () => ({ loadDesignNavigation: fake.navigation }));
vi.mock("@/lib/home-server", () => ({loadHomeSummary: fake.home}));
vi.mock("@/lib/home-leaderboards-server", () => ({loadHomeLeaderboards: fake.leaderboards}));
vi.mock("@/lib/coach-focus-server", () => ({loadDueCoachFocus: fake.due}));
vi.mock("@/lib/weekly-source-checks", () => ({loadWeeklySourceStatus: fake.status}));
vi.mock("@/lib/render-access", () => ({ requireRenderAccess: fake.access }));
vi.mock("@/lib/personal-dashboard-server", () => ({ loadDashboardVisit: async () => ({ since: null, viewedAt: "2026-09-27T12:00:00Z", record: false }) }));
vi.mock("@/app/(workspace)/overview/visit-actions", () => ({ recordDashboardVisit: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); }, usePathname: () => "/roster",useRouter:()=>({refresh:vi.fn()}) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement("a", { href, ...props }, children) }));
import Overview from "@/app/(workspace)/overview/page";
import { Sidebar } from "@/components/sidebar";
import { AccessPreviewNotice } from "@/components/access-preview-notice";

const athleteId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const access = (roles: Role[], linked: string | null = athleteId, preview = false) => ({
  roles, athleteId: linked, actualRoles: preview ? ["admin"] : roles,
  preview: preview ? { role: roles[0], athleteId: linked } : null, supabase: { from: fake.from,rpc:fake.rpc },
});
beforeEach(() => { vi.resetAllMocks();fake.rpc.mockResolvedValue({data:[],error:null}); fake.leaderboards.mockResolvedValue([]); fake.due.mockResolvedValue([]); fake.status.mockResolvedValue([]); fake.navigation.mockResolvedValue({ swing: true, pitch: false }); });

describe("role-aware dashboard landing", () => {
  it.each(["admin","coach","player"] as Role[])("opens Home for %s while preserving presented scope",async role=>{
    const current=access([role],athleteId,role==="player");fake.access.mockResolvedValue(current);fake.home.mockResolvedValue(buildHomeSummary([],[],[],"2026-09-29"));
    expect(workspaceHome(current)).toBe("/overview");
    const html=renderToStaticMarkup(await Overview({searchParams:Promise.resolve({})}));
    expect(fake.home).toHaveBeenCalledWith(current,{since:null,viewedAt:"2026-09-27T12:00:00Z",record:false});expect(fake.leaderboards).toHaveBeenCalledWith(current);expect(html).toContain(role==="player"?"My Dashboard":"Team Dashboard");
    expect(fake.navigation).toHaveBeenCalledWith(current);
    expect(fake.due).toHaveBeenCalledTimes(role==="player"?0:1);
    expect(fake.status).toHaveBeenCalledTimes(role==="player"?0:1);
    if(role==="player")expect(fake.rpc).toHaveBeenCalledExactlyOnceWith("athlete_development_plans",{p_athlete_id:athleteId});else expect(fake.rpc).not.toHaveBeenCalled();
    expect(html.includes('href="/imports"')).toBe(role!=="player");expect(html).toContain('href="/swing-design"');expect(html.includes('href="/pitch-design"')).toBe(role!=="player");expect(fake.from).not.toHaveBeenCalled();
  });
  it("keeps the connection message for an unlinked player",async()=>{
    fake.access.mockResolvedValue(access(["player"],null));fake.home.mockResolvedValue(null);
    const html=renderToStaticMarkup(await Overview({searchParams:Promise.resolve({})}));
    expect(html).toContain("Your profile is being connected");expect(html).not.toContain('href="/roster"');
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each(["/login","/access-denied","/access-preview-unavailable"])("preserves access denial to %s before reading data",async destination=>{
    fake.access.mockRejectedValue(new Error(`REDIRECT:${destination}`));
    await expect(Overview({searchParams:Promise.resolve({})})).rejects.toThrow(`REDIRECT:${destination}`);expect(fake.home).not.toHaveBeenCalled();expect(fake.leaderboards).not.toHaveBeenCalled();expect(fake.navigation).not.toHaveBeenCalled();expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("shows the recognized preview notice on Home",async()=>{
    fake.access.mockResolvedValue(access(["player"],athleteId,true));fake.home.mockResolvedValue(null);
    const html=renderToStaticMarkup(await Overview({searchParams:Promise.resolve({preview:"read-only"})}));expect(html).toContain("No change was saved");
  });
  it.each([undefined,"anything","https://example.com"])("ignores unsupported preview query values: %s",value=>{expect(workspacePreviewQuery(value)).toBe("");});
  it.each([false,true])("shows only the own shared weekly plan on Player Home and limits completion to actual players (preview=%s)",async preview=>{
    fake.access.mockResolvedValue(access(["player"],athleteId,preview));fake.home.mockResolvedValue(buildHomeSummary([],[],[],"2026-09-30"));
    const plan={id:"11111111-1111-4111-8111-111111111111",athleteId,weekStart:"2026-09-28",focus:"Fictional shared weekly plan",drills:[{id:"33333333-3333-4333-8333-333333333333",title:"Fictional drill",cue:"Fictional shared cue",completedAt:null}],staffNote:"Fictional hidden staff note",shared:true,archived:false,revision:1,createdAt:"2026-09-29T00:00:00Z",updatedAt:"2026-09-29T00:00:00Z"};
    fake.rpc.mockResolvedValue({data:[plan,{...plan,id:"22222222-2222-4222-8222-222222222222",weekStart:"2026-10-05",focus:"Fictional hidden staff plan",shared:false}],error:null});
    const html=renderToStaticMarkup(await Overview({searchParams:Promise.resolve({})}));
    expect(fake.rpc).toHaveBeenCalledExactlyOnceWith("athlete_development_plans",{p_athlete_id:athleteId});expect(html).toContain(plan.focus);expect(html).toContain(plan.drills[0].cue);
    for(const hidden of [plan.staffNote,"Fictional hidden staff plan","Add Weekly Plan","Edit Weekly Plan"])expect(html).not.toContain(hidden);
    expect(html.includes('aria-label="Complete Fictional drill"')).toBe(!preview);expect(fake.from).not.toHaveBeenCalled();
  });
  it("keeps Home available when its optional weekly plan reader fails",async()=>{
    fake.access.mockResolvedValue(access(["player"]));fake.home.mockResolvedValue(buildHomeSummary([],[],[],"2026-09-30"));fake.rpc.mockResolvedValue({data:null,error:{code:"FICTITIOUS_ERROR"}});
    const html=renderToStaticMarkup(await Overview({searchParams:Promise.resolve({})}));expect(html).toContain("My Dashboard");expect(html).toContain("My Profile");expect(html).not.toContain("FICTITIOUS_ERROR");expect(html).not.toContain('aria-label="Weekly development plans"');
  });
});

describe("workspace navigation and preview notices", () => {
  it.each(["admin", "coach", "player"] as Role[])("keeps Game Stats and adds Home navigation for %s", role => {
    const html = renderToStaticMarkup(createElement(Sidebar, { roles: [role], athleteId, designNavigation: { swing: true, pitch: false } }));
    expect(html).toContain('href="/overview"'); expect(html).toContain(">Home<");
    expect(html).toContain('href="/game-stats"'); expect(html).toContain('href="/leaderboards"');
    expect(html).toContain('href="/swing-design"');
    expect(html).toContain('href="/" class="sidebar-brand-link"');
    expect(html.includes('href="/roster"')).toBe(role !== "player");
    expect(html.includes('href="/imports"')).toBe(role !== "player");
    expect(html.includes('href="/testing/coverage"')).toBe(role !== "player");
  });
  it("shows Coach imports in Coach view while keeping Admin management absent", () => {
    const html = renderToStaticMarkup(createElement(Sidebar, { roles: ["coach"], athleteId: null, isPreview: true }));
    expect(html).toContain('href="/imports"'); expect(html).toContain('href="/testing/coverage"'); expect(html).not.toContain('href="/admin/access"');
    expect(html).not.toContain('href="/admin/rollout"');
  });
  it("keeps secondary staff links available in a compact disclosure", () => {
    const html = renderToStaticMarkup(createElement(Sidebar, { roles: ["admin"], athleteId: null }));
    expect(html).toContain('<summary>More Staff Tools');
    expect(html).toContain('href="/testing/changes"');
    expect(html).toContain('href="/testing/coverage"');
    expect(html).toContain('<summary>Administration');
    expect(html).toContain('href="/admin/access"');
  });
  it("keeps Player view import navigation absent", () => {
    const html = renderToStaticMarkup(createElement(Sidebar, { roles: ["player"], athleteId, isPreview: true }));
    expect(html).not.toContain('href="/imports"'); expect(html).not.toContain('href="/testing/coverage"'); expect(html).not.toContain('href="/admin/access"');
  });
  it.each([false, true])("keeps Swing Design own-player navigation in Player View (preview=%s)", isPreview => {
    const linked = renderToStaticMarkup(createElement(Sidebar, { roles: ["player"], athleteId, isPreview, designNavigation: { swing: true, pitch: false } }));
    expect(linked).toContain('href="/swing-design"');
    expect(linked).not.toContain('href="/roster"');
    const unlinked = renderToStaticMarkup(createElement(Sidebar, { roles: ["player"], athleteId: null, isPreview }));
    expect(unlinked).not.toContain('href="/swing-design"');
  });
  it.each(["admin", "coach"] as Role[])("keeps both design tools available to %s without a player link", role => {
    const html = renderToStaticMarkup(createElement(Sidebar, { roles: [role], athleteId: null, isPreview: role === "coach" }));
    expect(html).toContain('href="/swing-design"'); expect(html).toContain('href="/pitch-design"');
  });
  it.each([
    { label: "hitter", navigation: { swing: true, pitch: false } },
    { label: "pitcher", navigation: { swing: false, pitch: true } },
    { label: "two-way", navigation: { swing: true, pitch: true } },
    { label: "unknown", navigation: undefined },
  ])("keeps Home and Sidebar design links aligned for $label in Player View", async ({ navigation }) => {
    fake.access.mockResolvedValue(access(["player"], athleteId, true));
    fake.navigation.mockResolvedValue(navigation);
    fake.home.mockResolvedValue(buildHomeSummary([], [], [], "2026-09-29"));
    const sidebar = renderToStaticMarkup(createElement(Sidebar, { roles: ["player"], athleteId, isPreview: true, designNavigation: navigation }));
    const home = renderToStaticMarkup(await Overview({ searchParams: Promise.resolve({}) }));
    for (const html of [sidebar, home]) {
      expect(html.includes('href="/swing-design"')).toBe(!!navigation?.swing);
      expect(html.includes('href="/pitch-design"')).toBe(!!navigation?.pitch);
      expect(html).not.toContain('href="/roster"');
    }
  });
  it("ignores stale design flags when a player is no longer linked", () => {
    const html = renderToStaticMarkup(createElement(Sidebar, { roles: ["player"], athleteId: null, designNavigation: { swing: true, pitch: true } }));
    expect(html).not.toContain('href="/swing-design"'); expect(html).not.toContain('href="/pitch-design"');
  });
  it("only labels an actual preview as read-only", () => {
    expect(renderToStaticMarkup(createElement(AccessPreviewNotice, { status: "read-only", isPreview: false }))).toBe("");
    expect(renderToStaticMarkup(createElement(AccessPreviewNotice, { status: "read-only", isPreview: true }))).toContain("No change was saved");
    expect(renderToStaticMarkup(createElement(AccessPreviewNotice, { status: "invalid", isPreview: false }))).toContain("Your current view has not changed");
  });
});
