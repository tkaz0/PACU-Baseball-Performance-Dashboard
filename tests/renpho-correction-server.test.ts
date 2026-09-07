import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), requireAdminMutation: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireAdminMutation: mocks.requireAdminMutation }));
import { applyRenphoReportSwap, previewRenphoReportSwap } from "@/lib/renpho-correction-server";
const requestId = "44444444-4444-4444-8444-444444444444", fingerprint = "f".repeat(64);
const input = () => ({ requestId, reports: [
  { fileHash: "a".repeat(64), fromAthleteCode: "SYN-001", toAthleteCode: "SYN-002", renphoId: "FICTIONAL-001" },
  { fileHash: "b".repeat(64), fromAthleteCode: "SYN-002", toAthleteCode: "SYN-001", renphoId: null },
] });
const preview = () => ({ fingerprint, reports: input().reports.map(row => ({ ...row, measurementCount: 16, measuredAt: "2026-09-12", sourceFile: "fictional-report.png" })) });
const receipt = () => ({ requestId, measurementsMoved: 32, aliasesMoved: 1 });
beforeEach(() => { vi.resetAllMocks(); mocks.requireAdminMutation.mockResolvedValue({ supabase: { rpc: mocks.rpc } }); });

describe("administrative report correction adapter", () => {
  it("requires live Admin outside preview before either RPC", async () => {
    for (const operation of [() => previewRenphoReportSwap(input()), () => applyRenphoReportSwap(input(), fingerprint)]) {
      mocks.requireAdminMutation.mockRejectedValueOnce(new Error("Coach and Player previews cannot manage identities"));
      await expect(operation()).rejects.toThrow("cannot manage");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("passes only normalized exact reviewed fields and verifies the preview", async () => {
    const submitted = input(); submitted.reports[0].renphoId = " fictional-001 ";
    mocks.rpc.mockResolvedValueOnce({ data: preview(), error: null });
    expect(await previewRenphoReportSwap(submitted)).toEqual(preview());
    expect(mocks.rpc).toHaveBeenCalledWith("admin_preview_renpho_report_swap", { p_request: input() });
  });
  it("applies the same request and fingerprint for an explicit safe retry", async () => {
    mocks.rpc.mockResolvedValue({ data: receipt(), error: null });
    expect(await applyRenphoReportSwap(input(), fingerprint)).toEqual(receipt());
    expect(await applyRenphoReportSwap(input(), fingerprint)).toEqual(receipt());
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1]);
    expect(mocks.rpc).toHaveBeenCalledWith("admin_apply_renpho_report_swap", { p_request: input(), p_fingerprint: fingerprint, p_reviewed: true });
  });
  it("rejects malformed, nonreciprocal or overbroad requests before any RPC", async () => {
    const bad = [null, {}, [], { ...input(), extra: true }, { ...input(), requestId: "invalid" }, { ...input(), reports: [] },
      { ...input(), reports: [input().reports[0], input().reports[0]] },
      { ...input(), reports: input().reports.map(row => ({ ...row, fromAthleteCode: "SYN-001", toAthleteCode: "SYN-001" })) },
      { ...input(), reports: input().reports.map(row => ({ ...row, renphoId: "same" })) },
      { ...input(), reports: input().reports.map(row => ({ ...row, renphoId: "" })) },
      { ...input(), reports: input().reports.map(row => ({ ...row, renphoId: 123 })) },
      { ...input(), reports: input().reports.map(row => ({ ...row, fileHash: "a".repeat(63) })) },
      { ...input(), reports: input().reports.map(row => ({ ...row, image: "Fictional image" })) },
    ];
    for (const value of bad) { await expect(previewRenphoReportSwap(value)).rejects.toThrow(); await expect(applyRenphoReportSwap(value, fingerprint)).rejects.toThrow(); }
    await expect(applyRenphoReportSwap(input(), "invalid")).rejects.toThrow("Review");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects malformed previews, mismatched owners and unexpected private fields", async () => {
    for (const data of [null, [], {}, { ...preview(), fingerprint: "bad" }, { ...preview(), reports: [] },
      { ...preview(), rawText: "Fictional private content" },
      { ...preview(), reports: preview().reports.map(row => ({ ...row, value: 160 })) },
      { ...preview(), reports: preview().reports.map(row => ({ ...row, fromAthleteCode: "SYN-002" })) },
      { ...preview(), reports: preview().reports.map(row => ({ ...row, measurementCount: 0 })) },
      { ...preview(), reports: preview().reports.map(row => ({ ...row, measuredAt: "not-a-date" })) },
    ]) {
      mocks.rpc.mockResolvedValueOnce({ data, error: null });
      await expect(previewRenphoReportSwap(input())).rejects.toThrow("could not be verified");
    }
  });
  it("rejects invalid receipts without misreporting completion", async () => {
    for (const data of [null, {}, { ...receipt(), requestId: "55555555-5555-4555-8555-555555555555" }, { ...receipt(), aliasesMoved: 2 }, { ...receipt(), measurementsMoved: 1001 }, { ...receipt(), measurementsMoved: 1 }, { ...receipt(), renphoId: "FICTIONAL-001" }]) {
      mocks.rpc.mockResolvedValueOnce({ data, error: null });
      await expect(applyRenphoReportSwap(input(), fingerprint)).rejects.toThrow("receipt could not be verified");
    }
  });
  it("keeps database error details out of exposed messages", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Fictional private database details" } });
    await expect(previewRenphoReportSwap(input())).rejects.toThrow("reports could not be reviewed");
    await expect(applyRenphoReportSwap(input(), fingerprint)).rejects.toThrow("correction could not be confirmed");
  });
});
