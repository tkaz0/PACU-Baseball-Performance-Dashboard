import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/types";

const fake = vi.hoisted(() => ({ access: vi.fn(), queries: [] as { table: string; filters: [string, unknown][] }[] }));
vi.mock("@/lib/auth", () => ({ requireImportAccess: fake.access }));
vi.mock("@/app/(workspace)/admin/performance/actions", () => ({ shareMeasurements: vi.fn() }));
vi.mock("@/components/shared-performance-import", () => ({ SharedPerformanceImport: () => null }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement("a", { href, ...props }, children) }));
import PerformanceImport from "@/app/(workspace)/admin/performance/page";

const userId = "11111111-1111-4111-8111-111111111111";
function access(roles: Role[], preview = false) {
  return { roles, actualRoles: preview ? ["admin"] : roles, preview: preview ? { role: "coach", athleteId: null } : null,
    user: { id: userId }, supabase: { from(table: string) {
      const query = { table, filters: [] as [string, unknown][] }; fake.queries.push(query);
      const builder = { select: () => builder, eq(key: string, value: unknown) { query.filters.push([key, value]); return builder; },
        order: () => builder, limit: async () => ({ data: [], error: null }) };
      return builder;
    } } };
}
beforeEach(() => { vi.resetAllMocks(); fake.queries = []; });

describe("shared import history in effective Coach access", () => {
  it.each([false, true])("limits Coach receipts to the signed-in actor before reading (Admin Coach view=%s)", async preview => {
    fake.access.mockResolvedValueOnce(access(["coach"], preview));
    const html = renderToStaticMarkup(await PerformanceImport({ searchParams: Promise.resolve({}) }));
    expect(fake.queries.find(query => query.table === "performance_imports")?.filters).toEqual([["created_by", userId]]);
    expect(html).toContain("Your Recent Shared Imports");
    expect(html).not.toContain('href="/admin/import"');
  });
  it("retains full receipt history for Admin access outside a role view", async () => {
    fake.access.mockResolvedValueOnce(access(["admin"]));
    const html = renderToStaticMarkup(await PerformanceImport({ searchParams: Promise.resolve({}) }));
    expect(fake.queries.find(query => query.table === "performance_imports")?.filters).toEqual([]);
    expect(html).toContain("Recent Shared Imports"); expect(html).not.toContain("Your Recent Shared Imports");
  });
  it.each(["/login", "/access-denied", "/overview?preview=read-only"])("obeys the live import guard before any history or roster query: %s", async destination => {
    fake.access.mockRejectedValueOnce(new Error(`REDIRECT:${destination}`));
    await expect(PerformanceImport({ searchParams: Promise.resolve({}) })).rejects.toThrow(`REDIRECT:${destination}`);
    expect(fake.queries).toEqual([]);
  });
});
