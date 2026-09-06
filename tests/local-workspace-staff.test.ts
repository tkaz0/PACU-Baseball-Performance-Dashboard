import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalView } from "@/lib/local-view";
const fake = vi.hoisted(() => ({ stateIndex: 0, refIndex: 0, view: { role: "coach", athleteCode: null } as LocalView, write: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = fake.stateIndex++; const value = index === 0 ? (initial as () => unknown)() : index === 1 ? true : index === 2 ? null : fake.view;
    return [value, vi.fn()];
  },
  useRef: () => ({ current: fake.refIndex++ === 0 ? fake.view : null }), useEffect: () => {},
}));
vi.mock("@/lib/local-workspace", async original => ({ ...await original<typeof import("@/lib/local-workspace")>(), writeWorkspace: fake.write }));
import { LocalWorkspaceProvider, type useLocalWorkspace } from "@/components/local-workspace";
import type { ImportBatch } from "@/lib/local-workspace";
const batch: ImportBatch = { id: "fictional-batch", kind: "measurements", fileName: "fictional.csv", source: "Fictional protocol", importedAt: "2026-09-12T00:00:00Z", created: 0, updated: 0, unchanged: 0 };
function context(importRole: "admin" | "coach", view: LocalView = { role: importRole, athleteCode: null }) {
  fake.stateIndex = 0; fake.refIndex = 0; fake.view = view;
  const element = LocalWorkspaceProvider({ importRole, children: null }) as ReactElement<{ value: ReturnType<typeof useLocalWorkspace> }>;
  return element.props.value;
}
beforeEach(() => { vi.clearAllMocks(); fake.write.mockImplementation(async data => data); });
describe("browser-local staff mutation boundary", () => {
  it("lets an actual Coach save measurement batches without roster/account/backup controls", async () => {
    const workspace = context("coach");
    expect(workspace.canImport).toBe(true); expect(workspace.canManage).toBe(false); expect(workspace.canPreview).toBe(false); expect(workspace.isPreview).toBe(false);
    await workspace.applyMeasurements([], batch, workspace.revision);
    expect(fake.write).toHaveBeenCalledOnce();
    expect(fake.write.mock.calls[0][0].batches).toEqual([batch]);
    expect(fake.write.mock.calls[0][0].roster).toEqual(workspace.roster);
  });
  it("rejects direct Coach calls to roster, restore, reset, export and role preview handlers", async () => {
    const workspace = context("coach");
    await expect(workspace.applyRoster([], { ...batch, kind: "roster" }, workspace.revision)).rejects.toThrow("administrator");
    await expect(workspace.restoreBackup("{}")).rejects.toThrow("administrator");
    await expect(workspace.resetWorkspace()).rejects.toThrow("administrator");
    expect(() => workspace.exportBackup()).toThrow("administrator"); expect(() => workspace.exportRoster("2026-27")).toThrow("administrator");
    expect(() => workspace.setView({ role: "admin", athleteCode: null })).toThrow("Only administrators");
    expect(fake.write).not.toHaveBeenCalled();
  });
  it.each(["coach", "player"] as const)("blocks an actual Admin's read-only %s preview from importing", async role => {
    const workspace = context("admin", { role, athleteCode: null });
    expect(workspace.isPreview).toBe(true); expect(workspace.canImport).toBe(false);
    await expect(workspace.applyMeasurements([], batch, workspace.revision)).rejects.toThrow("outside preview");
    expect(fake.write).not.toHaveBeenCalled();
  });
  it("cannot use a stale or forged Admin view to grant a real Coach management rights", async () => {
    const workspace = context("coach", { role: "admin", athleteCode: null });
    expect(workspace.canManage).toBe(false); expect(workspace.canImport).toBe(false);
    await expect(workspace.applyMeasurements([], batch, workspace.revision)).rejects.toThrow("outside preview");
    expect(fake.write).not.toHaveBeenCalled();
  });
});
