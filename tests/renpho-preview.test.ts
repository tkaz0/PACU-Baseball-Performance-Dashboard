import { describe, expect, it } from "vitest";
import { parseRenphoText, type RenphoParsedReport } from "@/lib/imports/renpho";
import { previewRenphoMeasurements, type RenphoMeasurementPreviewInput } from "@/lib/imports/renpho-preview";
import type { RosterAthlete } from "@/lib/types";

// Fictional parser output and athlete; no actual report data.
const roster: RosterAthlete[] = ["LOCAL-0001", "LOCAL-0002"].map(code => ({
  id: code, athlete_code: code, first_name: "Fictional", last_name: "Example", preferred_name: null,
  pacific_email: null, profile_photo_url: null, created_at: "", updated_at: "", athlete_seasons: [],
}));
const fixture = () => parseRenphoText([{ page: 1, lines: ["Weight 10 lb", "Ignored prose", "Body Fat Percentage 15%"] }, { page: 2, lines: ["BMR 1000 kcal"] }]);
function input(parsed = fixture()): RenphoMeasurementPreviewInput {
  return { parsed, candidates: parsed.candidateReadings, athleteCode: "LOCAL-0001", measuredAt: "2026-09-04", roster, existing: [], fileHash: "a".repeat(64), fileName: "fictional-example.pdf" };
}

