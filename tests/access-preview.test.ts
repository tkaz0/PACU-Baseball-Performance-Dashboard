import { describe, expect, it } from "vitest";
import { ACCESS_PREVIEW_SECONDS, canMutatePresentedAccess, canReadPresentedAthlete, resolveAccessPreview, type AccessActor, type AccessPreview } from "@/lib/access-preview";
import type { Role } from "@/lib/types";

const actorId = "11111111-1111-4111-8111-111111111111";
const athleteA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const athleteB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const now = 1_800_000_000_000;
const actor = (roles: Role[], athleteId: string | null = athleteA): AccessActor => ({ userId: actorId, roles, athleteId });
const cookie = (changes: Partial<AccessPreview> = {}) => JSON.stringify({ version: 1, actorId, role: "player", athleteId: athleteA, expiresAt: now + ACCESS_PREVIEW_SECONDS * 1000, ...changes });

describe("access preview independent role matrix", () => {
  it.each([
    { roles: ["admin"] as Role[], linked: null, readsA: true, readsB: true, writes: true },
    { roles: ["coach"] as Role[], linked: null, readsA: true, readsB: true, writes: false },
    { roles: ["player"] as Role[], linked: athleteA, readsA: true, readsB: false, writes: false },
    { roles: ["player"] as Role[], linked: null, readsA: false, readsB: false, writes: false },
    { roles: ["admin", "player"] as Role[], linked: athleteA, readsA: true, readsB: true, writes: true },
  ])("preserves actual $roles access with link $linked", ({ roles, linked, readsA, readsB, writes }) => {
    const access = resolveAccessPreview(actor(roles, linked), undefined, now)!;
    expect(canReadPresentedAthlete(access, athleteA)).toBe(readsA);
    expect(canReadPresentedAthlete(access, athleteB)).toBe(readsB);
    expect(canMutatePresentedAccess(access)).toBe(writes);
    expect(access.preview).toBeNull();
  });
  it("restricts Admin + Player to exactly the selected athlete without changing the actor", () => {
    const original = actor(["admin", "player"]);
    const access = resolveAccessPreview(original, cookie({ athleteId: athleteB }), now)!;
    expect(access.roles).toEqual(["player"]);
    expect(access.athleteId).toBe(athleteB);
    expect(canReadPresentedAthlete(access, athleteA)).toBe(false);
    expect(canReadPresentedAthlete(access, athleteB)).toBe(true);
    expect(canMutatePresentedAccess(access)).toBe(false);
    expect(original).toEqual(actor(["admin", "player"]));
  });
  it("allows coach roster display but no writes in coach preview", () => {
    const access = resolveAccessPreview(actor(["admin"]), cookie({ role: "coach", athleteId: null }), now)!;
    expect(access.roles).toEqual(["coach"]);
    expect(canReadPresentedAthlete(access, athleteA)).toBe(true);
    expect(canReadPresentedAthlete(access, athleteB)).toBe(true);
    expect(canMutatePresentedAccess(access)).toBe(false);
  });
  it.each([{ roles: ["coach"] as Role[] }, { roles: ["player"] as Role[] }, { roles: [] as Role[] }])("a cookie cannot confer preview or admin rights to $roles", ({ roles }) => {
    expect(resolveAccessPreview(actor(roles), cookie(), now)).toBeNull();
  });
  it("rejects wrong actor, invalid athlete, coach athlete, extra fields, expired or excessive lifetime", () => {
    for (const raw of [cookie({ actorId: athleteB }), cookie({ athleteId: "LOCAL-0001" }), cookie({ role: "coach" }), cookie({ expiresAt: now }), cookie({ expiresAt: now - 1 }), cookie({ expiresAt: now + ACCESS_PREVIEW_SECONDS * 1000 + 1 }), cookie({ expiresAt: NaN }), JSON.stringify({ ...JSON.parse(cookie()), admin: true }), JSON.stringify({ ...JSON.parse(cookie()), role: "admin" })]) {
      expect(resolveAccessPreview(actor(["admin"]), raw, now)).toBeNull();
    }
  });
  it("fails closed for malformed, empty, oversized and non-object cookie content", () => {
    for (const raw of ["", "{", "null", "[]", '"coach"', "x".repeat(501)]) expect(resolveAccessPreview(actor(["admin"]), raw, now)).toBeNull();
  });
  it("uses UUID identity regardless of case for a selected profile", () => {
    const access = resolveAccessPreview(actor(["admin"]), cookie(), now)!;
    expect(canReadPresentedAthlete(access, athleteA.toUpperCase())).toBe(true);
    expect(canReadPresentedAthlete(access, athleteB.toUpperCase())).toBe(false);
  });
  it("leaving preview restores actual roles, not a new grant", () => {
    expect(resolveAccessPreview(actor(["admin", "player"]), undefined, now)?.roles).toEqual(["admin", "player"]);
    expect(resolveAccessPreview(actor(["player"]), undefined, now)?.roles).toEqual(["player"]);
  });
});
