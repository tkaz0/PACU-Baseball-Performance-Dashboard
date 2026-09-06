import { describe, expect, it } from "vitest";
import { manualHeightInches, prepareManualTesting, type ManualTestingInput, type ManualTestingRow } from "@/lib/manual-testing";
import { prepareReviewedPerformanceRows } from "@/lib/performance-import";
import type { TestingAthlete } from "@/lib/testing-checklist";

// Fictional manual inputs only; no real reports, athletes, storage or requests.
const athlete: TestingAthlete = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", athleteCode: "SYN-001", name: "Fictional Avery Northstar",
  jerseyNumber: 0, primaryPosition: "CF", secondaryPosition: null, playerType: "position", rosterStatus: "active" };
const today = "2026-09-19";
const row = (extra: Partial<ManualTestingRow> = {}): ManualTestingRow => ({ metricKey: "weight", unit: "lb", value: "180.2", ...extra });
const input = (extra: Partial<ManualTestingInput> = {}): ManualTestingInput => ({
  submissionId: "11111111-1111-4111-8111-111111111111", athleteCode: athlete.athleteCode,
  testedOn: "2026-09-12", protocol: "Fictional field protocol", rows: [row()], ...extra,
});
const prepare = (value: unknown, selected = athlete) => prepareManualTesting(value, selected, today);