describe("RENPHO measurement preview integration", () => {
  it("preserves all fixed source columns, lines, pages, values and units without saving private report evidence", () => {
    const preview = previewRenphoMeasurements(input());
    expect(preview.canApply).toBe(true);
    expect(preview.candidateMeasurements).toHaveLength(3);
    expect(preview.candidateMeasurements[0]).toMatchObject({ source: "RENPHO", metric: "Weight", value: 10, unit: "lb", source_row: 1, source_sheet: "RENPHO report · Page 1" });
    expect(JSON.parse(preview.candidateMeasurements[1].id.slice("observation:".length))).toEqual(["a".repeat(64), "RENPHO report · Page 1", 3, 8]);
    expect(preview.candidateMeasurements[2]).toMatchObject({ source_sheet: "RENPHO report · Page 2", source_row: 1 });
    expect(Object.keys(preview.candidateMeasurements[0]).sort()).toEqual(["athlete_code", "file_hash", "id", "measured_at", "metric", "source", "source_file", "source_row", "source_sheet", "unit", "value"].sort());
  });
  it("does not renumber observations when metrics are excluded or selections reordered", () => {
    const source = input(); const full = previewRenphoMeasurements(source);
    const excluded = previewRenphoMeasurements({ ...source, candidates: [source.candidates[2], source.candidates[1]] });
    expect(excluded.candidateMeasurements.map(item => item.id).sort()).toEqual(full.candidateMeasurements.slice(1).map(item => item.id).sort());
    const restored = previewRenphoMeasurements({ ...source, existing: excluded.candidateMeasurements });
    expect(restored.candidateMeasurements.map(item => item.metric)).toEqual(["Weight"]);
    expect(restored.counts).toEqual({ create: 1, update: 0, unchanged: 2, reject: 0 });
  });
  it("makes identical imports unchanged even when the local file is renamed", () => {
    const source = input(); const first = previewRenphoMeasurements(source);
    const repeated = previewRenphoMeasurements({ ...source, existing: first.candidateMeasurements, fileName: "fictional-renamed.pdf" });
    expect(repeated.canApply).toBe(true);
    expect(repeated.candidateMeasurements).toHaveLength(0);
    expect(repeated.counts.unchanged).toBe(3);
  });
  it("reconciles identical file/page/fixed-column readings after OCR line drift without rewriting saved provenance", () => {
    const original = input(); const existing = previewRenphoMeasurements(original).candidateMeasurements;
    const before = JSON.stringify(existing);
    const shifted = fixture(); shifted.candidateReadings.forEach(reading => { reading.line += 10; });
    const repeated = previewRenphoMeasurements({ ...input(shifted), existing });
    expect(repeated.canApply).toBe(true); expect(repeated.counts.unchanged).toBe(3);
    expect(repeated.candidateMeasurements).toHaveLength(0);
    expect(JSON.stringify(existing)).toBe(before);
    expect(repeated.rows.map(row => row.row)).toEqual([11, 13, 11]);
  });
  it("rejects semantic changes after OCR line drift and keeps different files/pages/columns distinct", () => {
    const existing = previewRenphoMeasurements(input()).candidateMeasurements;
    const shifted = fixture(); shifted.candidateReadings.forEach(reading => { reading.line += 10; });
    for (const change of [
      { athleteCode: "LOCAL-0002" }, { measuredAt: "2026-09-05" },
      { candidates: [{ ...shifted.candidateReadings[0], value: 11, valueText: "11" }] },
    ]) {
      const preview = previewRenphoMeasurements({ ...input(shifted), existing, ...change });
      expect(preview.canApply).toBe(false); expect(preview.counts.reject).toBeGreaterThan(0);
      expect(preview.candidateMeasurements).toHaveLength(0);
    }
    const changedUnit = parseRenphoText([{ page: 1, lines: ["Unrelated text", "Weight 10 kg"] }]);
    expect(previewRenphoMeasurements({ ...input(changedUnit), existing }).canApply).toBe(false);
    const otherFile = previewRenphoMeasurements({ ...input(shifted), existing, fileHash: "b".repeat(64) });
    expect(otherFile.candidateMeasurements).toHaveLength(3);
    const otherPage = parseRenphoText([{ page: 3, lines: ["Weight 10 lb"] }]);
    expect(previewRenphoMeasurements({ ...input(otherPage), existing }).candidateMeasurements).toHaveLength(1);
    const otherColumn = parseRenphoText([{ page: 1, lines: ["Bone Mass 10 lb"] }]);
    expect(previewRenphoMeasurements({ ...input(otherColumn), existing }).candidateMeasurements).toHaveLength(1);
  });
  it("allows a reviewed numeric correction and rejects inconsistent, nonfinite or mixed-text edits", () => {
    const source = input();
    const edited = { ...source.candidates[0], value: 0, valueText: "0" };
    expect(previewRenphoMeasurements({ ...source, candidates: [edited] }).candidateMeasurements[0].value).toBe(0);
    for (const candidate of [{ ...edited, valueText: "1" }, { ...edited, value: NaN }, { ...edited, valueText: "0%" }, { ...edited, valueText: "" }, { ...edited, value: 1000, valueText: "1,000" }]) {
      expect(() => previewRenphoMeasurements({ ...source, candidates: [candidate] })).toThrow("one finite number");
    }
  });
  it("requires explicit confirmation for each selected pending unit, preserves its flag and allows exclusion", () => {
    const parsed = parseRenphoText([{ page: 1, lines: ["Weight 10 lb", "SMI 5kg/m²"] }]);
    parsed.candidateReadings[1].unitNeedsConfirmation = true;
    const source = input(parsed);
    expect(() => previewRenphoMeasurements(source)).toThrow("Confirm the Skeletal Muscle Index unit");
    expect(() => previewRenphoMeasurements({ ...source, confirmedUnits: ["weight"] })).toThrow("Confirm");
    expect(previewRenphoMeasurements({ ...source, confirmedUnits: ["smi"] }).canApply).toBe(true);
    expect(previewRenphoMeasurements({ ...source, candidates: [source.candidates[0]] }).canApply).toBe(true);
    expect(() => previewRenphoMeasurements({ ...source, candidates: [{ ...source.candidates[1], unitNeedsConfirmation: undefined }] })).toThrow("does not match");
  });
  it("blocks different athlete, date, value or unit semantics for the same source observation", () => {
    const source = input(); const existing = previewRenphoMeasurements(source).candidateMeasurements;
    for (const changed of [
      { ...source, athleteCode: "LOCAL-0002" }, { ...source, measuredAt: "2026-09-05" },
      { ...source, candidates: [{ ...source.candidates[0], value: 11, valueText: "11" }] },
    ]) {
      const preview = previewRenphoMeasurements({ ...changed, existing });
      expect(preview.canApply).toBe(false);
      expect(preview.issues.some(issue => issue.message.includes("already imported"))).toBe(true);
    }
    const changedUnit = parseRenphoText([{ page: 1, lines: ["Weight 10 kg"] }]);
    expect(previewRenphoMeasurements({ ...input(changedUnit), existing }).canApply).toBe(false);
  });
  it("requires selected readings to retain their parsed metric, unit and provenance", () => {
    const source = input();
    for (const candidate of [{ ...source.candidates[0], unit: "kg" }, { ...source.candidates[0], line: 2 }, { ...source.candidates[0], metricColumn: 9 }, { ...source.candidates[0], sourceText: "Changed" }, { ...source.candidates[0], metric: "Other" }]) {
      expect(() => previewRenphoMeasurements({ ...source, candidates: [candidate] })).toThrow("does not match");
    }
    expect(() => previewRenphoMeasurements({ ...source, candidates: [source.candidates[0], source.candidates[0]] })).toThrow("only once");
    expect(() => previewRenphoMeasurements({ ...source, candidates: [] })).toThrow("at least one");
  });
  it("does not infer the selected athlete/date from report metadata, and blocks unknown athletes", () => {
    const source = input(); source.parsed.reportedDate = "2020-01-01";
    source.parsed.reportedIdentity = { kind: "report_id", value: "FICTIONAL-EXAMPLE", page: 1, line: 1 };
    expect(previewRenphoMeasurements(source).candidateMeasurements.every(item => item.measured_at === "2026-09-04" && item.athlete_code === "LOCAL-0001")).toBe(true);
    expect(previewRenphoMeasurements({ ...source, athleteCode: "LOCAL-9999" }).canApply).toBe(false);
    expect(() => previewRenphoMeasurements({ ...source, measuredAt: "" })).toThrow("test date");
    expect(() => previewRenphoMeasurements({ ...source, measuredAt: "2026-02-30" })).toThrow("valid calendar");
  });
  it("retains parser errors as apply blockers even if only an unrelated valid reading is selected", () => {
    const parsed = parseRenphoText([{ page: 1, lines: ["Weight 10 lb", "BMR NaN kcal"] }]);
    const result = previewRenphoMeasurements(input(parsed));
    expect(result.candidateMeasurements).toHaveLength(1);
    expect(result.canApply).toBe(false);
    expect(result.counts.reject).toBeGreaterThan(0);
  });
  it("enforces aggregate workspace capacity across separate pages", () => {
    const source = input(); const existing = Array.from({ length: 19998 }, (_, index) => ({
      id: `fictional-existing-${index}`, athlete_code: "LOCAL-0001", measured_at: "2026-01-01", source: "Fictional", metric: "Fictional", value: 0,
      unit: "s", source_file: "fictional.csv", source_sheet: "", source_row: index + 1, file_hash: "b".repeat(64),
    }));
    const preview = previewRenphoMeasurements({ ...source, existing });
    expect(preview.canApply).toBe(false);
    expect(preview.issues.some(issue => issue.field === "capacity")).toBe(true);
  });
  it("recognizes OCR-shifted repeats at full capacity and rejects multiple saved versions of the same report field", () => {
    const source = input(); const saved = previewRenphoMeasurements(source).candidateMeasurements;
    const fillers = Array.from({ length: 19997 }, (_, index) => ({ ...saved[0], id: `fictional-filler-${index}`, file_hash: "b".repeat(64) }));
    const shifted = fixture(); shifted.candidateReadings.forEach(reading => { reading.line += 10; });
    const repeat = previewRenphoMeasurements({ ...input(shifted), existing: [...saved, ...fillers] });
    expect(repeat.canApply).toBe(true); expect(repeat.counts.unchanged).toBe(3); expect(repeat.candidateMeasurements).toHaveLength(0);
    const duplicate = { ...saved[0], source_row: 99, id: `observation:${JSON.stringify([source.fileHash, saved[0].source_sheet, 99, source.candidates[0].metricColumn])}` };
    const ambiguous = previewRenphoMeasurements({ ...input(shifted), existing: [...saved, duplicate] });
    expect(ambiguous.canApply).toBe(false);
    expect(ambiguous.issues.some(issue => issue.message.includes("multiple saved observations"))).toBe(true);
  });
  it("supports multiple distinct metric columns on a shared source line", () => {
    const parsed: RenphoParsedReport = fixture(); parsed.candidateReadings[1].line = 1;
    const preview = previewRenphoMeasurements(input(parsed));
    expect(preview.canApply).toBe(true); expect(preview.candidateMeasurements).toHaveLength(3); expect(preview.rows).toHaveLength(2);
  });
});
