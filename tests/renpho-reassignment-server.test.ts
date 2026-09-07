import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), requireAdminMutation: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireAdminMutation: mocks.requireAdminMutation }));
import { applyRenphoReportReassignment, previewRenphoReportReassignment } from "@/lib/renpho-reassignment-server";
const requestId = "44444444-4444-4444-8444-444444444444", fingerprint = "f".repeat(64);
const input = () => ({ requestId, report: { fileHash: "a".repeat(64), fromAthleteCode: "SYN-001", toAthleteCode: "SYN-002", renphoIds: ["FICTIONAL-001", "000012"] } });
const preview = () => ({ fingerprint, report: { ...input().report, measurementCount: 16, measuredAt: "2026-09-12", sourceFile: "fictional-report.png" } });
const receipt = () => ({ requestId, measurementsMoved: 16, aliasesMoved: 2 });
beforeEach(() => { vi.resetAllMocks(); mocks.requireAdminMutation.mockResolvedValue({ supabase: { rpc: mocks.rpc } }); });
describe("single report reassignment adapter", () => {
  it("requires active Admin outside View as before reading or writing", async () => {
    for (const operation of [() => previewRenphoReportReassignment(input()), () => applyRenphoReportReassignment(input(), fingerprint)]) {
      mocks.requireAdminMutation.mockRejectedValueOnce(new Error("Preview cannot manage identities"));
      await expect(operation()).rejects.toThrow("cannot manage");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("normalizes exact IDs, preserves zeroes and only sends the whitelist", async () => {
    const value = input(); value.report.renphoIds = [" fictional-001 ", "000012"];
    mocks.rpc.mockResolvedValueOnce({ data: preview(), error: null });
    expect(await previewRenphoReportReassignment(value)).toEqual(preview());
    expect(mocks.rpc).toHaveBeenCalledWith("admin_preview_renpho_report_reassignment", { p_request: input() });
  });
  it("supports identical safe retries with the reviewed fingerprint", async () => {
    mocks.rpc.mockResolvedValue({ data: receipt(), error: null });
    expect(await applyRenphoReportReassignment(input(), fingerprint)).toEqual(receipt());
    expect(await applyRenphoReportReassignment(input(), fingerprint)).toEqual(receipt());
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1]);
    expect(mocks.rpc).toHaveBeenCalledWith("admin_apply_renpho_report_reassignment", { p_request: input(), p_fingerprint: fingerprint, p_reviewed: true });
  });
  it("accepts no alias changes but rejects duplicate or excessive IDs, same owner and unknown fields", async () => {
    const withoutIds = { ...input(), report: { ...input().report, renphoIds: [] } };
    mocks.rpc.mockResolvedValueOnce({ data: { ...receipt(), aliasesMoved: 0 }, error: null });
    expect((await applyRenphoReportReassignment(withoutIds, fingerprint)).aliasesMoved).toBe(0);
    mocks.rpc.mockClear();
    for (const value of [null, {}, { ...input(), requestId: "bad" }, { ...input(), extra: true },
      { ...input(), report: { ...input().report, toAthleteCode: "SYN-001" } },
      { ...input(), report: { ...input().report, image: "Fictional image" } },
      ...[["A", "B", "C"], ["a", " A "], [""], [123], null].map(renphoIds => ({ ...input(), report: { ...input().report, renphoIds } })),
    ]) { await expect(previewRenphoReportReassignment(value)).rejects.toThrow(); await expect(applyRenphoReportReassignment(value, fingerprint)).rejects.toThrow(); }
    await expect(applyRenphoReportReassignment(input(), "bad")).rejects.toThrow("Review");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuses malformed or mismatched preview metadata", async () => {
    for (const data of [null, {}, { ...preview(), fingerprint: "bad" }, { ...preview(), privateDetail: true },
      { ...preview(), report: { ...preview().report, measurementCount: 0 } },
      { ...preview(), report: { ...preview().report, fromAthleteCode: "SYN-002" } },
      { ...preview(), report: { ...preview().report, renphoIds: ["OTHER"] } },
      { ...preview(), report: { ...preview().report, value: 160 } },
    ]) { mocks.rpc.mockResolvedValueOnce({ data, error: null }); await expect(previewRenphoReportReassignment(input())).rejects.toThrow("could not be verified"); }
  });
  it("refuses bad receipts and keeps raw database errors private", async () => {
    for (const data of [null, {}, { ...receipt(), requestId: "55555555-5555-4555-8555-555555555555" }, { ...receipt(), measurementsMoved: 0 }, { ...receipt(), measurementsMoved: 501 }, { ...receipt(), aliasesMoved: 1 }, { ...receipt(), privateDetail: true }]) {
      mocks.rpc.mockResolvedValueOnce({ data, error: null }); await expect(applyRenphoReportReassignment(input(), fingerprint)).rejects.toThrow("receipt could not be verified");
    }
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Fictional private SQL details" } });
    await expect(previewRenphoReportReassignment(input())).rejects.toThrow("report could not be reviewed");
    await expect(applyRenphoReportReassignment(input(), fingerprint)).rejects.toThrow("correction could not be confirmed");
  });
});
