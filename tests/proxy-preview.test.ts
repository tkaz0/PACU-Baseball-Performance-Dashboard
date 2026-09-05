import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createServerClient, getClaims } = vi.hoisted(() => ({ createServerClient: vi.fn(), getClaims: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@/lib/env", () => ({
  hasSupabaseConfig: () => true,
  supabaseConfig: () => ({ url: "https://example.supabase.co", key: "public-fixture-key" }),
}));
import { proxy } from "@/proxy";

describe("browser workspace and private session boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServerClient.mockReturnValue({ auth: { getClaims } });
    getClaims.mockResolvedValue({ data: null, error: null });
  });

  it("refreshes authentication on every browser workspace route without a public bypass", async () => {
    for (const path of ["/preview", "/preview/roster", "/preview/import", "/preview/access", "/preview/athletes/SYN-001"]) {
      const response = await proxy(new NextRequest(`https://example.com${path}`));
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
    expect(getClaims).toHaveBeenCalledTimes(5);
  });

  it("never skips the browser workspace check when the authentication provider is unavailable", async () => {
    createServerClient.mockImplementation(() => { throw new Error("Auth unavailable"); });
    await expect(proxy(new NextRequest("https://example.com/preview/import"))).rejects.toThrow("Auth unavailable");
  });

  it("keeps session validation for private routes and similar-looking prefixes", async () => {
    for (const path of ["/admin/access", "/api/athletes/SYN-001", "/preview-other", "/preview/../admin/import"]) {
      await proxy(new NextRequest(`https://example.com${path}`));
    }
    expect(getClaims).toHaveBeenCalledTimes(4);
  });

  it("preserves normal handling of sign-in and recovery entry routes", async () => {
    for (const path of ["/login", "/forgot-password", "/reset-password", "/auth/callback", "/auth/confirm"]) {
      const response = await proxy(new NextRequest(`https://example.com${path}`));
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
    expect(getClaims).toHaveBeenCalledTimes(5);
  });
});
