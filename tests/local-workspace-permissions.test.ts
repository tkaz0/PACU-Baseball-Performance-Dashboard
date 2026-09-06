import { describe, expect, it } from "vitest";
import { localWorkspacePermissions } from "@/lib/local-workspace-permissions";
import { canImportPresentedAccess, resolveAccessPreview } from "@/lib/access-preview";
import type { Role } from "@/lib/types";

describe("actual staff permissions are independent from an administrator's local preview", () => {
  it.each([
    { actual: "admin" as const, view: "admin" as const, manage: true, imports: true, preview: false },
    { actual: "admin" as const, view: "coach" as const, manage: false, imports: false, preview: true },
    { actual: "admin" as const, view: "player" as const, manage: false, imports: false, preview: true },
    { actual: "coach" as const, view: "coach" as const, manage: false, imports: true, preview: false },
    { actual: "coach" as const, view: "admin" as const, manage: false, imports: false, preview: false },
    { actual: "coach" as const, view: "player" as const, manage: false, imports: false, preview: false },
  ])("$actual in $view view", ({ actual, view, manage, imports, preview }) => {
    expect(localWorkspacePermissions(actual, { role: view, athleteCode: null })).toEqual({ canManage: manage, canImport: imports, canPreview: actual === "admin", isPreview: preview });
  });
  it.each([
    { roles: ["admin"], imports: true }, { roles: ["coach"], imports: true },
    { roles: ["coach", "player"], imports: true }, { roles: ["player"], imports: false }, { roles: [], imports: false },
  ])("shared information imports use trusted $roles", ({ roles, imports }) => {
    const access = resolveAccessPreview({ userId: "11111111-1111-4111-8111-111111111111", roles: roles as Role[], athleteId: null }, undefined)!;
    expect(canImportPresentedAccess(access)).toBe(imports);
  });
  it("never imports during either valid administrator role preview", () => {
    const actor = { userId: "11111111-1111-4111-8111-111111111111", roles: ["admin"] as Role[], athleteId: null };
    for (const role of ["coach", "player"] as const) {
      const access = resolveAccessPreview(actor, JSON.stringify({ version: 1, actorId: actor.userId, role,
        athleteId: role === "player" ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" : null, expiresAt: Date.now() + 10000 }))!;
      expect(canImportPresentedAccess(access)).toBe(false);
    }
  });
});
