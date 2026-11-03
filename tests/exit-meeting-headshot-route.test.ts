import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ staff: true }));
vi.mock("@/lib/auth", () => ({ getAccess: async () => ({ access: { roles: ["admin"] } }) }));
vi.mock("@/lib/access-preview", () => ({ canImportPresentedAccess: () => state.staff }));
import { GET } from "@/app/(workspace)/exit-meetings/headshot/route";

const call = (src: string) => GET(new Request(`https://example.com/exit-meetings/headshot?src=${encodeURIComponent(src)}`));
describe("Print All PDF headshot copy", () => {
  afterEach(() => { vi.unstubAllGlobals(); state.staff = true; });
  it("accepts only staff and reviewed goboxers roster photo URLs, never other hosts or paths", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/webp" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await call("https://example.com/images/2026/2/23/1_Fictional.jpg?width=90&quality=85")).status).toBe(400);
    expect((await call("https://goboxers.com/admin/secret?width=90&quality=85")).status).toBe(400);
    expect((await call("https://goboxers.com/images/2026/2/23/1_Fictional.jpg?width=9000&quality=85")).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    const ok = await call("https://goboxers.com/images/2026/2/23/1_Fictional.jpg?width=90&quality=85");
    expect(ok.status).toBe(200); expect(ok.headers.get("content-type")).toBe("image/webp");
    state.staff = false;
    expect((await call("https://goboxers.com/images/2026/2/23/1_Fictional.jpg?width=90&quality=85")).status).toBe(403);
  });
});
