import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createServerClient, getClaims } = vi.hoisted(() => ({ createServerClient: vi.fn(), getClaims: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@/lib/env", () => ({
  hasSupabaseConfig: () => true,
  supabaseConfig: () => ({ url: "https://example.supabase.co", key: "public-fixture-key" }),
}));
import { proxy } from "@/proxy";

describe("fixture preview and private session boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServerClient.mockReturnValue({ auth: { getClaims } });
    getClaims.mockResolvedValue({ data: null, error: null });
  });

  it("serves public preview paths even when the authentication provider is unavailable", async () => {
    createServerClient.mockImplementation(() => { throw new Error("Auth unavailable"); });
    for (const path of ["/preview", "/preview/roster", "/preview/athletes/SYN-001"]) {
      const response = await proxy(new NextRequest(`https://example.com${path}`));
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("keeps session validation for private routes and similar-looking prefixes", async () => {
    for (const path of ["/admin/access", "/api/athletes/SYN-001", "/preview-other", "/preview/../admin/import"]) {
      await proxy(new NextRequest(`https://example.com${path}`));
    }
    expect(getClaims).toHaveBeenCalledTimes(4);
  });
});
