import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Measurement } from "@/lib/imports/engine";
const fake = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireImportAccess: fake.guard }));
vi.mock("next/cache", () => ({ revalidatePath: fake.revalidate }));
import { saveReviewedMeasurements, loadSharedReportMeasurements } from "@/app/(workspace)/imports/actions";
const fileHash = "a".repeat(64), importId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const measurement = (changes: Partial<Measurement> = {}): Measurement => ({
  id: `observation:${JSON.stringify([fileHash, "Fictional tests", 2, 0])}`, athlete_code: "SYN-001",
  measured_at: "2026-09-12", source: "Fictional testing", metric: "Max EV", value: 10, unit: "mph",
  source_file: "fictional.csv", source_sheet: "Fictional tests", source_row: 2, file_hash: fileHash, ...changes,
});
beforeEach(() => { vi.resetAllMocks(); fake.guard.mockResolvedValue({ supabase: { rpc: fake.rpc } }); fake.rpc.mockResolvedValue({ data: { import_id: importId, created: 1, unchanged: 0 }, error: null }); });
describe("staff information import actions", () => {
  it.each(["/login", "/access-denied", "/overview?preview=read-only"])("denies %s before any read or write RPC", async path => {
    fake.guard.mockRejectedValue(new Error(`REDIRECT:${path}`));
    await expect(saveReviewedMeasurements([measurement()], true)).rejects.toThrow(`REDIRECT:${path}`);
    await expect(loadSharedReportMeasurements(fileHash)).rejects.toThrow(`REDIRECT:${path}`);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("validates the full input then rechecks live staff authorization before saving", async () => {
    fake.guard.mockResolvedValueOnce({ supabase: { rpc: fake.rpc } }).mockRejectedValueOnce(new Error("Fictional role revoked"));
    expect(await saveReviewedMeasurements([measurement()], true)).toHaveProperty("error");
    expect(fake.guard).toHaveBeenCalledTimes(2); expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("returns only a verified receipt and canonical immutable rows", async () => {
    expect(await saveReviewedMeasurements([measurement()], true)).toEqual({ import_id: importId, created: 1, unchanged: 0 });
    expect(fake.guard).toHaveBeenCalledTimes(2);
    expect(fake.rpc).toHaveBeenCalledExactlyOnceWith("admin_import_performance", { p_rows: [{
      observation_id: measurement().id, athlete_code: "SYN-001", metric_key: "max_exit_velocity", measured_at: "2026-09-12", value: 10, unit: "mph",
      source: "Fictional testing", source_file: "fictional.csv", source_sheet: "Fictional tests", source_row: 2, file_hash: fileHash,
    }] });
    expect(fake.revalidate.mock.calls).toEqual([["/imports"], ["/overview"], ["/leaderboards"], ["/athletes", "layout"]]);
  });
  it("never forwards extra provider receipt fields to the client", async () => {
    fake.rpc.mockResolvedValue({ data: { import_id: importId, created: 1, unchanged: 0, internal_note: "Fictional unrequested metadata" }, error: null });
    expect(await saveReviewedMeasurements([measurement()], true)).toEqual({ import_id: importId, created: 1, unchanged: 0 });
  });
  it.each([false, undefined, "true", 1])("requires the exact review confirmation %#", async confirmed => {
    expect(await saveReviewedMeasurements([measurement()], confirmed as boolean)).toHaveProperty("error"); expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each([null, {}, [], [null], Array.from({ length: 501 }, () => measurement()), [measurement(), measurement()],
    [measurement(), measurement({ value: -1 })], [{ ...measurement(), report_text: "Fictional private extra" }],
    [measurement({ source_file: "é".repeat(524289) })]])("rejects a malformed, extra-field or out-of-bounds payload %# before RPC", async rows => {
    expect(await saveReviewedMeasurements(rows, true)).toHaveProperty("error"); expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each([{ data: null, error: { message: "Fictional failure" } }, { data: { import_id: importId, created: 2, unchanged: 0 }, error: null }])("does not claim an uncertain save or retry %#", async result => {
    fake.rpc.mockResolvedValue(result); expect(await saveReviewedMeasurements([measurement()], true)).toHaveProperty("error");
    expect(fake.rpc).toHaveBeenCalledTimes(1); expect(fake.revalidate).not.toHaveBeenCalled();
  });
});
describe("precise report dedup reads", () => {
  it("loads only the requested hash and returns verified numeric provenance", async () => {
    const rows = [measurement({ value: 0.30000000000000004 })]; fake.rpc.mockResolvedValue({ data: rows, error: null });
    expect(await loadSharedReportMeasurements(fileHash)).toEqual({ measurements: rows });
    expect(fake.rpc).toHaveBeenCalledExactlyOnceWith("performance_report_measurements", { p_file_hash: fileHash });
    expect(fake.revalidate).not.toHaveBeenCalled();
  });
  it("accepts a verified empty report match", async () => {
    fake.rpc.mockResolvedValue({ data: [], error: null }); expect(await loadSharedReportMeasurements(fileHash)).toEqual({ measurements: [] });
  });
  it.each(["", "A".repeat(64), "x".repeat(64), "a".repeat(64) + "\n", null])("rejects invalid hash %# before querying", async hash => {
    expect(await loadSharedReportMeasurements(hash as string)).toHaveProperty("error"); expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each([null, {}, Array.from({ length: 501 }, () => measurement()), [measurement({ file_hash: "b".repeat(64) })],
    [{ ...measurement(), imported_by: "11111111-1111-4111-8111-111111111111" }], [measurement({ value: NaN })], [measurement(), measurement()]])("fails closed for malformed, extra-field or partial report result %#", async data => {
    fake.rpc.mockResolvedValue({ data, error: null }); expect(await loadSharedReportMeasurements(fileHash)).toHaveProperty("error");
  });
});
