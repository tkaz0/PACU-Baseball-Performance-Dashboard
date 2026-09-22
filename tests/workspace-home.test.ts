import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/types";
import { workspaceHome, workspacePreviewQuery } from "@/lib/workspace-home";

const fake = vi.hoisted(() => ({ access: vi.fn(), from: vi.fn(), home: vi.fn(), leaderboards: vi.fn() }));
vi.mock("@/lib/home-server", () => ({loadHomeSummary: fake.home}));
vi.mock("@/lib/home-leaderboards-server", () => ({loadHomeLeaderboards: fake.leaderboards}));
vi.mock("@/lib/auth", () => ({ requireAccess: fake.access }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); }, usePathname: () => "/roster" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement("a", { href, ...props }, children) }));
import Overview from "@/app/(workspace)/overview/page";
import { Sidebar } from "@/components/sidebar";
import { AccessPreviewNotice } from "@/components/access-preview-notice";

const athleteId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const access = (roles: Role[], linked: string | null = athleteId, preview = false) => ({
  roles, athleteId: linked, actualRoles: preview ? ["admin"] : roles,
  preview: preview ? { role: roles[0], athleteId: linked } : null, supabase: { from: fake.from },
});
beforeEach(() => { vi.resetAllMocks(); fake.leaderboards.mockResolvedValue([]); });

describe("role-aware dashboard landing", () => {
  it.each(["admin","coach","player"] as Role[])("opens Home for %s while preserving presented scope",async role=>{
    const current=access([role],athleteId,role==="player");fake.access.mockResolvedValue(current);fake.home.mockResolvedValue(null);
    expect(workspaceHome(current)).toBe("/overview");
    const html=renderToStaticMarkup(await Overview({searchParams:Promise.resolve({})}));
    expect(fake.home).toHaveBeenCalledWith(current);expect(fake.leaderboards).toHaveBeenCalledWith(current);expect(html).toContain(role==="player"?"Your Baseball Home.":"The Team, at a Glance.");
    expect(html.includes('href="/imports"')).toBe(role!=="player");expect(fake.from).not.toHaveBeenCalled();
  });
  it("keeps the connection message for an unlinked player",async()=>{
    fake.access.mockResolvedValue(access(["player"],null));fake.home.mockResolvedValue(null);
    const html=renderToStaticMarkup(await Overview({searchParams:Promise.resolve({})}));
    expect(html).toContain("Your profile is being connected");expect(html).not.toContain('href="/roster"');
  });
  it.each(["/login","/access-denied","/access-preview-unavailable"])("preserves access denial to %s before reading data",async destination=>{
    fake.access.mockRejectedValue(new Error(`REDIRECT:${destination}`));
    await expect(Overview({searchParams:Promise.resolve({})})).rejects.toThrow(`REDIRECT:${destination}`);expect(fake.home).not.toHaveBeenCalled();expect(fake.leaderboards).not.toHaveBeenCalled();
  });
  it("shows the recognized preview notice on Home",async()=>{
    fake.access.mockResolvedValue(access(["player"],athleteId,true));fake.home.mockResolvedValue(null);
    const html=renderToStaticMarkup(await Overview({searchParams:Promise.resolve({preview:"read-only"})}));expect(html).toContain("No change was saved");
  });
  it.each([undefined,"anything","https://example.com"])("ignores unsupported preview query values: %s",value=>{expect(workspacePreviewQuery(value)).toBe("");});
});

describe("workspace navigation and preview notices", () => {
  it.each(["admin", "coach", "player"] as Role[])("keeps Game Stats and adds Home navigation for %s", role => {
    const html = renderToStaticMarkup(createElement(Sidebar, { roles: [role], athleteId }));
    expect(html).toContain('href="/overview"'); expect(html).toContain(">Home<");
    expect(html).toContain('href="/game-stats"'); expect(html).toContain('href="/leaderboards"');
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
  it("keeps Player view import navigation absent", () => {
    const html = renderToStaticMarkup(createElement(Sidebar, { roles: ["player"], athleteId, isPreview: true }));
    expect(html).not.toContain('href="/imports"'); expect(html).not.toContain('href="/testing/coverage"'); expect(html).not.toContain('href="/admin/access"');
  });
  it("only labels an actual preview as read-only", () => {
    expect(renderToStaticMarkup(createElement(AccessPreviewNotice, { status: "read-only", isPreview: false }))).toBe("");
    expect(renderToStaticMarkup(createElement(AccessPreviewNotice, { status: "read-only", isPreview: true }))).toContain("No change was saved");
    expect(renderToStaticMarkup(createElement(AccessPreviewNotice, { status: "invalid", isPreview: false }))).toContain("Your current view has not changed");
  });
});
