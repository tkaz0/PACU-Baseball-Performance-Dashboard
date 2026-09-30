import { beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ access: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireImportAccess: fake.access }));
vi.mock("next/cache", () => ({ revalidatePath: fake.revalidate }));
import { saveTrendAnnotation } from "@/app/(workspace)/athletes/[id]/trend-annotation-actions";
const athlete = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function form(overrides: Record<string, string> = {}) { const data = new FormData(); Object.entries({ athleteId: athlete, annotationId: id, revision: "0", date: "2026-09-15", category: "stance", scope: "all", note: "Fictional stance change", ...overrides }).forEach(([key, value]) => data.set(key, value)); return data; }
beforeEach(() => { vi.resetAllMocks(); fake.access.mockResolvedValue({ roles: ["coach"], preview: null, supabase: { rpc: fake.rpc } }); fake.rpc.mockResolvedValue({ data: { id, revision: 1 }, error: null }); });
it("saves a staff note with sharing off by default and verifies its receipt", async () => {
  expect(await saveTrendAnnotation({ status: "idle" }, form())).toMatchObject({ status: "saved" });
  expect(fake.access).toHaveBeenCalledOnce();
  expect(fake.rpc).toHaveBeenCalledExactlyOnceWith("staff_save_trend_annotation", { p_athlete_id: athlete, p_annotation_id: id, p_expected_revision: 0, p_occurred_on: "2026-09-15", p_category: "stance", p_scope: "all", p_note: "Fictional stance change", p_shared: false, p_archived: false });
  expect(fake.revalidate).toHaveBeenCalledWith(`/athletes/${athlete}`);
});
it("accepts explicit share and archive edits at an exact revision", async () => {
  fake.rpc.mockResolvedValue({ data: { id, revision: 4 }, error: null });
  expect(await saveTrendAnnotation({ status: "idle" }, form({ revision: "3", shared: "on", archived: "on" }))).toMatchObject({ status: "saved" });
  expect(fake.rpc).toHaveBeenCalledWith("staff_save_trend_annotation", expect.objectContaining({ p_expected_revision: 3, p_shared: true, p_archived: true }));
});
it("blocks Player View as even if the underlying account is an admin", async () => {
  fake.access.mockResolvedValue({ roles: ["player"], actualRoles: ["admin"], preview: { role: "player", athleteId: athlete }, supabase: { rpc: fake.rpc } });
  expect(await saveTrendAnnotation({ status: "idle" }, form())).toMatchObject({ status: "error" }); expect(fake.rpc).not.toHaveBeenCalled();
});
it("checks live staff access before accepting submitted values", async () => {
  fake.access.mockRejectedValue(new Error("denied")); await expect(saveTrendAnnotation({ status: "idle" }, form())).rejects.toThrow("denied"); expect(fake.rpc).not.toHaveBeenCalled();
});
it.each<Record<string, string>>([{ date: "2026-09-31" }, { scope: "unreviewed" }, { category: "diagnosis" }, { note: "a\nb" }, { revision: "1.1" }, { note: "a".repeat(401) }])("rejects invalid input without a write %#", async change => {
  expect(await saveTrendAnnotation({ status: "idle" }, form(change))).toMatchObject({ status: "invalid" }); expect(fake.rpc).not.toHaveBeenCalled();
});
it("never retries stale or uncertain writes and does not claim success", async () => {
  fake.rpc.mockResolvedValueOnce({ data: null, error: { code: "40001" } });
  expect(await saveTrendAnnotation({ status: "idle" }, form())).toMatchObject({ status: "stale" });
  fake.rpc.mockResolvedValueOnce({ data: { id, revision: 9 }, error: null });
  expect(await saveTrendAnnotation({ status: "idle" }, form())).toMatchObject({ status: "unverified" });
  expect(fake.rpc).toHaveBeenCalledTimes(2); expect(fake.revalidate).not.toHaveBeenCalled();
});