describe("manual testing measurements", () => {
  it("prepares exact canonical observations from entered values, without a vendor source claim", async () => {
    const draft = input({ rows: [row(), row({ metricKey: "height", unit: "ft-in", value: "", feet: "5", inches: "11.5" })] });
    const before = structuredClone(draft), result = await prepare(draft);
    expect(result.measurements).toHaveLength(2);
    expect(result.measurements[0]).toMatchObject({ athlete_code: "SYN-001", metric: "Weight", unit: "lb", value: 180.2,
      source: "Manual testing · Fictional field protocol", source_sheet: "Manual testing", source_row: 1 });
    expect(result.measurements[1]).toMatchObject({ metric: "Height", value: 71.5, unit: "in" });
    expect(prepareReviewedPerformanceRows(result.measurements).map(reading => reading.metric_key)).toEqual(["weight", "height"]);
    expect(draft).toEqual(before);
  });

  it("preserves one submission's provenance across explicit retries and unsaved edits", async () => {
    const first = await prepare(input()), repeated = await prepare(input()), edited = await prepare(input({ rows: [row({ value: "181" })] }));
    expect(repeated).toEqual(first);
    expect(edited.measurements[0].id).toBe(first.measurements[0].id);
    expect(edited.measurements[0].file_hash).toBe(first.measurements[0].file_hash);
    expect(edited.measurements[0].value).toBe(181);
    const next = await prepare(input({ submissionId: "22222222-2222-4222-8222-222222222222" }));
    expect(next.measurements[0].id).not.toBe(first.measurements[0].id);
    expect(JSON.parse(first.measurements[0].id.slice(12))).toEqual([first.measurements[0].file_hash, "Manual testing", 1, 0]);
  });

  it("keeps manually entered vendor/device protocols in a distinct manual source", async () => {
    const result = await prepare(input({ protocol: "  RENPHO   device  " }));
    expect(result.measurements[0].source).toBe("Manual testing · RENPHO device");
    expect(result.measurements[0].source).not.toBe("RENPHO");
    expect(result.input.protocol).toBe("RENPHO device");
  });

  it.each(["", " ", "NaN", "Infinity", "1e2", "0x10", "1,800", "90 mph", "-1", "1.2.3"])("rejects nondecimal or incomplete manual numbers %s", async value => {
    await expect(prepare(input({ rows: [row({ value })] }))).rejects.toThrow();
  });

  it("retains meaningful zero rates while rejecting zero weights and times", async () => {
    const pitcher = { ...athlete, playerType: "pitcher", primaryPosition: "P" };
    expect((await prepare(input({ rows: [row({ metricKey: "bb_pct", unit: "%", value: "0" })] }), pitcher)).measurements[0].value).toBe(0);
    for (const reading of [row({ value: "0" }), row({ metricKey: "home_to_first", unit: "s", value: "0" }), row({ metricKey: "body_fat_pct", unit: "%", value: "100.1" })]) {
      await expect(prepare(input({ rows: [reading] }))).rejects.toThrow();
    }
  });

  it.each(["2026-05-31", "2026-09-20", "2027-01-01", "2026-09-31", "2026-9-01", "2026-09-12T00:00:00Z", ""])("rejects future, invalid or out-of-window dates %s", async testedOn => {
    await expect(prepare(input({ testedOn }))).rejects.toThrow("testing date");
  });

  it("allows earlier body measurements but keeps all baseball and speed entries in Fall", async () => {
    expect((await prepare(input({ testedOn: "2026-08-09" }))).measurements[0].measured_at).toBe("2026-08-09");
    for (const metricKey of ["home_to_first", "max_exit_velocity", "outfield_velocity"]) {
      await expect(prepare(input({ testedOn: "2026-08-09", rows: [row({ metricKey, unit: metricKey === "home_to_first" ? "s" : "mph", value: "10" })] }))).rejects.toThrow("Fall 2026");
    }
  });

  it("enforces roster role eligibility, including pitcher-only, two-way and explicit field positions", async () => {
    const pitcher = { ...athlete, playerType: "pitcher", primaryPosition: "P" };
    for (const metricKey of ["home_to_first", "max_exit_velocity", "outfield_velocity"]) {
      await expect(prepare(input({ rows: [row({ metricKey, unit: metricKey === "home_to_first" ? "s" : "mph" })] }), pitcher)).rejects.toThrow("available measurement");
    }
    const twoWay = { ...pitcher, playerType: "two_way", secondaryPosition: "OF" };
    expect((await prepare(input({ rows: [row({ metricKey: "max_exit_velocity", unit: "mph" })] }), twoWay)).measurements).toHaveLength(1);
    await expect(prepare(input({ rows: [row({ metricKey: "infield_velocity", unit: "mph" })] }))).rejects.toThrow("available measurement");
    await expect(prepare(input(), { ...athlete, rosterStatus: "inactive" })).rejects.toThrow("available measurement");
  });

  it("requires exact identity and supports no unspecified metrics, duplicate metrics or invented units", async () => {
    await expect(prepare(input({ athleteCode: "SYN-002" }))).rejects.toThrow("current roster");
    for (const rows of [[], [row({ metricKey: "Generic Velocity" })], [row(), row({ unit: "kg" })], [row({ unit: "lbs" })]]) {
      await expect(prepare(input({ rows }))).rejects.toThrow();
    }
    await expect(prepare(input({ rows: Array.from({ length: 25 }, () => row()) }))).rejects.toThrow();
  });

  it("rejects conflicting same-unit average and maximum values", async () => {
    const rows = [row({ metricKey: "avg_exit_velocity", unit: "mph", value: "95" }), row({ metricKey: "max_exit_velocity", unit: "mph", value: "90" })];
    await expect(prepare(input({ rows }))).rejects.toThrow("cannot exceed");
    expect((await prepare(input({ rows: rows.map(item => ({ ...item, value: "90" })) }))).measurements).toHaveLength(2);
  });

  it("rejects unsupported hidden fields, missing protocol and malformed submission identifiers", async () => {
    for (const value of [null, [], { ...input(), unexpected: "private" }, input({ submissionId: "not-a-uuid" }), input({ protocol: "" }), input({ protocol: "a\nb" }), input({ protocol: "a".repeat(81) }),
      input({ rows: [{ ...row(), unexpected: true } as ManualTestingRow] }), input({ rows: [row({ feet: "5" })] })]) await expect(prepare(value)).rejects.toThrow();
  });
});

describe("manual feet and inches", () => {
  it("supports exact whole and fractional inches", () => {
    expect(manualHeightInches("6", "0")).toBe(72);
    expect(manualHeightInches("5", "11.25")).toBe(71.25);
  });
  it.each([["5.5", "5"], ["5", "12"], ["5", ""], ["", "11"], ["0", "0"], ["-1", "2"]])("rejects invalid or partial height %s ft %s in", (feet, inches) => {
    expect(() => manualHeightInches(feet, inches)).toThrow();
  });
});
