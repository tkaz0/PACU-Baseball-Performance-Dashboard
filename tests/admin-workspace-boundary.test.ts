import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const userId = "11111111-1111-4111-8111-111111111111";
const fake = vi.hoisted(() => ({
  pathname: "/preview/import", state: { status: "checking", userId: null as string | null, pathname: null as string | null, importRole: null as "admin" | "coach" | null },
  effects: [] as (() => (() => void))[], check: vi.fn(), replace: vi.fn(),
}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: () => [fake.state, (state: typeof fake.state) => { fake.state = state; }],
  useEffect: (effect: () => (() => void)) => { fake.effects.push(effect); },
}));
vi.mock("next/navigation", () => ({ usePathname: () => fake.pathname }));
vi.mock("@/lib/local-workspace-access", () => ({ checkLocalWorkspaceAccess: fake.check }));
import { AdminWorkspaceBoundary } from "@/components/admin-workspace-boundary";
const html = (id = userId, importRole: "admin" | "coach" = "admin") => renderToStaticMarkup(AdminWorkspaceBoundary({ userId: id, importRole, children: createElement("div", null, "Private device data") }));
beforeEach(() => {
  vi.clearAllMocks(); fake.effects = []; fake.pathname = "/preview/import";
  fake.state = { status: "checking", userId: null, pathname: null, importRole: null };
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn(), setInterval: vi.fn(), clearInterval: vi.fn(), location: { replace: fake.replace } });
  vi.stubGlobal("document", { visibilityState: "visible", addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { vi.unstubAllGlobals(); });
describe("device data mounts only for a currently checked account and path", () => {
  it("omits local children before verification and after account or route changes", () => {
    expect(html()).not.toContain("Private device data");
    fake.state = { status: "allowed", userId, pathname: fake.pathname, importRole: "admin" };
    expect(html()).toContain("Private device data");
    expect(html(userId, "coach")).not.toContain("Private device data");
    expect(html("22222222-2222-4222-8222-222222222222")).not.toContain("Private device data");
    fake.pathname = "/preview/roster";
    expect(html()).not.toContain("Private device data");
  });
  it("removes local children when a fresh check detects session revocation", async () => {
    fake.state = { status: "allowed", userId, pathname: fake.pathname, importRole: "admin" };
    fake.check.mockResolvedValue({ allowed: false, destination: "/access-denied" });
    html(); const cleanup = fake.effects[0]();
    await vi.waitFor(() => expect(fake.state.status).toBe("unavailable"));
    expect(html()).not.toContain("Private device data");
    expect(fake.replace).toHaveBeenCalledWith("/access-denied");
    cleanup();
  });
  it("preserves the current import view during a successful periodic recheck", async () => {
    fake.state = { status: "allowed", userId, pathname: fake.pathname, importRole: "admin" };
    let resolve: (value: { allowed: true }) => void;
    fake.check.mockReturnValue(new Promise(done => { resolve = done; }));
    html(); const cleanup = fake.effects[0]();
    expect(html()).toContain("Private device data");
    resolve!({ allowed: true });
    await vi.waitFor(() => expect(fake.check).toHaveBeenCalledWith(userId, "admin"));
    expect(html()).toContain("Private device data");
    expect(fake.replace).not.toHaveBeenCalled();
    cleanup();
  });
});
