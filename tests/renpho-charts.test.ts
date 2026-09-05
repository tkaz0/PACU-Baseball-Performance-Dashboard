import { describe, expect, it } from "vitest";
import { getRenphoReports, getRenphoChartReadings, getRenphoHistory, RENPHO_MASS_METRICS, RENPHO_PERCENT_METRICS } from "@/lib/renpho-charts";
import type { Measurement } from "@/lib/imports/engine";
import type { ImportBatch } from "@/lib/local-workspace";

// Wholly fictional observations, dates and source files, independent of private reports.
const hash = (letter: string) => letter.repeat(64);
const reading = (overrides: Partial<Measurement> = {}): Measurement => ({
  id: "fictional-observation-1", athlete_code: "LOCAL-0001", measured_at: "2026-01-03", source: "RENPHO",
  metric: "Weight", value: 10, unit: "kg", source_file: "fictional-report.pdf", source_sheet: "RENPHO report · Page 1",
  source_row: 1, file_hash: hash("a"), ...overrides,
});
const batch = (fileHash: string, importedAt: string, overrides: Partial<ImportBatch> = {}): ImportBatch => ({
  id: `fictional-${fileHash}-${importedAt}`, kind: "measurements", fileName: "fictional-report.pdf", source: "RENPHO",
  importedAt, created: 1, updated: 0, unchanged: 0, fileHash, ...overrides,
});
const reports = (values: Measurement[], batches: ImportBatch[] = []) => getRenphoReports(values, batches, "LOCAL-0001");

describe("RENPHO chart report grouping", () => {
  it("scopes by exact athlete and reviewed-report provenance, retaining original objects", () => {
    const valid = reading();
    const values = [valid, reading({ athlete_code: "LOCAL-0002" }), reading({ source: "Other" }), reading({ source_sheet: "CSV" }), reading({ source: "renpho" }), reading({ source_sheet: "RENPHO report" })];
    const result = reports(values);
    expect(result).toHaveLength(1); expect(result[0].readings).toEqual([valid]);
    expect(result[0].reference).toBe(valid); expect(result[0].readings[0]).toBe(valid);
    expect(getRenphoReports(values, [], "local-0001")).toEqual([]);
    expect(getRenphoReports(values, [], "LOCAL-9999")).toEqual([]);
  });
  it("requires a complete canonical positive report page label", () => {
    const labels = ["RENPHO report · Page ", "RENPHO report · Page 0", "RENPHO report · Page 01", "RENPHO report · Page -1",
      "RENPHO report · Page 1.5", "RENPHO report · Page 1 extra", "RENPHO report · Page 1 ", "RENPHO report · Page 1\n"];
    const result = reports([...labels.map(source_sheet => reading({ source_sheet })), reading({ source_sheet: "RENPHO report · Page 10" })]);
    expect(result).toHaveLength(1);
    expect(result[0].readings.map(value => value.source_sheet)).toEqual(["RENPHO report · Page 10"]);
  });
  it("excludes missing or noncanonical report hashes without changing raw measurements", () => {
    const values = ["", "a", "A".repeat(64), "g".repeat(64), "a".repeat(63), "a".repeat(65)].map((file_hash, index) => reading({ file_hash, source_file: `fictional-distinct-${index}.pdf` }));
    const before = JSON.stringify(values);
    expect(reports(values)).toEqual([]);
    expect(JSON.stringify(values)).toBe(before);
    expect(reports([reading()])).toHaveLength(1);
  });
  it("groups multiple pages but never merges hashes, dates or athletes, even for identical filenames", () => {
    const values = [reading(), reading({ id: "fictional-page-2", source_sheet: "RENPHO report · Page 2", metric: "BMR", unit: "kcal" }),
      reading({ id: "fictional-other-hash", file_hash: hash("b") }), reading({ id: "fictional-other-date", measured_at: "2026-01-04" }),
      reading({ id: "fictional-other-athlete", athlete_code: "LOCAL-0002" })];
    const result = reports(values);
    expect(result).toHaveLength(3);
    expect(result.map(report => [report.reference.measured_at, report.reference.file_hash, report.readings.length])).toEqual([
      ["2026-01-04", hash("a"), 1], ["2026-01-03", hash("a"), 2], ["2026-01-03", hash("b"), 1],
    ]);
    expect(new Set(result.map(report => report.key)).size).toBe(3);
    expect(JSON.parse(result[0].key)).toEqual(["LOCAL-0001", hash("a"), "2026-01-04"]);
  });
  it("sorts newest by test date, latest qualifying import time, then hash deterministically", () => {
    const values = [reading({ file_hash: hash("c") }), reading({ file_hash: hash("a") }), reading({ file_hash: hash("b") }), reading({ file_hash: hash("d"), measured_at: "2026-01-04" })];
    const batches = [batch(hash("a"), "2026-01-05T00:00:00Z"), batch(hash("a"), "2026-01-06T00:00:00Z"), batch(hash("b"), "2026-01-06T00:00:00Z"),
      batch(hash("c"), "2026-01-07T00:00:00Z", { kind: "roster" }), batch(hash("c"), "2026-01-08T00:00:00Z", { source: "Other" })];
    const result = reports(values, batches);
    expect(result.map(report => report.reference.file_hash)).toEqual([hash("d"), hash("a"), hash("b"), hash("c")]);
    expect(result[1].importedAt).toBe("2026-01-06T00:00:00Z"); expect(result[3].importedAt).toBe("");
    expect(reports([...values].reverse(), [...batches].reverse())).toEqual(result);
  });
  it("keeps missing metrics missing in the latest report and does not mutate inputs", () => {
    const values = [reading({ measured_at: "2026-01-01" }), reading({ id: "fictional-current", file_hash: hash("b"), metric: "BMR", unit: "kcal", value: 1000 })];
    const before = JSON.stringify(values); const result = reports(values);
    expect(getRenphoChartReadings(result[0]).map(value => value.metric)).toEqual(["BMR"]);
    expect(JSON.stringify(values)).toBe(before);
    expect(getRenphoHistory(result, "Weight", "kg")).toHaveLength(1);
  });
});

