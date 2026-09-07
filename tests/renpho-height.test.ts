import { describe, expect, it } from "vitest";
import { parseRenphoRegions, type RenphoParsedReport, type RenphoRegions } from "@/lib/imports/renpho";
import { previewRenphoMeasurements } from "@/lib/imports/renpho-preview";
import { prepareReviewedPerformanceRows } from "@/lib/performance-import";
import { getPlayerPerformance } from "@/lib/player-performance";
import type { RosterAthlete } from "@/lib/types";

// Entirely fictional report text and player. No actual report data or identity.
const fixture = (height: string | null): RenphoRegions => ({
  title: "Body Composition Analysis Report",
  header: `ID: FICTIONAL-HEIGHT | Gender: Example | Age: 0 | ${height === null ? "" : `Height: ${height} | `}Test Date: Oct 2, 2026 at 1:02:03PM`,
  compositionHeader: "Measurement(lb)",
  compositionRows: ["Weight", "Body Fat Mass", "Bone Mass", "Protein Mass", "Body Water Mass", "Muscle Mass", "Skeletal Muscle Mass"].map((label, index) => ({ label, measurement: String(index + 1), line: index + 1 })),
  assessment: "BMI 20\nBody Fat Percentage 10%",
  indicators: "Visceral Fat 1\nBMR 1000kcal\nFat-Free Mass 10lb\nSubcutaneous Fat 10%\nSMI 5kg/m²\nMetabolic Age 20\nWHR 0.5",
});
const roster: RosterAthlete[] = [{ id: "SYN-001", athlete_code: "SYN-001", first_name: "Fictional", last_name: "Example", preferred_name: null, pacific_email: null, profile_photo_url: null, created_at: "", updated_at: "", athlete_seasons: [] }];
const preview = (parsed: RenphoParsedReport) => ({ parsed, candidates: parsed.candidateReadings, athleteCode: "SYN-001", measuredAt: parsed.reportedDate!, roster, existing: [], fileHash: "a".repeat(64), fileName: "fictional-height.png" });

describe("explicit RENPHO header height", () => {
  it.each([
    ["4'6\"inch", 54], ["4'0\"inch", 48], ["4′ 6″ inch", 54], ["4’6”", 54], ["4 ' 6.5 \"", 54.5],
  ])("converts only explicit feet/inches %s and keeps isolated printed evidence", (printed, expected) => {
    const result = parseRenphoRegions(fixture(printed), 2);
    expect(result.candidateReadings).toHaveLength(17);
    expect(result.candidateReadings.at(-1)).toEqual({ key: "height", metric: "Height", label: "Height", metricColumn: 21, value: expected, valueText: String(expected), unit: "in", page: 2, line: 3001, rawLabel: "Height", sourceText: `Height: ${printed}`, unitEvidence: "explicit", region: "header" });
    expect(result.issues.filter(issue => issue.severity === "error")).toEqual([]);
    expect(result.reportedDate).toBe("2026-10-02");
  });
  it("works without decorative column separators and with OCR line breaks", () => {
    const input = fixture("4'6\"inch");
    input.header = input.header.replaceAll(" | ", "\n");
    expect(parseRenphoRegions(input).candidateReadings.at(-1)).toMatchObject({ key: "height", value: 54, line: 3001 });
  });
  it.each(["0", "54", "54 in", "137 cm", "4'12\"inch", "4'6inch", "4 6\"inch", "4'6\"cm", "4'6\"inch 5'0\"inch", "4'6\"-5'0\"", "0'0\"inch", "-4'6\"inch", "4'O\"inch", "4'6\"inch Standard", ""])("omits ambiguous or unsupported height %s without blocking other report readings", printed => {
    const parsed = parseRenphoRegions(fixture(printed));
    expect(parsed.candidateReadings.some(reading => reading.key === "height")).toBe(false);
    expect(parsed.issues).toContainEqual(expect.objectContaining({ severity: "review", code: "height_unreadable", metric: "Height" }));
    expect(previewRenphoMeasurements(preview(parsed)).canApply).toBe(true);
  });
  it("does not invent height when absent or choose among repeated Height labels", () => {
    const absent = parseRenphoRegions(fixture(null));
    expect(absent.candidateReadings).toHaveLength(16);
    expect(absent.issues.some(issue => issue.metric === "Height")).toBe(false);
    const duplicate = fixture("4'6\"inch"); duplicate.header = duplicate.header.replace("Test Date:", "Height: 4'7\"inch | Test Date:");
    const parsed = parseRenphoRegions(duplicate);
    expect(parsed.candidateReadings).toHaveLength(16);
    expect(parsed.issues).toContainEqual(expect.objectContaining({ code: "height_ambiguous", severity: "review" }));
  });
  it("never uses another field, report body, or unrecognized layout to obtain height", () => {
    const input = fixture(null); input.indicators += "\nHeight 54in";
    expect(parseRenphoRegions(input).candidateReadings.some(reading => reading.key === "height")).toBe(false);
    expect(parseRenphoRegions({ ...fixture("4'6\"inch"), title: "Unverified report" }).candidateReadings.some(reading => reading.key === "height")).toBe(false);
  });
  it("adds height to older saved reports without renumbering or duplicating existing fields", () => {
    const prior = parseRenphoRegions(fixture(null));
    const current = parseRenphoRegions(fixture("4'6\"inch"));
    expect(current.candidateReadings.slice(0, -1)).toEqual(prior.candidateReadings);
    const existing = previewRenphoMeasurements(preview(prior)).candidateMeasurements;
    const update = previewRenphoMeasurements({ ...preview(current), existing });
    expect(update.canApply).toBe(true);
    expect(update.counts.unchanged).toBe(existing.length);
    expect(update.candidateMeasurements).toHaveLength(1);
    const [height] = update.candidateMeasurements;
    expect(height).toMatchObject({ metric: "Height", value: 54, unit: "in", source: "RENPHO", measured_at: "2026-10-02", source_row: 3001, source_sheet: "RENPHO report · Page 1" });
    expect(JSON.parse(height.id.slice(12))).toEqual(["a".repeat(64), "RENPHO report · Page 1", 3001, 21]);
    expect(JSON.stringify(height)).not.toContain("FICTIONAL-HEIGHT");
    expect(JSON.stringify(height)).not.toContain("Height:");
    expect(previewRenphoMeasurements({ ...preview(current), existing: [...existing, height] }).candidateMeasurements).toEqual([]);
    expect(prepareReviewedPerformanceRows([height])).toEqual([expect.objectContaining({ metric_key: "height", unit: "in", value: 54, source: "RENPHO", measured_at: "2026-10-02" })]);
    const profile = getPlayerPerformance({ readings: [height], athleteCode: "SYN-001" });
    expect(profile.body.find(card => card.metric.key === "height")?.latest).toMatchObject({ value: 54, unit: "in", period: "fall_2026", measuredAt: "2026-10-02", source: "RENPHO", derived: false });
  });
});
