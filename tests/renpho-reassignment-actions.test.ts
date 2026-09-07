import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ guard: vi.fn(), preview: vi.fn(), apply: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdminMutation: mocks.guard }));
vi.mock("@/lib/renpho-reassignment-server", () => ({ previewRenphoReportReassignment: mocks.preview, applyRenphoReportReassignment: mocks.apply }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { reviewSingleReportCorrection, saveSingleReportCorrection } from "@/app/(workspace)/admin/import/renpho/corrections/single-actions";
const input = { requestId: "44444444-4444-4444-8444-444444444444", report: { fileHash: "a".repeat(64), fromAthleteCode: "SYN-001", toAthleteCode: "SYN-003", renphoIds: ["FICTIONAL-A", "000045"] } };
const fingerprint = "f".repeat(64);
const preview = { fingerprint, report: { ...input.report, measurementCount: 3, measuredAt: "2026-10-02", sourceFile: "fictional.png" } };
const receipt = { requestId: input.requestId, measurementsMoved: 3, aliasesMoved: 2 };
beforeEach(() => { vi.resetAllMocks(); mocks.guard.mockResolvedValue({}); mocks.preview.mockResolvedValue(preview); mocks.apply.mockResolvedValue(receipt); });

describe("single report correction action boundaries", () => {
  it.each(["Anonymous", "Disabled account", "Coach", "Player", "Admin in Coach View", "Admin in Player View"])("preserves %s guard denial before access", async reason => {
    mocks.guard.mockRejectedValue(new Error(`Denied: ${reason}`));
    await expect(reviewSingleReportCorrection(input)).rejects.toThrow(`Denied: ${reason}`);
    await expect(saveSingleReportCorrection(input, fingerprint, true)).rejects.toThrow(`Denied: ${reason}`);
    expect(mocks.preview).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled(); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("reviews without mutation and requires literal confirmation", async () => {
    expect(await reviewSingleReportCorrection(input)).toEqual({ preview });
    expect(mocks.preview).toHaveBeenCalledExactlyOnceWith(input);
    for (const confirmed of [false, undefined, null, "true", 1]) expect(await saveSingleReportCorrection(input, fingerprint, confirmed as boolean)).toHaveProperty("error");
    expect(mocks.apply).not.toHaveBeenCalled(); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("refreshes shared views only after a verified receipt", async () => {
    expect(await saveSingleReportCorrection(input, fingerprint, true)).toEqual({ receipt });
    expect(mocks.guard).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.apply).toHaveBeenCalledExactlyOnceWith(input, fingerprint);
    expect(mocks.revalidate.mock.calls).toEqual([["/imports"], ["/roster"], ["/leaderboards"], ["/testing"], ["/admin/import/renpho"], ["/admin/import/renpho/corrections"], ["/athletes", "layout"]]);
  });
  it("retries an uncertain save with the identical request, aliases, and fingerprint", async () => {
    const original = JSON.stringify(input);
    mocks.apply.mockRejectedValueOnce(new Error("Private fictional detail"));
    expect(await saveSingleReportCorrection(input, fingerprint, true)).toEqual({ error: "The correction could not be confirmed. Keep this page open and retry the same correction." });
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(await saveSingleReportCorrection(input, fingerprint, true)).toEqual({ receipt });
    expect(mocks.apply.mock.calls[0]).toEqual(mocks.apply.mock.calls[1]);
    expect(JSON.stringify(input)).toBe(original); expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("keeps private provider errors out of preview responses", async () => {
    mocks.preview.mockRejectedValueOnce(new Error("Private fictional data"));
    expect(await reviewSingleReportCorrection(input)).toEqual({ error: "This report could not be reviewed. Refresh the report list and check the player and selected report IDs." });
    expect(mocks.apply).not.toHaveBeenCalled(); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
