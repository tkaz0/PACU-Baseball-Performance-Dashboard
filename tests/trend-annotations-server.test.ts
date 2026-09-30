import { beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
import { loadTrendAnnotations } from "@/lib/trend-annotations-server";
import type { TrendAnnotation } from "@/lib/trend-annotations";
const athlete = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", other = "aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbbb";
const note: TrendAnnotation = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", athleteId: athlete, date: "2026-09-15", category: "stance", scope: "all", note: "Fictional shared cue", shared: true, archived: false, revision: 1, createdAt: "2026-09-20T00:00:00Z" };
function access(role: "player" | "coach" | "admin" = "player", preview = false) { return { roles: [role], athleteId: role === "player" ? athlete : null, actualRoles: preview ? ["admin"] : [role], preview: preview ? { role, athleteId: athlete } : null, supabase: { rpc: fake.rpc } } as unknown as Parameters<typeof loadTrendAnnotations>[0]; }
beforeEach(() => { vi.resetAllMocks(); fake.rpc.mockResolvedValue({ data: [note], error: null }); });
it.each([false, true])("strips unshared/archived notes and unrecognized fields for own player, preview=%s", async preview => {
  fake.rpc.mockResolvedValue({ data: [{ ...note, secret: "Never serialize this" }, { ...note, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", note: "Staff-only fictional cue", shared: false }, { ...note, id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", archived: true }], error: null });
  const result = await loadTrendAnnotations(access("player", preview), athlete);
  expect(result).toEqual([note]); expect(JSON.stringify(result)).not.toContain("Staff-only"); expect(JSON.stringify(result)).not.toContain("Never serialize");
});
it("retains staff notes for coaches, admins and interactive coach view", async () => {
  fake.rpc.mockResolvedValue({ data: [{ ...note, shared: false }], error: null });
  for (const actor of [access("coach"), access("admin"), access("coach", true)]) expect(await loadTrendAnnotations(actor, athlete)).toEqual([{ ...note, shared: false }]);
});
it("denies peer access before invoking the RPC", async () => {
  for (const id of [other, "invalid"]) await expect(loadTrendAnnotations(access(), id)).rejects.toThrow("access denied");
  expect(fake.rpc).not.toHaveBeenCalled();
});
it.each([{ id: [note.id] }, { athleteId: other }, { scope: "unreviewed" }, { category: "unreviewed" }, { date: "2026-09-31" }, { revision: 0 }, { note: "" }])("rejects malformed projections %#", async change => {
  fake.rpc.mockResolvedValue({ data: [{ ...note, ...change }], error: null }); await expect(loadTrendAnnotations(access(), athlete)).rejects.toThrow("format");
});
it("does not silently treat unavailable reads or duplicate identities as empty success", async () => {
  fake.rpc.mockResolvedValueOnce({ data: null, error: { code: "fictional" } }); await expect(loadTrendAnnotations(access(), athlete)).rejects.toThrow("could not be loaded");
  fake.rpc.mockResolvedValueOnce({ data: [note, note], error: null }); await expect(loadTrendAnnotations(access(), athlete)).rejects.toThrow("Duplicate");
});
