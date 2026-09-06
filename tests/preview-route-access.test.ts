import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ access: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdminWorkspaceAccess: fake.access, requireImportAccess: fake.access }));
vi.mock("@/app/auth/actions", () => ({ logout: vi.fn() }));
vi.mock("@/components/local-dashboard", () => ({ LocalOverview: () => null, LocalRoster: () => null, LocalAthleteProfile: () => null }));
vi.mock("@/components/local-access", () => ({ LocalAccessPage: () => null, LocalViewBanner: () => null, LocalViewBoundary: () => null, LocalViewControl: () => null }));
vi.mock("@/components/local-workspace", () => ({ LocalWorkspaceProvider: () => null, WorkspaceBanner: () => null }));
vi.mock("@/components/preview-sidebar", () => ({ PreviewSidebar: () => null }));
vi.mock("@/components/admin-workspace-boundary", () => ({ AdminWorkspaceBoundary: () => null }));
vi.mock("@/components/import-center", () => ({ ImportCenter: () => null }));

import Layout from "@/app/preview/layout";
import Overview from "@/app/preview/page";
import Roster from "@/app/preview/roster/page";
import Profile from "@/app/preview/athletes/[id]/page";
import Imports from "@/app/preview/import/page";
import Access from "@/app/preview/access/page";

const routes = [
  ["layout", () => Layout({ children: null })], ["overview", () => Overview()],
  ["roster", () => Roster({ searchParams: Promise.resolve({}) })],
  ["profile", () => Profile({ params: Promise.resolve({ id: "SYN-001" }) })],
  ["imports", () => Imports()], ["access", () => Access()],
] as const;
beforeEach(() => { vi.clearAllMocks(); fake.access.mockResolvedValue({ roles: ["admin"], user: { id: "11111111-1111-4111-8111-111111111111" } }); });
describe("every browser workspace server entry point", () => {
  it.each(routes)("checks current authorized access before rendering %s", async (_name, run) => {
    expect(await run()).toBeTruthy();
    expect(fake.access).toHaveBeenCalledOnce();
  });
  it.each(routes)("does not render %s when the current session fails authorization", async (_name, run) => {
    fake.access.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(run()).rejects.toThrow("REDIRECT:/login");
  });
});
