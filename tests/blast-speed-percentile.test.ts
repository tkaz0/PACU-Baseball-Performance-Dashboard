import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseBlastBatSpeedPercentile, type BlastBatSpeedPercentile } from "@/lib/blast-speed-percentile";
import { loadBlastBatSpeedPercentile } from "@/lib/blast-speed-percentile-server";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));

// Fictional athlete identities only; these tests never connect to a database.
const own = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const result: BlastBatSpeedPercentile = {
  athleteId: own,
  observedValue: 67.123456789,
  percentile: 62.5,
  sampleSize: 9,
  swingCount: 45,
  reportCount: 2,
  firstDate: "2026-09-01",
  lastDate: "2026-09-14",
};

function access(role: "player" | "coach" | "admin" = "player", preview = false) {
  return {
    roles: [role],
    athleteId: role === "player" ? own : null,
    actualRoles: preview ? ["admin"] : [role],
    preview: preview ? { version: 1, actorId: other, role, athleteId: role === "player" ? own : null, expiresAt: 1 } : null,
    supabase: { rpc },
  } as unknown as Parameters<typeof loadBlastBatSpeedPercentile>[0];
}

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: result, error: null });
});

describe("parseBlastBatSpeedPercentile", () => {
  it("retains the exact aggregate fields and full precision without mutating input", () => {
    const source = Object.freeze({ ...result });
    const parsed = parseBlastBatSpeedPercentile(source, own);
    expect(parsed).toEqual(result);
    expect(parsed).not.toBe(source);
    expect(source).toEqual(result);
  });

  it("keeps an unavailable own-athlete result null", () => {
    expect(parseBlastBatSpeedPercentile(null, own)).toBeNull();
  });

  it("matches UUID identity independently of letter casing", () => {
    expect(parseBlastBatSpeedPercentile(result, own.toUpperCase())).toEqual(result);
    const uppercase = { ...result, athleteId: own.toUpperCase() };
    expect(parseBlastBatSpeedPercentile(uppercase, own)).toEqual(uppercase);
  });

  it.each(["invalid", "", "aaaaaaaa-aaaa-0aaa-8aaa-aaaaaaaaaaaa"])("rejects invalid requested UUID %s even for null data", athleteId => {
    expect(() => parseBlastBatSpeedPercentile(null, athleteId)).toThrow("could not be verified");
  });

  it.each([
    undefined, false, 0, "null", [], [result], {},
    { ...result, athleteId: other },
    { ...result, athleteId: "invalid" },
    { ...result, athleteId: null },
    { ...result, names: ["Fictional Player"] },
    { ...result, reportId: "fictional-report" },
    { ...result, [Symbol("extra")]: "unexpected" },
  ])("rejects non-records, cross-athlete data and additional fields %#", data => {
    expect(() => parseBlastBatSpeedPercentile(data, own)).toThrow("could not be verified");
  });

  it.each(Object.keys(result))("requires its own %s field", field => {
    const missing: Record<string, unknown> = { ...result };
    delete missing[field];
    expect(() => parseBlastBatSpeedPercentile(missing, own)).toThrow("could not be verified");
    Object.setPrototypeOf(missing, { [field]: result[field as keyof BlastBatSpeedPercentile] });
    expect(() => parseBlastBatSpeedPercentile(missing, own)).toThrow("could not be verified");
  });

  it.each([-1, NaN, Infinity, -Infinity, "67.1", null, undefined])("rejects invalid observed bat speed %s", observedValue => {
    expect(() => parseBlastBatSpeedPercentile({ ...result, observedValue }, own)).toThrow("could not be verified");
  });

  it.each([0, 0.0000001, Number.MAX_VALUE])("accepts finite nonnegative bat speed without rounding %s", observedValue => {
    expect(parseBlastBatSpeedPercentile({ ...result, observedValue }, own)?.observedValue).toBe(observedValue);
  });

  it.each([-1, 100.01, NaN, Infinity, "62.5", undefined])("rejects invalid percentile %s", percentile => {
    expect(() => parseBlastBatSpeedPercentile({ ...result, percentile }, own)).toThrow("could not be verified");
  });

  it.each([0, 100, null])("accepts a bounded percentile or explicit null %s", percentile => {
    expect(parseBlastBatSpeedPercentile({ ...result, percentile }, own)?.percentile).toBe(percentile);
  });

  it.each([0, -1, 1.5, 1001, NaN, Infinity, "5", null])("rejects invalid cohort count %s", sampleSize => {
    expect(() => parseBlastBatSpeedPercentile({ ...result, sampleSize, percentile: null }, own)).toThrow("could not be verified");
  });

  it.each([1, 4])("requires an unavailable percentile below five athletes: n=%s", sampleSize => {
    expect(parseBlastBatSpeedPercentile({ ...result, sampleSize, percentile: null }, own)?.sampleSize).toBe(sampleSize);
    expect(() => parseBlastBatSpeedPercentile({ ...result, sampleSize, percentile: 0 }, own)).toThrow("could not be verified");
  });

  it.each([5, 1000])("accepts cohort boundary n=%s", sampleSize => {
    expect(parseBlastBatSpeedPercentile({ ...result, sampleSize }, own)?.sampleSize).toBe(sampleSize);
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "45", null])("rejects invalid swing count %s", swingCount => {
    expect(() => parseBlastBatSpeedPercentile({ ...result, swingCount }, own)).toThrow("could not be verified");
  });

  it("accepts safe swing-count endpoints and requires at least one swing per report", () => {
    expect(parseBlastBatSpeedPercentile({ ...result, swingCount: 1, reportCount: 1 }, own)?.swingCount).toBe(1);
    expect(parseBlastBatSpeedPercentile({ ...result, swingCount: Number.MAX_SAFE_INTEGER }, own)?.swingCount).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => parseBlastBatSpeedPercentile({ ...result, swingCount: 1 }, own)).toThrow("could not be verified");
  });

  it.each([0, -1, 1.5, 123, NaN, Infinity, "2", null])("rejects invalid report count %s", reportCount => {
    expect(() => parseBlastBatSpeedPercentile({ ...result, reportCount }, own)).toThrow("could not be verified");
  });

  it.each([
    { firstDate: "2026-08-31" }, { lastDate: "2027-01-01" },
    { firstDate: "2025-09-01" }, { lastDate: "2026-09-31" },
    { lastDate: "2026-11-31" }, { firstDate: "2026-9-01" },
    { firstDate: "2026-09-00" }, { lastDate: "2026-13-01" },
    { firstDate: "2026-09-01T00:00:00Z" }, { lastDate: "2026-09-14 " },
    { firstDate: null }, { lastDate: 20260914 },
    { firstDate: "2026-09-15", lastDate: "2026-09-14" },
  ])("rejects invalid, non-Fall or reversed date bounds %#", change => {
    expect(() => parseBlastBatSpeedPercentile({ ...result, ...change }, own)).toThrow("could not be verified");
  });

  it("bounds report count by inclusive days, including one-day and full-Fall records", () => {
    const singleDay = { ...result, firstDate: "2026-12-31", lastDate: "2026-12-31", reportCount: 1 };
    expect(parseBlastBatSpeedPercentile(singleDay, own)).toEqual(singleDay);
    expect(() => parseBlastBatSpeedPercentile({ ...singleDay, reportCount: 2 }, own)).toThrow("could not be verified");
    const fullFall = { ...result, lastDate: "2026-12-31", reportCount: 122, swingCount: 122 };
    expect(parseBlastBatSpeedPercentile(fullFall, own)).toEqual(fullFall);
    expect(parseBlastBatSpeedPercentile({ ...result, reportCount: 14 }, own)?.reportCount).toBe(14);
    expect(() => parseBlastBatSpeedPercentile({ ...result, reportCount: 15 }, own)).toThrow("could not be verified");
  });
});

