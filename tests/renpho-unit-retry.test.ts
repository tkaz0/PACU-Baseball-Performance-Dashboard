import { describe, expect, it } from "vitest";
import { parseRenphoRegions, type RenphoRegions } from "@/lib/imports/renpho";
import { applyRenphoSmiUnitRetry, findRenphoSmiUnitRetry } from "@/lib/imports/renpho-unit-retry";
import { previewRenphoMeasurements } from "@/lib/imports/renpho-preview";
import type { RosterAthlete } from "@/lib/types";

// Entirely fictional source evidence; no actual report or athlete data.
function fixture(smi = "SMI +005.00 kg/n}"): RenphoRegions {
  return {
    title: "Body Composition Analysis Report",
    header: "ID: FICTIONAL-UNIT-RETRY Test Date: September 4, 2026 at 1:02:03 PM",
    compositionHeader: "Measurement(lb)",
    compositionRows: ["Weight", "Body Fat Mass", "Bone Mass", "Protein Mass", "Body Water Mass", "Muscle Mass", "Skeletal Muscle Mass"]
      .map((label, index) => ({ label, measurement: String(index + 1), line: index + 1 })),
    assessment: "BMI 20\nBody Fat Percentage 15%",
    indicators: `Other Indicators\r\nBMR 1000kcal\n${smi}\r\nWHR 0.5\n`,
  };
}

