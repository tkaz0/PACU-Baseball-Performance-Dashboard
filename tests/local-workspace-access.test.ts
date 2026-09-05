import { describe, expect, it, vi } from "vitest";
import { checkLocalWorkspaceAccess } from "@/lib/local-workspace-access";

const userId = "11111111-1111-4111-8111-111111111111";
describe("browser workspace current-session verification", () => {
  it("requires a fresh same-origin check for the exact signed-in administrator", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ allowed: true, userId }));
    expect(await checkLocalWorkspaceAccess(userId, request)).toEqual({ allowed: true });
    expect(request).toHaveBeenCalledWith("/api/local-workspace/access", expect.objectContaining({ cache: "no-store", credentials: "same-origin", redirect: "error", signal: expect.any(AbortSignal) }));
  });
  it("rejects another account, denied or malformed responses before local data may mount", async () => {
    for (const body of [{ allowed: true, userId: "22222222-2222-4222-8222-222222222222" }, { allowed: false, userId }, {}, null, { allowed: true }]) {
      expect(await checkLocalWorkspaceAccess(userId, vi.fn().mockResolvedValue(Response.json(body)))).toEqual({ allowed: false, destination: "/access-denied" });
    }
  });
  it("returns safe destinations for expired and revoked sessions and closes on outages", async () => {
    for (const [status, destination] of [[401, "/login"], [403, "/access-denied"], [500, null], [503, null]] as const) {
      expect(await checkLocalWorkspaceAccess(userId, vi.fn().mockResolvedValue(Response.json({ allowed: false }, { status })))).toEqual({ allowed: false, destination });
    }
    expect(await checkLocalWorkspaceAccess(userId, vi.fn().mockRejectedValue(new Error("network")))).toEqual({ allowed: false, destination: null });
    expect(await checkLocalWorkspaceAccess(userId, vi.fn().mockResolvedValue(new Response("invalid JSON")))).toEqual({ allowed: false, destination: null });
  });
});
