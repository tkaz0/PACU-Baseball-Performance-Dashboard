import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
import { loadTrainingBlockCounts } from "@/lib/training-blocks-server";
const own = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", peer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const sample = (observationId = "fictional-observation", count = 7) => ({ observationId, count, value: 70, measuredAt: "2026-09-15", source: "Full Swing · Practice", metricKey: "avg_exit_velocity", unit: "mph" });
const access = (roles = ["player"], athleteId: string | null = own) => ({ roles, athleteId, supabase: { rpc: mock.rpc } }) as unknown as Parameters<typeof loadTrainingBlockCounts>[0];
beforeEach(() => { vi.clearAllMocks(); mock.rpc.mockResolvedValue({ data: [sample()], error: null }); });
it("restricts player, preview and unlinked access before a query", async () => {
  await expect(loadTrainingBlockCounts(access(), peer)).rejects.toThrow("access denied");
  await expect(loadTrainingBlockCounts(access(["player"], null), own)).rejects.toThrow("access denied");
  await expect(loadTrainingBlockCounts(access(["admin"]), "bad-id")).rejects.toThrow("access denied");
  expect(mock.rpc).not.toHaveBeenCalled();
  expect(await loadTrainingBlockCounts(access(), own)).toEqual([sample()]);
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("athlete_training_block_samples", { p_athlete_id: own, p_offset: 0 });
});
it("allows current staff to select an athlete", async () => {
  await loadTrainingBlockCounts(access(["coach"], null), peer);
  expect(mock.rpc).toHaveBeenCalledWith("athlete_training_block_samples", { p_athlete_id: peer, p_offset: 0 });
});
it("validates the narrow result and never exposes extra server data", async () => {
  for (const data of [null, {}, [null], [sample("x", 0)], [sample("x", 1.2)], [sample("x", 100001)], [{ ...sample(), athleteId: peer }], [sample("", 2)], [{ ...sample(), value: NaN }], [{ ...sample(), source: "QPA" }], [{ ...sample(), measuredAt: "2026-09-31" }], [{ ...sample(), metricKey: "weight" }], [{ ...sample(), unit: "km/h" }], [{ observationId: "legacy-id-only", count: 7 }], Array.from({ length: 1001 }, () => sample())]) {
    mock.rpc.mockResolvedValueOnce({ data, error: null });
    await expect(loadTrainingBlockCounts(access(), own)).rejects.toThrow("could not be verified");
  }
  mock.rpc.mockResolvedValueOnce({ data: [], error: { message: "private raw failure" } });
  await expect(loadTrainingBlockCounts(access(), own)).rejects.toThrow("could not be loaded");
});
it("paginates sequentially and refuses duplicate IDs or oversized histories", async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => sample(`fictional-${index}`, 2));
  mock.rpc.mockImplementation(async (_name, { p_offset }: { p_offset: number }) => ({ data: rows.slice(p_offset, p_offset + 1000), error: null }));
  expect(await loadTrainingBlockCounts(access(), own)).toHaveLength(1001);
  expect(mock.rpc.mock.calls.map(call => call[1].p_offset)).toEqual([0, 1000]);
  mock.rpc.mockResolvedValueOnce({ data: [rows[0], rows[0]], error: null });
  await expect(loadTrainingBlockCounts(access(), own)).rejects.toThrow("changed while loading");
  mock.rpc.mockImplementation(async (_name, { p_offset }: { p_offset: number }) => ({ data: Array.from({ length: 1000 }, (_, index) => sample(`fictional-${p_offset + index}`, 1)), error: null }));
  await expect(loadTrainingBlockCounts(access(), own)).rejects.toThrow("exceeds");
});
