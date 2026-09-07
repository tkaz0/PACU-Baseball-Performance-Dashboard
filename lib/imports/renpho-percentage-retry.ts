import type { RenphoParsedReport, RenphoRegions } from "./renpho";

export type RenphoPercentageRetry = {
  key: "body_fat_percentage" | "subcutaneous_fat";
  region: "assessment" | "indicators";
  lineIndex: number;
  sourceText: string;
  valueText: string;
};
const definitions = [
  { key: "body_fat_percentage", region: "assessment", offset: 1000, label: "Body Fat(?: Percentage)?" },
  { key: "subcutaneous_fat", region: "indicators", offset: 2000, label: "Subcutaneous Fat" },
] as const;
const percentage = /^([0-9]+(?:\.[0-9]+)?)\s*%$/;
const labelled = (label: string) => new RegExp(`^(${label}\\s*:?\\s+)([0-9]+(?:\\.[0-9]+)?)\\s*%$`, "i");
const lines = (regions: RenphoRegions, region: RenphoPercentageRetry["region"]) => regions[region].split(/(\r?\n)/);

/** Retry only explicit, isolated percentages whose OCR result exceeds 100. */
export function findRenphoPercentageRetries(regions: RenphoRegions, parsed: RenphoParsedReport): RenphoPercentageRetry[] {
  if (!parsed.recognizedLayout) return [];
  return definitions.flatMap(definition => {
    const readings = parsed.candidateReadings.filter(reading => reading.key === definition.key && reading.region === definition.region && reading.unit === "%" && reading.value > 100);
    if (readings.length !== 1) return [];
    const reading = readings[0], lineIndex = reading.line - definition.offset - 1;
    if (!Number.isInteger(lineIndex) || lineIndex < 0) return [];
    const sourceText = lines(regions, definition.region)[lineIndex * 2];
    if (sourceText === undefined || sourceText !== reading.sourceText) return [];
    const match = labelled(definition.label).exec(sourceText.trim());
    if (!match || Number(match[2]) !== reading.value) return [];
    return [{ key: definition.key, region: definition.region, lineIndex, sourceText, valueText: match[2] }];
  });
}

/** Two separate native-pixel reads must agree; never supply or substitute a digit. */
export function applyRenphoPercentageRetry(regions: RenphoRegions, retry: RenphoPercentageRetry, rereadLine: string, rereadValue: string): RenphoRegions | null {
  if (rereadLine.length > 200 || rereadValue.length > 80) return null;
  const definition = definitions.find(item => item.key === retry.key && item.region === retry.region);
  if (!definition || !Number.isInteger(retry.lineIndex) || retry.lineIndex < 0) return null;
  const parts = lines(regions, retry.region), original = parts[retry.lineIndex * 2];
  if (original !== retry.sourceText) return null;
  const previous = labelled(definition.label).exec(original.trim());
  const full = labelled(definition.label).exec(rereadLine.trim()), value = percentage.exec(rereadValue.trim());
  if (!previous || previous[2] !== retry.valueText || Number(previous[2]) <= 100 || !full || !value || full[2] !== value[1]
    || !Number.isFinite(Number(value[1])) || Number(value[1]) > 100) return null;
  // A missing decimal is recovered only when both fresh reads contain it and
  // retain every original digit in order. Other numeric disagreements stay manual.
  if (!value[1].includes(".") || value[1].replace(/\./g, "") !== previous[2].replace(/\./g, "")) return null;
  parts[retry.lineIndex * 2] = original.replace(previous[2], value[1]);
  return { ...regions, [retry.region]: parts.join("") };
}
