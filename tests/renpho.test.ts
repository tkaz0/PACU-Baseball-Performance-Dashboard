import { describe, expect, it } from "vitest";
import { MAX_RENPHO_TEXT_CHARACTERS, parseRenphoRegions, parseRenphoText, type RenphoRegions } from "@/lib/imports/renpho";

// Entirely fictional synthetic text. These tests do not contain an actual report or health data.
const text = (...lines: string[]) => parseRenphoText([{ page: 1, lines }]);
function regions(): RenphoRegions {
  return {
    title: "Body Composition Analysis Report",
    header: "ID: FICTIONAL-EXAMPLE Gender: Example Age: 0 Height: 0 Test Date: February 29, 2024 at 12:01:02 AM",
    compositionHeader: "Measurement(lb)",
    compositionRows: ["Weight", "Body Fat Mass", "Bone Mass", "Protein Mass", "Body Water Mass", "Muscle Mass", "Skeletal\nMuscle Mass"]
      .map((label, index) => ({ label, measurement: String(index), line: index + 1 })),
    assessment: "Obesity Assessment\nBMI 20\nLow Standard High\nBody Fat Percentage 15%\nObesity Assessment 100%",
    indicators: "Other Indicators\nVisceral Fat 1\nBMR 1000kcal\nFat-Free Mass 10lb\nSubcutaneous Fat 15%\nSMI 5kg/m²\nMetabolic Age 20\nWHR 0.5",
  };
}

describe("explicit labelled report text (synthetic, unverified layouts)", () => {
  it("extracts only whole-line readings with explicit units, preserves zero, negatives and percentage points", () => {
    const result = text("Weight: 0 lb", "Body Fat Percentage 15%", "Muscle Mass -2 kg", "BMI(kg/m²): 20", "Metabolic Age 20 yrs");
    expect(result.candidateReadings.map(item => [item.key, item.value, item.unit])).toEqual([
      ["weight", 0, "lb"], ["body_fat_percentage", 15, "%"], ["muscle_mass", -2, "kg"], ["bmi", 20, "kg/m²"], ["metabolic_age", 20, "years"],
    ]);
    expect(result.candidateReadings.every(item => item.unitEvidence === "explicit")).toBe(true);
    expect(result).toMatchObject({ reportedDate: null, reportedIdentity: null, requiresReview: true, formatVerified: false, recognizedLayout: false });
    expect(result.issues.filter(issue => issue.severity === "error")).toEqual([]);
  });
  it.each(["NaN kg", "Infinity lb", "1e3 kg", "1,23 kg", "1,000 kg", "10 to 20 lb", "10-20 lb", "<10 lb", "10 ± 2 lb", "10 kg Standard", "10 kg 20 kg", "10", "10 stone", "(kg) 10 lb"])("rejects an ambiguous or unsupported reading: %s", suffix => {
    const result = text(`Weight ${suffix}`);
    expect(result.candidateReadings).toEqual([]);
    expect(result.issues.some(issue => issue.severity === "error")).toBe(true);
  });
  it("does not look ahead across lines or import unknown metrics", () => {
    expect(text("Weight", "10 lb").candidateReadings).toEqual([]);
    expect(text("A mysterious index 7 ratio", "Target Weight 10 lb", "Left Arm 5 lb").candidateReadings).toEqual([]);
  });
  it("removes every duplicate canonical reading across aliases, units or pages", () => {
    const result = parseRenphoText([{ page: 1, lines: ["Weight 10 lb", "Body Fat 15%"] }, { page: 2, lines: ["Body Weight 20 kg", "Body Fat Percentage 15%", "Bone Mass 1 lb"] }]);
    expect(result.candidateReadings.map(item => item.key)).toEqual(["bone_mass"]);
    expect(result.issues.filter(issue => issue.code === "duplicate_metric")).toHaveLength(4);
  });
  it("keeps canonical metric columns and source locations independent of candidate selection", () => {
    const complete = text("Weight 10 lb", "Unrelated prose", "SMI 5 kg/m2");
    const single = text("Unrelated prose", "Another ignored line", "SMI 5 kg/m^2");
    expect(complete.candidateReadings[1].metricColumn).toBe(single.candidateReadings[0].metricColumn);
    expect(single.candidateReadings[0]).toMatchObject({ page: 1, line: 3, valueText: "5", unit: "kg/m²", sourceText: "SMI 5 kg/m^2" });
  });
  it("separates explicitly percentage-labelled muscle/bone measurements from mass measurements", () => {
    expect(text("Bone Mass 1 kg", "Bone Mass 2%", "Muscle Mass 3 lb", "Muscle Mass 4%").candidateReadings.map(item => item.key)).toEqual(["bone_mass", "bone_mass_percentage", "muscle_mass", "muscle_mass_percentage"]);
  });
  it("bounds page count, page numbers, text size and recognized reading count", () => {
    expect(() => parseRenphoText([])).toThrow("1–20");
    expect(() => parseRenphoText(Array.from({ length: 21 }, (_, index) => ({ page: index + 1, lines: [] })))).toThrow("1–20");
    expect(() => parseRenphoText([{ page: 1, lines: [] }, { page: 1, lines: [] }])).toThrow("unique");
    expect(() => parseRenphoText([{ page: 0, lines: [] }])).toThrow("positive");
    expect(() => text("x".repeat(MAX_RENPHO_TEXT_CHARACTERS))).toThrow("100,000");
    expect(() => text(...Array.from({ length: 101 }, () => "Weight 1 kg"))).toThrow("100 recognized");
  });
});

