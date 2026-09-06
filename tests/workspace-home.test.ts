import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/types";
import { workspaceHome, workspacePreviewQuery } from "@/lib/workspace-home";

const fake = vi.hoisted(() => ({ access: vi.fn(), from: vi.fn() }));
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
beforeEach(() => { vi.resetAllMocks(); });

describe("workspace landing after retiring Team Overview", () => {
  it.each([
    { roles: ["admin"] as Role[], linked: null, preview: false, expected: "/roster" },
    { roles: ["coach"] as Role[], linked: null, preview: false, expected: "/roster" },
    { roles: ["coach"] as Role[], linked: null, preview: true, expected: "/roster" },
    { roles: ["admin", "player"] as Role[], linked: athleteId, preview: false, expected: "/roster" },
    { roles: ["player"] as Role[], linked: athleteId, preview: false, expected: `/athletes/${athleteId}` },
    { roles: ["player"] as Role[], linked: athleteId, preview: true, expected: `/athletes/${athleteId}` },
  ])("sends presented $roles to $expected (preview=$preview)", async ({ roles, linked, preview, expected }) => {
    const current = access(roles, linked, preview);
    expect(workspaceHome(current)).toBe(expected);
    fake.access.mockResolvedValueOnce(current);
    await expect(Overview({ searchParams: Promise.resolve({}) })).rejects.toThrow(`REDIRECT:${expected}`);
    expect(fake.from).not.toHaveBeenCalled();
  });
  it("keeps an unlinked player's connection message without redirecting in a loop or reading the roster", async () => {
    fake.access.mockResolvedValueOnce(access(["player"], null));
    expect(workspaceHome(access(["player"], null))).toBe("/overview");
    const html = renderToStaticMarkup(await Overview({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Your profile is being connected");
    expect(html).not.toContain("Team Overview"); expect(fake.from).not.toHaveBeenCalled();
  });
  it.each(["/login", "/access-denied", "/access-preview-unavailable"])("preserves a live access guard denial to %s", async destination => {
    fake.access.mockRejectedValueOnce(new Error(`REDIRECT:${destination}`));
    await expect(Overview({ searchParams: Promise.resolve({}) })).rejects.toThrow(`REDIRECT:${destination}`);
    expect(fake.from).not.toHaveBeenCalled();
  });
  it.each(["invalid", "read-only"])("forwards the recognized %s notice to the authorized destination", async preview => {
    fake.access.mockResolvedValueOnce(access(["coach"], null, true));
    await expect(Overview({ searchParams: Promise.resolve({ preview }) })).rejects.toThrow(`REDIRECT:/roster?preview=${preview}`);
  });
  it.each([undefined, "anything", "https://example.com", "read-only&redirect=https://example.com"])("does not reflect unsupported preview query values: %s", value => {
    expect(workspacePreviewQuery(value)).toBe("");
  });
});

describe("workspace navigation and preview notices", () => {
  it.each(["admin", "coach", "player"] as Role[])("keeps standalone Game Stats and removes the Overview navigation for %s", role => {
    const html = renderToStaticMarkup(createElement(Sidebar, { roles: [role], athleteId }));
    expect(html).not.toContain('href="/overview"'); expect(html).not.toContain(">Overview<");
    expect(html).toContain('href="/game-stats"'); expect(html).toContain('href="/leaderboards"');
    expect(html).toContain(`href="${role === "player" ? `/athletes/${athleteId}` : "/roster"}" class="sidebar-brand-link"`);
    expect(html.includes('href="/roster"')).toBe(role !== "player");
    expect(html.includes('href="/imports"')).toBe(role !== "player");
  });
  it("keeps import navigation absent from the read-only Coach preview", () => {
    const html = renderToStaticMarkup(createElement(Sidebar, { roles: ["coach"], athleteId: null, isPreview: true }));
    expect(html).not.toContain('href="/imports"'); expect(html).not.toContain('href="/admin/access"');
  });
  it("only labels an actual preview as read-only", () => {
    expect(renderToStaticMarkup(createElement(AccessPreviewNotice, { status: "read-only", isPreview: false }))).toBe("");
    expect(renderToStaticMarkup(createElement(AccessPreviewNotice, { status: "read-only", isPreview: true }))).toContain("No change was saved");
    expect(renderToStaticMarkup(createElement(AccessPreviewNotice, { status: "invalid", isPreview: false }))).toContain("Your current view has not changed");
  });
});
