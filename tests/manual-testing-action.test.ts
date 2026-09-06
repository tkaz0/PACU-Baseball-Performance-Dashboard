import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TestingAthlete } from "@/lib/testing-checklist";
import type { ManualTestingInput } from "@/lib/manual-testing";

const fake = vi.hoisted(() => ({ access: vi.fn(), roster: vi.fn(), save: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireImportAccess: fake.access }));
vi.mock("@/lib/testing-checklist-server", () => ({ loadTestingRoster: fake.roster }));
vi.mock("@/app/(workspace)/imports/actions", () => ({ saveReviewedMeasurements: fake.save }));
vi.mock("next/cache", () => ({ revalidatePath: fake.revalidate }));
import { saveManualTesting } from "@/app/(workspace)/testing/entry/actions";

const athlete: TestingAthlete = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", athleteCode: "SYN-001", name: "Fictional Avery Northstar", jerseyNumber: 0,
  primaryPosition: "CF", secondaryPosition: null, playerType: "position", rosterStatus: "active" };
const input = (): ManualTestingInput => ({ submissionId: "11111111-1111-4111-8111-111111111111", athleteCode: "SYN-001", testedOn: "2026-06-01", protocol: "Fictional testing", rows: [{ metricKey: "height", unit: "ft-in", value: "", feet: "5", inches: "11" }] });
beforeEach(() => { vi.resetAllMocks(); fake.access.mockResolvedValue({}); fake.roster.mockResolvedValue([athlete]); fake.save.mockResolvedValue({ import_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", created: 1, unchanged: 0 }); });

describe("manual testing server entry", () => {
  it.each(["/login", "/access-denied", "/overview?preview=read-only", "/access-preview-unavailable"])("fails before input/roster access when staff authorization denies %s", async path => {
    fake.access.mockRejectedValueOnce(new Error(`REDIRECT:${path}`));
    await expect(saveManualTesting(input(), true)).rejects.toThrow(path);
    expect(fake.roster).not.toHaveBeenCalled(); expect(fake.save).not.toHaveBeenCalled();
  });
  it("requires explicit review before fetching the roster or saving", async () => {
    expect(await saveManualTesting(input(), false)).toMatchObject({ status: "invalid" });
    expect(fake.roster).not.toHaveBeenCalled(); expect(fake.save).not.toHaveBeenCalled();
  });
  it("uses fresh current player eligibility and refuses an invalid draft without a write", async () => {
    fake.roster.mockResolvedValueOnce([]);
    expect(await saveManualTesting(input(), true)).toMatchObject({ status: "invalid" });
    expect(await saveManualTesting({ ...input(), testedOn: "2099-01-01" }, true)).toMatchObject({ status: "invalid" });
    expect(fake.save).not.toHaveBeenCalled();
  });
  it("saves only the canonical reviewed values through the existing guarded importer", async () => {
    const result = await saveManualTesting(input(), true);
    expect(result).toMatchObject({ status: "saved", athleteId: athlete.id, receipt: { created: 1 } });
    expect(fake.save).toHaveBeenCalledOnce();
    const [measurements, confirmed] = fake.save.mock.calls[0];
    expect(confirmed).toBe(true); expect(measurements[0]).toMatchObject({ athlete_code: "SYN-001", metric: "Height", value: 71, unit: "in", source: "Manual testing · Fictional testing" });
    expect(measurements[0]).not.toHaveProperty("name"); expect(measurements[0]).not.toHaveProperty("rows");
    expect(fake.revalidate.mock.calls.map(call => call[0])).toEqual(["/testing", "/testing/entry"]);
  });
  it("preserves the same identities when an uncertain response is retried explicitly", async () => {
    fake.save.mockResolvedValueOnce({ error: "Save could not be confirmed" });
    expect(await saveManualTesting(input(), true)).toEqual({ status: "uncertain", error: "Save could not be confirmed" });
    expect(fake.revalidate).not.toHaveBeenCalled();
    expect(await saveManualTesting(input(), true)).toMatchObject({ status: "saved" });
    expect(fake.save.mock.calls[1][0]).toEqual(fake.save.mock.calls[0][0]);
  });
  it("propagates a fresh authorization denial from the shared saver without reporting success", async () => {
    fake.save.mockRejectedValueOnce(new Error("REDIRECT:/access-preview-unavailable"));
    await expect(saveManualTesting(input(), true)).rejects.toThrow("access-preview-unavailable");
    expect(fake.revalidate).not.toHaveBeenCalled();
  });
});