describe("bounded SMI unit rereading", () => {
  it("targets only the unique unsupported SMI unit at its actual source line", () => {
    const regions = fixture();
    expect(findRenphoSmiUnitRetry(regions, parseRenphoRegions(regions))).toEqual({ lineIndex: 2, prefix: "SMI +005.00", unit: "kg/n}" });
  });

  it("requires a recognized layout and exactly one matching error at that line", () => {
    const regions = fixture();
    const parsed = parseRenphoRegions(regions);
    const issue = parsed.issues.find(item => item.severity === "error")!;
    for (const changed of [
      { ...parsed, recognizedLayout: false },
      { ...parsed, issues: [] },
      { ...parsed, issues: [issue, issue] },
      { ...parsed, issues: [issue, { ...issue, code: "composition_reading", metric: "Bone Mass" }] },
      { ...parsed, issues: [{ ...issue, code: "unrecognized_reading" }] },
      { ...parsed, issues: [{ ...issue, severity: "review" as const }] },
      { ...parsed, issues: [{ ...issue, metric: "BMI" }] },
      { ...parsed, issues: [{ ...issue, line: 2002 }] },
      { ...parsed, issues: [{ ...issue, line: undefined }] },
    ]) expect(findRenphoSmiUnitRetry(regions, changed)).toBeNull();
  });

  it.each(["SMI 5 6 kg/n}", "SMI 5-6 kg/n}", "SMI 5 to 6 kg/n}", "SMI 5 ± 1 kg/n}", "SMI 5 6", "SMI 5 -6", "SMI 5 +6", "SMI 5 .6", "SMI 1e3 kg/n}", "SMI 1,5 kg/n}", "SMI NaN kg/n}", "SMI 5 kg /n}", "SMI5 kg/n}", "SMI 5kg/n}", " SMI 5 kg/n}", "SMI 5 kg/n} ", `SMI ${"9".repeat(400)} kg/n}`, `SMI 5 ${"x".repeat(25)}`])("does not reinterpret malformed numeric or whitespace evidence: %s", line => {
    const regions = fixture(line);
    const parsed = parseRenphoRegions(fixture());
    expect(findRenphoSmiUnitRetry(regions, parsed)).toBeNull();
  });

  it.each(["SMI 6 kg/m²", "SMI unclear", " SMI 6kg/m²", "SMI(kg/m²) 6"])("refuses a second SMI line even when that line has another format: %s", second => {
    const regions = fixture();
    expect(findRenphoSmiUnitRetry({ ...regions, indicators: `${regions.indicators}${second}` }, parseRenphoRegions(regions))).toBeNull();
  });

  it.each(["kg/m", "kg/m²", "kg/m2", "kg/m^2"])("does not retry an already readable unit: %s", unit => {
    const regions = fixture(`SMI 5 ${unit}`);
    expect(findRenphoSmiUnitRetry(regions, parseRenphoRegions(fixture()))).toBeNull();
  });

  it.each(["kg/m", "kg/m²", "kg/m2", "kg/m^2"])("accepts a freshly read exact unit and preserves the numeric bytes and other evidence: %s", unit => {
    const regions = fixture("smi\t+005.00  kg/n}");
    const before = structuredClone(regions);
    const retry = findRenphoSmiUnitRetry(regions, parseRenphoRegions(regions))!;
    expect(retry).not.toBeNull();
    const updated = applyRenphoSmiUnitRetry(regions, retry, `\n ${unit}\r\n`)!;
    expect(updated).toEqual({ ...before, indicators: before.indicators.replace("kg/n}", unit) });
    expect(regions).toEqual(before);
    const reading = parseRenphoRegions(updated).candidateReadings.find(item => item.key === "smi")!;
    expect(reading).toMatchObject({ value: 5, valueText: "+005.00", line: 2003, metricColumn: 17, unit: "kg/m²" });
  });

  it.each(["", "kg/n}", "kg", "KG/M2", "kg/m3", "kg /m²", "kg/m 2", "kg/m² 5", "5 kg/m²", "kg/m²\nkg/m²", "kg/m² Standard"])("keeps the report unchanged when the isolated reread is not an exact accepted unit: %s", unit => {
    const regions = fixture();
    const before = structuredClone(regions);
    const retry = findRenphoSmiUnitRetry(regions, parseRenphoRegions(regions))!;
    expect(applyRenphoSmiUnitRetry(regions, retry, unit)).toBeNull();
    expect(regions).toEqual(before);
  });

  it("refuses stale source lines, changed prefixes, units, and invalid line indexes", () => {
    const regions = fixture();
    const retry = findRenphoSmiUnitRetry(regions, parseRenphoRegions(regions))!;
    expect(applyRenphoSmiUnitRetry(fixture("SMI +006.00 kg/n}"), retry, "kg/m²")).toBeNull();
    expect(applyRenphoSmiUnitRetry(fixture("SMI +005.00 kg/n?"), retry, "kg/m²")).toBeNull();
    expect(applyRenphoSmiUnitRetry({ ...regions, indicators: `\n${regions.indicators}` }, retry, "kg/m²")).toBeNull();
    for (const lineIndex of [-1, 0, 1.5, 100, NaN, Infinity]) {
      expect(applyRenphoSmiUnitRetry(regions, { ...retry, lineIndex }, "kg/m²")).toBeNull();
    }
    expect(applyRenphoSmiUnitRetry(regions, { ...retry, prefix: "SMI +006.00" }, "kg/m²")).toBeNull();
    expect(applyRenphoSmiUnitRetry(regions, { ...retry, unit: "kg/n?" }, "kg/m²")).toBeNull();
  });

  it("retains the parser's explicit unit-confirmation requirement and canonical provenance after a kg/m reread", () => {
    const regions = fixture();
    const retry = findRenphoSmiUnitRetry(regions, parseRenphoRegions(regions))!;
    const updated = applyRenphoSmiUnitRetry(regions, retry, "kg/m")!;
    const parsed = parseRenphoRegions(updated);
    const smi = parsed.candidateReadings.find(item => item.key === "smi")!;
    expect(smi).toMatchObject({ value: 5, valueText: "+005.00", page: 1, line: 2003, metricColumn: 17, unitNeedsConfirmation: true });
    expect(parsed.issues.some(issue => issue.severity === "error")).toBe(false);
    const athlete: RosterAthlete = { id: "PAC-0001", athlete_code: "PAC-0001", first_name: "Fictional", last_name: "Example", preferred_name: null, pacific_email: "fictional@example.com", profile_photo_url: null, created_at: "", updated_at: "", athlete_seasons: [] };
    const input = { parsed, candidates: [smi], athleteCode: athlete.athlete_code, measuredAt: "2026-09-04", roster: [athlete], existing: [], fileHash: "a".repeat(64), fileName: "fictional-unit-retry.png" };
    expect(() => previewRenphoMeasurements(input)).toThrow("Confirm the Skeletal Muscle Index unit");
    const preview = previewRenphoMeasurements({ ...input, confirmedUnits: ["smi"] });
    expect(preview.canApply).toBe(true);
    expect(preview.candidateMeasurements[0]).toMatchObject({ metric: "Skeletal Muscle Index", value: 5, unit: "kg/m²", source_row: 2003, source_sheet: "RENPHO report · Page 1" });
    expect(JSON.parse(preview.candidateMeasurements[0].id.slice("observation:".length))).toEqual(["a".repeat(64), "RENPHO report · Page 1", 2003, 17]);
  });
});