describe("loadBlastBatSpeedPercentile", () => {
  it.each([
    ["player", false], ["player", true], ["coach", false], ["coach", true], ["admin", false],
  ] as const)("loads an authorized own aggregate through the ordinary session: %s preview=%s", async (role, preview) => {
    expect(await loadBlastBatSpeedPercentile(access(role, preview), own)).toEqual(result);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("athlete_blast_bat_speed_percentile", { p_athlete_id: own });
  });

  it.each(["coach", "admin"] as const)("allows %s to load the explicitly requested athlete only", async role => {
    const peer = { ...result, athleteId: other };
    rpc.mockResolvedValue({ data: peer, error: null });
    expect(await loadBlastBatSpeedPercentile(access(role), other)).toEqual(peer);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("athlete_blast_bat_speed_percentile", { p_athlete_id: other });
  });

  it.each([false, true])("blocks a player from another athlete before RPC, including Admin-as-Player preview=%s", async preview => {
    await expect(loadBlastBatSpeedPercentile(access("player", preview), other)).rejects.toThrow("access denied");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("blocks unlinked and roleless access before RPC", async () => {
    await expect(loadBlastBatSpeedPercentile({ ...access(), athleteId: null }, own)).rejects.toThrow("access denied");
    await expect(loadBlastBatSpeedPercentile({ ...access(), roles: [] }, own)).rejects.toThrow("access denied");
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(["player", "coach", "admin"] as const)("blocks malformed requested identity even for %s before RPC", async role => {
    await expect(loadBlastBatSpeedPercentile(access(role), "invalid")).rejects.toThrow("access denied");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts an uppercase own UUID without weakening athlete matching", async () => {
    expect(await loadBlastBatSpeedPercentile(access(), own.toUpperCase())).toEqual(result);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("athlete_blast_bat_speed_percentile", { p_athlete_id: own.toUpperCase() });
  });

  it("preserves null for an ineligible or invalid own aggregate", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await loadBlastBatSpeedPercentile(access(), own)).toBeNull();
  });

  it.each([null, result])("throws on RPC errors rather than treating them as unavailable %#", async data => {
    rpc.mockResolvedValue({ data, error: { code: "fictional", message: "Fictional backend diagnostic" } });
    await expect(loadBlastBatSpeedPercentile(access(), own)).rejects.toThrow("could not be loaded");
  });

  it.each([undefined, {}, [result], { ...result, athleteId: other }, { ...result, percentile: 101 }])("rejects malformed or cross-athlete RPC projections %#", async data => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(loadBlastBatSpeedPercentile(access(), own)).rejects.toThrow("could not be verified");
  });
});
