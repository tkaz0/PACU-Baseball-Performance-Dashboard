import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ access: vi.fn(), stats: vi.fn(), logs: vi.fn(), comparisons: vi.fn(), from: vi.fn(), select: vi.fn(), in: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAccess: mock.access }));
vi.mock("@/lib/game-server", () => ({ loadGameStats: mock.stats }));
vi.mock("@/lib/game-log-server", () => ({ loadGameLogs: mock.logs }));
vi.mock("@/lib/game-comparison-server", () => ({ loadGameComparisons: mock.comparisons }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children) }));
import Page from "@/app/(workspace)/game-stats/page";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const access = (role: string, preview = false, athleteId: string | null = id) => ({ roles: [role], actualRoles: preview ? ["admin"] : [role], athleteId, preview: preview ? { role, athleteId } : null, supabase: { from: mock.from } });
beforeEach(() => { vi.resetAllMocks(); mock.stats.mockResolvedValue([]); mock.logs.mockResolvedValue([]); mock.comparisons.mockResolvedValue([]); mock.from.mockReturnValue({ select: mock.select }); mock.select.mockReturnValue({ in: mock.in }); mock.in.mockResolvedValue({ data: [], error: null }); });
it.each([["admin", false], ["coach", false], ["coach", true]])("shows team stats for presented %s preview=%s without per-player log/comparison queries", async (role, preview) => {
  const auth = access(role as string, preview as boolean); mock.access.mockResolvedValue(auth);
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain("Team Game Stats"); expect(html).toContain("Team Batting"); expect(html).toContain("Data Review");
  expect(html).not.toContain("Game Log"); expect(mock.stats).toHaveBeenCalledExactlyOnceWith(auth);
  expect(mock.logs).not.toHaveBeenCalled(); expect(mock.comparisons).not.toHaveBeenCalled();
});
it.each([false, true])("keeps players and Player View on explicitly scoped own reads: %s", async preview => {
  const auth = access("player", preview); mock.access.mockResolvedValue(auth);
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain("My Game Stats"); expect(html).toContain(`/athletes/${id}`);
  expect(html).not.toContain("Team Batting"); expect(html).not.toContain("Player Breakdown"); expect(html).not.toContain("Data Review");
  for (const fn of [mock.stats, mock.logs, mock.comparisons]) expect(fn).toHaveBeenCalledExactlyOnceWith(auth, id);
  expect(mock.from).not.toHaveBeenCalled();
});
it("does not request any data for an unlinked player or failed authentication", async () => {
  mock.access.mockResolvedValue(access("player", false, null));
  expect(renderToStaticMarkup(await Page())).toContain("needs a player profile linked");
  expect(mock.stats).not.toHaveBeenCalled(); expect(mock.from).not.toHaveBeenCalled();
  mock.access.mockRejectedValue(Error("Sign in required")); await expect(Page()).rejects.toThrow("Sign in required");
  expect(mock.stats).not.toHaveBeenCalled();
});