describe("geometry-isolated RENPHO portrait regions (fictional fixtures)", () => {
  it("recognizes anchors, extracts all 16 supported readings and uses the isolated measurement header", () => {
    const result = parseRenphoRegions(regions());
    expect(result).toMatchObject({ recognizedLayout: true, formatVerified: true, requiresReview: true, reportedDate: "2024-02-29", reportedIdentity: { kind: "report_id", value: "FICTIONAL-EXAMPLE" } });
    expect(result.candidateReadings).toHaveLength(16);
    expect(result.issues.filter(issue => issue.severity === "error")).toEqual([]);
    expect(result.candidateReadings[0]).toMatchObject({ key: "weight", value: 0, unit: "lb", unitEvidence: "composition-header", region: "composition", line: 1 });
    expect(result.candidateReadings.find(item => item.key === "skeletal_muscle_mass")).toMatchObject({ value: 6, rawLabel: "Skeletal\nMuscle Mass" });
    expect(result.candidateReadings.find(item => item.key === "body_fat_percentage")).toMatchObject({ value: 15, unit: "%", unitEvidence: "explicit" });
    expect(result.candidateReadings.find(item => item.key === "bmi")).toMatchObject({ unit: "kg/m²", unitEvidence: "layout-label" });
    expect(result.candidateReadings.find(item => item.key === "visceral_fat")).toMatchObject({ unit: "index", unitEvidence: "dimensionless-index" });
    expect(result.candidateReadings.find(item => item.key === "metabolic_age")).toMatchObject({ unit: "years", unitEvidence: "layout-label" });
    expect(result.candidateReadings.find(item => item.key === "whr")).toMatchObject({ unit: "ratio", unitEvidence: "dimensionless-index" });
  });
  it("honors kg headers without conversion and never parses an optimal range or appended cell unit", () => {
    const source = regions(); source.compositionHeader = "Measurement (kg)"; source.compositionRows[0].measurement = "-2";
    expect(parseRenphoRegions(source).candidateReadings[0]).toMatchObject({ value: -2, unit: "kg" });
    for (const invalid of ["2 3-4", "2 kg", "2%", "2 lb Standard", "NaN", "Infinity", "1,2", "1,000", "1O", "", "-2-4"]) {
      source.compositionRows[0].measurement = invalid;
      const result = parseRenphoRegions(source);
      expect(result.candidateReadings.some(item => item.key === "weight")).toBe(false);
      expect(result.issues.some(issue => issue.code === "composition_reading")).toBe(true);
    }
  });
  it("proposes an unreadable SMI exponent only in the recognized layout and marks explicit confirmation required", () => {
    const result = parseRenphoRegions({ ...regions(), indicators: "SMI -0.25kg/m" });
    expect(result.candidateReadings.find(reading => reading.key === "smi")).toMatchObject({ value: -0.25, valueText: "-0.25", unit: "kg/m²", sourceText: "SMI -0.25kg/m", unitEvidence: "layout-label", unitNeedsConfirmation: true });
    expect(result.issues.filter(issue => issue.code === "smi_unit_confirmation")).toHaveLength(1);
    expect(result.issues.some(issue => issue.severity === "error")).toBe(false);
    expect(text("SMI 5kg/m").candidateReadings).toHaveLength(0);
    expect(parseRenphoRegions({ ...regions(), title: "Other report", indicators: "SMI 5kg/m" }).candidateReadings.some(reading => reading.key === "smi")).toBe(false);
    for (const indicators of ["SMI 5kg", "SMI 5kg/m3", "SMI 5kg/m Standard", "SMI NaNkg/m", "WHR 5kg/m"]) {
      expect(parseRenphoRegions({ ...regions(), indicators }).candidateReadings.some(reading => reading.region === "indicators")).toBe(false);
    }
    expect(parseRenphoRegions({ ...regions(), indicators: "SMI 5kg/m²" }).candidateReadings.find(reading => reading.key === "smi")?.unitNeedsConfirmation).toBeUndefined();
  });
  it("corrects only isolated known Fat-Free Mass lb unit glyphs, with original evidence and unchanged numbers", () => {
    for (const reading of ["10.5 Ib", "10.5Ib", "10.5 1b"]) {
      const result = parseRenphoRegions({ ...regions(), indicators: `Fat-Free Mass ${reading}` });
      expect(result.candidateReadings.find(candidate => candidate.key === "fat_free_mass")).toMatchObject({ value: 10.5, valueText: "10.5", unit: "lb", unitEvidence: "ocr-unit-correction", sourceText: `Fat-Free Mass ${reading}` });
      expect(result.issues.some(issue => issue.code === "mass_unit_ocr" && issue.severity === "review")).toBe(true);
    }
    for (const reading of ["10.51b", "10.5 |b", "10.5 ib", "1O.5 Ib", "10.5 Ib Standard"]) {
      expect(parseRenphoRegions({ ...regions(), indicators: `Fat-Free Mass ${reading}` }).candidateReadings.some(candidate => candidate.key === "fat_free_mass")).toBe(false);
    }
    expect(text("Fat-Free Mass 10.5 Ib").candidateReadings).toHaveLength(0);
    expect(parseRenphoRegions({ ...regions(), title: "Other report", indicators: "Fat-Free Mass 10.5 Ib" }).candidateReadings.some(candidate => candidate.key === "fat_free_mass")).toBe(false);
  });
  it.each(["Measurement(st)", "Measurement", "Optimal Range(lb)", "Measurement(lb) Optimal Range(lb)"])("rejects unsupported or contaminated measurement header %s", compositionHeader => {
    const result = parseRenphoRegions({ ...regions(), compositionHeader });
    expect(result.recognizedLayout).toBe(false);
    expect(result.candidateReadings.some(item => item.region === "composition")).toBe(false);
    expect(result.issues.some(issue => issue.code === "composition_unit")).toBe(true);
  });
  it("does not enable implicit layout units without title, ID, date and all seven exact labels", () => {
    const missingLabel = regions(); missingLabel.compositionRows[0].label = "Unknown";
    const duplicateLabel = regions(); duplicateLabel.compositionRows[0].label = "Bone Mass";
    for (const source of [{ ...regions(), title: "Other Report" }, { ...regions(), header: "Test Date: February 29, 2024 at 1:00:00 PM" }, { ...regions(), header: "ID: FICTIONAL-EXAMPLE" }, missingLabel, duplicateLabel]) {
      const result = parseRenphoRegions(source);
      expect(result.recognizedLayout).toBe(false);
      expect(result.candidateReadings.some(item => ["bmi", "whr", "visceral_fat", "metabolic_age"].includes(item.key))).toBe(false);
      expect(result.issues.some(issue => issue.severity === "error")).toBe(true);
    }
  });
  it("accepts explicit English three-letter months and an attached AM/PM marker", () => {
    const result = parseRenphoRegions({ ...regions(), header: "ID: FICTIONAL-EXAMPLE Test Date: Sep 3, 2026 at 1:02:03PM" });
    expect(result.reportedDate).toBe("2026-09-03");
    expect(result.recognizedLayout).toBe(true);
  });
  it.each(["February 29, 2023 at 1:00:00 PM", "February 30, 2024 at 1:00:00 PM", "September 4, 2026 at 13:00:00 PM", "September 4, 2026 at 0:00:00 AM", "September 4, 2026 at 1:60:00 PM", "09/04/2026", "Se 4, 2026 at 1:00:00 PM"])("rejects invalid or unverified Test Date syntax: %s", date => {
    const result = parseRenphoRegions({ ...regions(), header: `ID: FICTIONAL-20260904 Test Date: ${date}` });
    expect(result.reportedDate).toBeNull();
    expect(result.issues.some(issue => issue.code === "report_date")).toBe(true);
  });
  it("does not infer identity or dates from other header fields or duplicate metadata", () => {
    const source = regions(); source.header = "ID: FICTIONAL-20260904 Test Date: September 4, 2026 at 1:00:00 PM ID: FICTIONAL-SECOND";
    expect(parseRenphoRegions(source).reportedIdentity).toBeNull();
    source.header = "ID: FICTIONAL-20260904 Test Date: September 4, 2026 at 1:00:00 PM Test Date: September 5, 2026 at 1:00:00 PM";
    expect(parseRenphoRegions(source).reportedDate).toBeNull();
    source.header = "Name: Fictional Example ID: FICTIONAL-20260904";
    expect(parseRenphoRegions(source).reportedDate).toBeNull();
    expect(parseRenphoRegions(source).reportedIdentity?.value).toBe("FICTIONAL-20260904");
  });
  it("removes repeated indicator readings and rejects mixed units, range/classification numbers or percentages on unitless indices", () => {
    for (const indicators of ["BMR 1000kcal\nBMR 2000kcal", "WHR 0.5%", "SMI 5kg", "Visceral Fat 1 2 3", "Metabolic Age 20 Standard"]) {
      const result = parseRenphoRegions({ ...regions(), indicators });
      expect(result.candidateReadings.filter(item => item.region === "indicators")).toHaveLength(0);
      expect(result.issues.some(issue => issue.severity === "error")).toBe(true);
    }
  });
  it("leaves source text intact and keeps fixed metric indices with stable regional line offsets", () => {
    const result = parseRenphoRegions(regions(), 2);
    expect(result.candidateReadings.find(item => item.key === "bmi")).toMatchObject({ sourceText: "BMI 20", page: 2, line: 1002, metricColumn: 7 });
    expect(result.candidateReadings.find(item => item.key === "whr")).toMatchObject({ sourceText: "WHR 0.5", page: 2, line: 2008, metricColumn: 18 });
  });
  it("enforces text, row and page limits before candidate extraction", () => {
    expect(() => parseRenphoRegions(regions(), 21)).toThrow("1 and 20");
    expect(() => parseRenphoRegions({ ...regions(), header: "x".repeat(MAX_RENPHO_TEXT_CHARACTERS) })).toThrow("100,000");
    expect(() => parseRenphoRegions({ ...regions(), compositionRows: Array.from({ length: 101 }, () => ({ label: "Weight", measurement: "1", line: 1 })) })).toThrow("100 composition");
    expect(() => parseRenphoRegions({ ...regions(), compositionRows: [{ label: "Weight", measurement: "1", line: 0 }] })).toThrow("positive integers");
  });
});
