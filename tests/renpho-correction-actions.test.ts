import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ guard: vi.fn(), preview: vi.fn(), apply: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdminMutation: mocks.guard }));
vi.mock("@/lib/renpho-correction-server", () => ({ previewRenphoReportSwap: mocks.preview, applyRenphoReportSwap: mocks.apply }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { reviewReportCorrection, saveReportCorrection } from "@/app/(workspace)/admin/import/renpho/corrections/actions";

// Fictional assignments and request only; no production reports or identities.
const input = { requestId: "44444444-4444-4444-8444-444444444444", reports: [
  { fileHash: "a".repeat(64), fromAthleteCode: "SYN-001", toAthleteCode: "SYN-002", renphoId: "FICTIONAL-A" },
  { fileHash: "b".repeat(64), fromAthleteCode: "SYN-002", toAthleteCode: "SYN-001", renphoId: null },
] };
const fingerprint = "f".repeat(64);
const preview = { fingerprint, reports: input.reports.map(report => ({ ...report, measurementCount: 3, measuredAt: "2026-10-02", sourceFile: "fictional.png" })) };
const receipt = { requestId: input.requestId, measurementsMoved: 6, aliasesMoved: 1 };
beforeEach(() => { vi.resetAllMocks(); mocks.guard.mockResolvedValue({}); mocks.preview.mockResolvedValue(preview); mocks.apply.mockResolvedValue(receipt); });

describe("report correction action boundaries", () => {
  it.each(["Anonymous", "Disabled account", "Coach", "Player", "Admin in Coach View", "Admin in Player View"])("preserves %s guard denial before reading or mutating reports", async reason => {
    mocks.guard.mockRejectedValue(new Error(`Denied: ${reason}`));
    await expect(reviewReportCorrection(input)).rejects.toThrow(`Denied: ${reason}`);
    await expect(saveReportCorrection(input, fingerprint, true)).rejects.toThrow(`Denied: ${reason}`);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("reviews without writes, and requires a literal confirmation before apply", async () => {
    expect(await reviewReportCorrection(input)).toEqual({ preview });
    expect(mocks.preview).toHaveBeenCalledExactlyOnceWith(input);
    expect(mocks.apply).not.toHaveBeenCalled(); expect(mocks.revalidate).not.toHaveBeenCalled();
    for (const confirmed of [false, undefined, null, "true", 1]) {
      expect(await saveReportCorrection(input, fingerprint, confirmed as boolean)).toHaveProperty("error", "Check both assignments before saving.");
    }
    expect(mocks.apply).not.toHaveBeenCalled(); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("revalidates shared views only after a verified correction receipt", async () => {
    expect(await saveReportCorrection(input, fingerprint, true)).toEqual({ receipt });
    expect(mocks.guard).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.apply).toHaveBeenCalledExactlyOnceWith(input, fingerprint);
    expect(mocks.revalidate.mock.calls).toEqual([
      ["/imports"], ["/roster"], ["/leaderboards"], ["/testing"], ["/admin/import/renpho"], ["/admin/import/renpho/corrections"], ["/athletes", "layout"],
    ]);
  });
  it("keeps unconfirmed writes retryable with exactly the reviewed request and fingerprint", async () => {
    const before = JSON.stringify(input);
    mocks.apply.mockRejectedValueOnce(new Error("Fictional private database detail"));
    const first = await saveReportCorrection(input, fingerprint, true);
    expect(first).toEqual({ error: "The correction could not be confirmed. Retry this same correction to verify or complete it." });
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(await saveReportCorrection(input, fingerprint, true)).toEqual({ receipt });
    expect(mocks.apply.mock.calls[0]).toEqual(mocks.apply.mock.calls[1]);
    expect(mocks.apply.mock.calls[1]).toEqual([input, fingerprint]);
    expect(JSON.stringify(input)).toBe(before);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.guard).toHaveBeenCalledTimes(2);
  });
  it("does not expose failure details or misreport a failed preview", async () => {
    mocks.preview.mockRejectedValueOnce(new Error("Fictional private report data"));
    expect(await reviewReportCorrection(input)).toEqual({ error: "These reports could not be reviewed. Refresh the report list and check the selected players and report IDs." });
    expect(mocks.apply).not.toHaveBeenCalled(); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
