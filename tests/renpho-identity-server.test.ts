import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Measurement } from "@/lib/imports/engine";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), requireImportAccess: vi.fn(), requireAdminMutation: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireImportAccess: mocks.requireImportAccess, requireAdminMutation: mocks.requireAdminMutation }));
import { importReviewedRenpho, lookupRenphoIdentity, saveRenphoMappings } from "@/lib/renpho-identity-server";

const athlete = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", receipt = "11111111-1111-4111-8111-111111111111";
const hash = "a".repeat(64), page = "RENPHO report · Page 1";
const measurement = (): Measurement => ({ id: `observation:${JSON.stringify([hash, page, 2, 0])}`, athlete_code: "SYN-001", measured_at: "2026-09-12", metric: "Weight", unit: "lb", value: 160, source: "RENPHO", source_file: "fictional-report.png", source_sheet: page, source_row: 2, file_hash: hash });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireImportAccess.mockResolvedValue({ supabase: { rpc: mocks.rpc } });
  mocks.requireAdminMutation.mockResolvedValue({ supabase: { rpc: mocks.rpc } });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});
describe("server RENPHO identity adapter", () => {
  it("requires live import access before lookup and preserves exact text IDs", async () => {
    mocks.requireImportAccess.mockRejectedValueOnce(new Error("Player preview is read-only"));
    await expect(lookupRenphoIdentity("FICTIONAL-001")).rejects.toThrow("read-only");
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValueOnce({ data: { athlete_id: athlete, athlete_code: "SYN-001" }, error: null });
    expect(await lookupRenphoIdentity(" 000045 ")).toEqual({ athlete_id: athlete, athlete_code: "SYN-001" });
    expect(mocks.rpc).toHaveBeenCalledWith("staff_match_renpho_id", { p_report_id: "000045" });
    expect(await lookupRenphoIdentity("UNKNOWN-ID")).toBeNull();
  });
  it("fails closed on unavailable or unexpected lookup results without returning a registry", async () => {
    for (const data of [[], undefined, {}, { athlete_id: athlete, athlete_code: "SYN-001", renpho_id: "FICTIONAL-001" }, { athlete_id: "invalid", athlete_code: "SYN-001" }]) {
      mocks.rpc.mockResolvedValueOnce({ data, error: null });
      await expect(lookupRenphoIdentity("FICTIONAL-001")).rejects.toThrow("could not be verified");
    }
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Private database detail" } });
    await expect(lookupRenphoIdentity("FICTIONAL-001")).rejects.toThrow("matching is unavailable");
    mocks.rpc.mockClear();
    for (const id of ["", "BAD ID", "X".repeat(81), "X".repeat(513)]) await expect(lookupRenphoIdentity(id)).rejects.toThrow("valid RENPHO ID");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires Admin outside preview before accepting reviewed additive mappings", async () => {
    mocks.requireAdminMutation.mockRejectedValueOnce(new Error("Coach cannot manage identities"));
    await expect(saveRenphoMappings([{ athlete_code: "SYN-001", renpho_id: "FICTIONAL-001" }])).rejects.toThrow("cannot manage");
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValueOnce({ data: { created: 1, unchanged: 0 }, error: null });
    expect(await saveRenphoMappings([{ athlete_code: "SYN-001", renpho_id: " fictional-001 " }])).toEqual({ created: 1, unchanged: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith("admin_upsert_renpho_ids", { p_mapping: [{ athlete_code: "SYN-001", renpho_id: "FICTIONAL-001" }], p_reviewed: true });
  });
  it("rejects malformed mappings, blank IDs, duplicate owners and extra fields before RPC", async () => {
    for (const rows of [null, {}, [], [{ athlete_code: "SYN-001", renpho_id: "" }], [{ athlete_code: "SYN-001", renpho_id: 45 }], [{ athlete_code: "SYN-001", renpho_id: "A", email: "fictional@example.com" }], [{ athlete_code: "SYN-001", renpho_id: "same" }, { athlete_code: "SYN-002", renpho_id: " SAME " }], Array.from({ length: 201 }, (_, i) => ({ athlete_code: "SYN-001", renpho_id: `TEST-${i}` }))]) {
      await expect(saveRenphoMappings(rows)).rejects.toThrow();
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("verifies mapping receipts and keeps raw RPC errors out of user-facing messages", async () => {
    const rows = [{ athlete_code: "SYN-001", renpho_id: "FICTIONAL-001" }];
    for (const data of [null, {}, { created: 2, unchanged: 0 }, { created: -1, unchanged: 2 }, { created: 1, unchanged: 0, renpho_id: "FICTIONAL-001" }]) {
      mocks.rpc.mockResolvedValueOnce({ data, error: null });
      await expect(saveRenphoMappings(rows)).rejects.toThrow("could not be verified");
    }
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Private conflict detail" } });
    await expect(saveRenphoMappings(rows)).rejects.toThrow("IDs were not saved");
  });
  it("passes the transient exact ID separately from the numeric whitelist to atomic import", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { import_id: receipt, created: 1, unchanged: 0 }, error: null });
    const extra = { ...measurement(), renpho_id: "PRIVATE-FICTIONAL-ID", image: "Fictional image", ocrText: "Fictional raw text" };
    expect(await importReviewedRenpho([extra], { athleteCode: "SYN-001", renphoId: " fictional-001 " })).toEqual({ import_id: receipt, created: 1, unchanged: 0 });
    const [name, args] = mocks.rpc.mock.calls[0];
    expect(name).toBe("staff_import_renpho");
    expect(args.p_report_id).toBe("FICTIONAL-001"); expect(args.p_athlete_code).toBe("SYN-001");
    expect(JSON.stringify(args.p_rows)).not.toContain("PRIVATE-FICTIONAL-ID");
    expect(JSON.stringify(args.p_rows)).not.toContain("image"); expect(JSON.stringify(args.p_rows)).not.toContain("ocrText");
    expect(Object.keys(args.p_rows[0]).sort()).toEqual(["observation_id", "athlete_code", "metric_key", "measured_at", "value", "unit", "source", "source_file", "source_sheet", "source_row", "file_hash"].sort());
  });
  it("permits reviewed blank IDs and rejects mixed source/player submissions before saving", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { import_id: receipt, created: 1, unchanged: 0 }, error: null });
    await importReviewedRenpho([measurement()], { athleteCode: "SYN-001", renphoId: "" });
    expect(mocks.rpc.mock.calls[0][1].p_report_id).toBe("");
    mocks.rpc.mockClear();
    await expect(importReviewedRenpho([{ ...measurement(), source: "Fictional Full Swing" }], { athleteCode: "SYN-001", renphoId: "" })).rejects.toThrow("RENPHO source");
    await expect(importReviewedRenpho([measurement()], { athleteCode: "SYN-002", renphoId: "" })).rejects.toThrow("Review the player");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires fresh staff access and rejects invalid/uncertain import receipts", async () => {
    mocks.requireImportAccess.mockRejectedValueOnce(new Error("Read-only Player view"));
    await expect(importReviewedRenpho([measurement()], { athleteCode: "SYN-001", renphoId: "" })).rejects.toThrow("Read-only");
    expect(mocks.rpc).not.toHaveBeenCalled();
    for (const data of [null, { import_id: "invalid", created: 1, unchanged: 0 }, { import_id: receipt, created: 0, unchanged: 0 }, { import_id: receipt, created: 1, unchanged: 0, report_id: "FICTIONAL-001" }]) {
      mocks.rpc.mockResolvedValueOnce({ data, error: null });
      await expect(importReviewedRenpho([measurement()], { athleteCode: "SYN-001", renphoId: "" })).rejects.toThrow("could not be verified");
    }
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Private mismatch detail" } });
    await expect(importReviewedRenpho([measurement()], { athleteCode: "SYN-001", renphoId: "" })).rejects.toThrow("readings were not saved");
  });
});