describe("individually chartable report readings", () => {
  it("omits every duplicate metric/unit, even equal or invalid duplicates, while keeping units separate", () => {
    const values = [reading(), reading({ id: "fictional-equal" }), reading({ id: "fictional-other-unit", unit: "lb" }),
      reading({ id: "fictional-fat-1", metric: "Body Fat Percentage", unit: "%", value: 15 }), reading({ id: "fictional-fat-invalid", metric: "Body Fat Percentage", unit: "%", value: 101 })];
    const result = reports(values)[0];
    expect(getRenphoChartReadings(result).map(value => [value.metric, value.unit])).toEqual([["Weight", "lb"]]);
    expect(result.readings).toHaveLength(5);
  });
  it("excludes nonfinite, negative and out-of-range percentages without clamping raw data", () => {
    const values = [reading({ value: -1 }), reading({ id: "fictional-bone", metric: "Bone Mass", value: NaN }),
      reading({ id: "fictional-muscle", metric: "Muscle Mass", value: Infinity }), reading({ id: "fictional-protein", metric: "Protein Mass", value: -Infinity }),
      reading({ id: "fictional-fat", metric: "Body Fat Percentage", unit: "%", value: 101 }), reading({ id: "fictional-water", metric: "Body Water Mass", value: 0 }),
      reading({ id: "fictional-subcutaneous", metric: "Subcutaneous Fat", unit: "%", value: 100 }), reading({ id: "fictional-free", metric: "Fat-Free Mass", value: Number.MAX_VALUE })];
    const result = reports(values)[0]; const valid = getRenphoChartReadings(result);
    expect(valid.map(value => value.metric).sort()).toEqual(["Body Water Mass", "Fat-Free Mass", "Subcutaneous Fat"]);
    expect(valid.find(value => value.metric === "Body Water Mass")?.value).toBe(0);
    expect(valid.find(value => value.metric === "Fat-Free Mass")?.value).toBe(Number.MAX_VALUE);
    expect(result.readings.find(value => value.metric === "Weight")?.value).toBe(-1);
    expect(Number.isNaN(result.readings.find(value => value.metric === "Bone Mass")?.value)).toBe(true);
  });
  it("accepts only the supported metric/unit pairs without aliases or conversions", () => {
    const values = [reading({ unit: "st" }), reading({ id: "fictional-bone", metric: "Bone Mass", unit: "st" }),
      reading({ id: "fictional-muscle", metric: "Muscle Mass", unit: "%" }), reading({ id: "fictional-bmi", metric: "BMI", unit: "kg/m²" }),
      reading({ id: "fictional-smi", metric: "Skeletal Muscle Index", unit: "kg/m2" }), reading({ id: "fictional-bmr", metric: "BMR", unit: "kcal/day" }),
      reading({ id: "fictional-unknown", metric: "Unverified metric", unit: "kg" }), reading({ id: "fictional-whr", metric: "Waist-to-Hip Ratio", unit: "ratio" })];
    expect(getRenphoChartReadings(reports(values)[0]).map(value => value.metric).sort()).toEqual(["BMI", "BMR", "Waist-to-Hip Ratio", "Weight"]);
    expect(RENPHO_MASS_METRICS).toEqual(["Weight", "Body Fat Mass", "Bone Mass", "Protein Mass", "Body Water Mass", "Muscle Mass", "Skeletal Muscle Mass", "Fat-Free Mass"]);
    expect(RENPHO_PERCENT_METRICS).toContain("Body Fat Percentage"); expect(RENPHO_PERCENT_METRICS).toContain("Subcutaneous Fat");
  });
  it("does not accept readings appended from a different athlete or report group", () => {
    const result = reports([reading()])[0];
    result.readings.push(reading({ athlete_code: "LOCAL-0002", metric: "BMR", unit: "kcal" }), reading({ file_hash: hash("b"), metric: "Bone Mass" }));
    expect(getRenphoChartReadings(result).map(value => value.metric)).toEqual(["Weight"]);
  });
});

