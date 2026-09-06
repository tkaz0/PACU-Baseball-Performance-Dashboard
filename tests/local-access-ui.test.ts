import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalView } from "@/lib/local-view";
import { localWorkspacePermissions, type ImportRole } from "@/lib/local-workspace-permissions";

const fake = vi.hoisted(() => ({ pathname: "/preview/import", workspace: {
  view: { role: "coach", athleteCode: null } as LocalView,
  canImport: true, canManage: false, canPreview: true, isPreview: true,
  ready: true, error: null, mode: "local", revision: 0, viewChoices: [], roster: [], measurements: [], batches: [],
  setView: vi.fn(),
} }));
vi.mock("@/components/local-workspace", () => ({ useLocalWorkspace: () => fake.workspace }));
vi.mock("next/navigation", () => ({ usePathname: () => fake.pathname, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement("a", { href, ...props }, children) }));
import { LocalViewBanner, LocalViewBoundary } from "@/components/local-access";
import { PreviewSidebar } from "@/components/preview-sidebar";
import { ImportCenter } from "@/components/import-center";

function view(role: LocalView["role"], importRole: ImportRole = "admin") {
  fake.workspace.view = { role, athleteCode: role === "player" ? "SYN-001" : null };
  Object.assign(fake.workspace, localWorkspacePermissions(importRole, fake.workspace.view));
}
beforeEach(() => { fake.pathname = "/preview/import"; view("coach"); });

describe("interactive local Coach view", () => {
  it.each(["admin", "coach"] as const)("offers measurement imports to an actual %s in Coach view without administration", actual => {
    view("coach", actual);
    const nav = renderToStaticMarkup(createElement(PreviewSidebar));
    expect(nav).toContain('href="/preview/import"');
    expect(nav).not.toContain('href="/preview/access"');
    expect(nav).not.toContain("My Overview");
    const importer = renderToStaticMarkup(createElement(ImportCenter));
    expect(importer).toContain("RENPHO report"); expect(importer).toContain("Other measurements");
    expect(importer).not.toContain("Roster spreadsheet"); expect(importer).not.toContain("Export backup");
    expect(importer).not.toContain("Restore backup"); expect(importer).not.toContain("Reset workspace");
    expect(renderToStaticMarkup(createElement(LocalViewBoundary, null, "Fictional importer content"))).toContain("Fictional importer content");
  });

  it("clearly labels Coach saves as real local updates and Player view as read-only", () => {
    const coach = renderToStaticMarkup(createElement(LocalViewBanner));
    expect(coach).toContain("Coach controls enabled"); expect(coach).toContain("Saves update this browser");
    expect(coach).not.toContain("Read-only");
    view("player");
    expect(renderToStaticMarkup(createElement(LocalViewBanner))).toContain("Read-only Player view");
  });

  it("hides import navigation and blocks the importer in Player view", () => {
    view("player");
    const nav = renderToStaticMarkup(createElement(PreviewSidebar));
    expect(nav).toContain('href="/preview/athletes/SYN-001"');
    expect(nav).not.toContain('href="/preview/import"'); expect(nav).not.toContain("My Overview");
    expect(renderToStaticMarkup(createElement(ImportCenter))).toContain("Switch from Player view to import information");
    expect(renderToStaticMarkup(createElement(LocalViewBoundary, null, "Fictional importer content"))).not.toContain("Fictional importer content");
  });

  it("does not reveal an import page merely because a stale display preference says Admin", () => {
    view("admin", "coach");
    expect(fake.workspace.canImport).toBe(false);
    expect(renderToStaticMarkup(createElement(LocalViewBoundary, null, "Fictional importer content"))).not.toContain("Fictional importer content");
  });

  it("keeps Access & Views outside Coach navigation and page content", () => {
    fake.pathname = "/preview/access";
    expect(renderToStaticMarkup(createElement(LocalViewBoundary, null, "Fictional administration content"))).not.toContain("Fictional administration content");
  });
});
