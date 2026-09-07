import { describe, expect, it } from "vitest";
import { parseRenphoRegions, type RenphoRegions } from "@/lib/imports/renpho";
import { applyRenphoPercentageRetry, findRenphoPercentageRetries } from "@/lib/imports/renpho-percentage-retry";

// Marked fictional report only; no source report data is embedded in fixtures.
const fixture = (): RenphoRegions => ({
  title: "Body Composition Analysis Report",
  header: "ID: FICTIONAL-RETRY | Height: 4'6\"inch | Test Date: Oct 2, 2026 at 1:02:03PM",
  compositionHeader: "Measurement(lb)",
  compositionRows: ["Weight", "Body Fat Mass", "Bone Mass", "Protein Mass", "Body Water Mass", "Muscle Mass", "Skeletal Muscle Mass"].map((label, index) => ({ label, measurement: "1", line: index + 1 })),
  assessment: "BMI: 1\nBody Fat Percentage: 23.4 %",
  indicators: "Visceral Fat 1\nSubcutaneous Fat 678 %\nSMI 1.0 kg/m²",
});
const retryFor = (input: RenphoRegions) => findRenphoPercentageRetries(input, parseRenphoRegions(input));

describe("native-pixel percentage retry", () => {
  it("targets only an out-of-range explicit percentage in a recognized isolated region", () => {
    const input = fixture(), retries = retryFor(input);
    expect(retries).toEqual([{ key: "subcutaneous_fat", region: "indicators", lineIndex: 1, sourceText: "Subcutaneous Fat 678 %", valueText: "678" }]);
    expect(retryFor({ ...input, title: "Fictional unverified layout" })).toEqual([]);
    expect(retryFor({ ...input, indicators: input.indicators.replace("678 %", "67.8 %") })).toEqual([]);
  });
  it("recovers a decimal only from agreeing explicit labelled and value-only reads", () => {
    const input = fixture(), original = JSON.stringify(input), retry = retryFor(input)[0];
    const recovered = applyRenphoPercentageRetry(input, retry, "Subcutaneous Fat 67.8 %\n", "67.8%\n");
    expect(recovered).toEqual({ ...input, indicators: input.indicators.replace("678 %", "67.8 %") });
    expect(JSON.stringify(input)).toBe(original);
    const reading = parseRenphoRegions(recovered!).candidateReadings.find(row => row.key === "subcutaneous_fat");
    expect(reading).toMatchObject({ value: 67.8, unit: "%", line: 2002, metricColumn: 11, region: "indicators" });
  });
  it("preserves line separators, other readings and the original metric position", () => {
    const input = fixture(); input.indicators = input.indicators.replace(/\n/g, "\r\n");
    const recovered = applyRenphoPercentageRetry(input, retryFor(input)[0], "Subcutaneous Fat 67.8%", "67.8 %")!;
    expect(recovered.indicators).toBe("Visceral Fat 1\r\nSubcutaneous Fat 67.8 %\r\nSMI 1.0 kg/m²");
    expect(recovered.assessment).toBe(input.assessment);
  });
  it("also supports an explicitly labelled body-fat percentage without mixing regions", () => {
    const input = fixture(); input.assessment = "BMI: 1\nBody Fat Percentage: 234 %";
    const retry = retryFor(input).find(item => item.key === "body_fat_percentage")!;
    const recovered = applyRenphoPercentageRetry(input, retry, "Body Fat Percentage: 23.4 %", "23.4 %")!;
    expect(recovered.assessment).toBe("BMI: 1\nBody Fat Percentage: 23.4 %");
    expect(recovered.indicators).toBe(input.indicators);
  });
  it.each([
    ["Subcutaneous Fat 67.8 %", "6.78 %"], ["Subcutaneous Fat 67.9 %", "67.9 %"],
    ["Subcutaneous Fat 678 %", "678 %"], ["Subcutaneous Fat 67 %", "67 %"],
    ["Subcutaneous Fat 67.8 lb", "67.8 %"], ["Subcutaneous Fat 67.8 %", "67.8"],
    ["Subcutaneous Fat 67.8 %", "67.8 %%"], ["Subcutaneous Fat 67.8 %", "6O.8 %"],
    ["Body Fat Percentage: 67.8 %", "67.8 %"], ["Subcutaneous Fat 67.8-68.0 %", "67.8 %"],
    ["Subcutaneous Fat 67.8 % Standard", "67.8 %"], ["Subcutaneous Fat 67.8 %\nOther 1", "67.8 %"],
    ["Subcutaneous Fat -67.8 %", "-67.8 %"], ["Subcutaneous Fat 6.78 %", "67.8 %"],
  ])("keeps ambiguous or disagreeing OCR results unchanged", (line, value) => {
    const input = fixture(), before = JSON.stringify(input);
    expect(applyRenphoPercentageRetry(input, retryFor(input)[0], line, value)).toBeNull();
    expect(JSON.stringify(input)).toBe(before);
  });
  it("refuses stale evidence, repeated metrics, and malformed source values", () => {
    const input = fixture(), retry = retryFor(input)[0];
    const changed = { ...input, indicators: input.indicators.replace("678 %", "679 %") };
    expect(applyRenphoPercentageRetry(changed, retry, "Subcutaneous Fat 67.8 %", "67.8 %")).toBeNull();
    expect(retryFor({ ...input, indicators: input.indicators + "\nSubcutaneous Fat 678 %" })).toEqual([]);
    for (const malformed of ["6O8 %", "678-679 %", "-678 %", "678 lb", "678 % high"]) {
      expect(retryFor({ ...input, indicators: input.indicators.replace("678 %", malformed) })).toEqual([]);
    }
  });
});