describe("RENPHO metric history", () => {
  it("reverses tied report ordering exactly so the latest-12 history includes the selected latest report", () => {
    const values = Array.from({ length: 16 }, (_, index) => reading({ file_hash: index.toString(16).padStart(64, "0"), id: `fictional-tied-${index}`, value: index + 1 }));
    const result = reports(values, values.map(value => batch(value.file_hash, "2026-01-05T00:00:00Z")));
    const history = getRenphoHistory(result, "Weight", "kg");
    expect(history.map(point => point.reportKey)).toEqual([...result].reverse().map(report => report.key));
    expect(history.at(-1)?.reportKey).toBe(result[0].key);
    expect(history.slice(-12).some(point => point.reportKey === result[0].key)).toBe(true);
  });
  it("keeps same-day reports as separate chronological points and never merges unit histories", () => {
    const values = [reading({ file_hash: hash("c"), value: 3 }), reading({ file_hash: hash("b"), value: 2 }), reading({ file_hash: hash("a"), measured_at: "2026-01-02", value: 1 }),
      reading({ file_hash: hash("d"), unit: "lb", value: 4 }), reading({ file_hash: hash("e"), measured_at: "2026-01-04", metric: "BMR", unit: "kcal" })];
    const result = reports(values, [batch(hash("b"), "2026-01-05T00:00:00Z"), batch(hash("c"), "2026-01-06T00:00:00Z")]);
    const keysBefore = result.map(report => report.key); const history = getRenphoHistory(result, "Weight", "kg");
    expect(history.map(point => point.reading.value)).toEqual([1, 2, 3]);
    expect(history[1].reading.measured_at).toBe(history[2].reading.measured_at);
    expect(history[1].reportKey).not.toBe(history[2].reportKey);
    expect(getRenphoHistory(result, "Weight", "lb").map(point => point.reading.value)).toEqual([4]);
    expect(getRenphoHistory(result, "Weight", "lbs")).toEqual([]);
    expect(result.map(report => report.key)).toEqual(keysBefore);
    expect(history[0].reading).toBe(values[2]);
  });
  it("excludes an ambiguous report from only that metric history without averaging or backfill", () => {
    const values = [reading({ measured_at: "2026-01-01", value: 1 }), reading({ file_hash: hash("b"), value: 2 }),
      reading({ id: "fictional-duplicate", file_hash: hash("b"), value: 2 }), reading({ file_hash: hash("c"), measured_at: "2026-01-04", value: 3 })];
    expect(getRenphoHistory(reports(values), "Weight", "kg").map(point => point.reading.value)).toEqual([1, 3]);
    expect(getRenphoHistory([], "Weight", "kg")).toEqual([]);
  });
});
