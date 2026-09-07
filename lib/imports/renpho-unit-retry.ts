import type { RenphoParsedReport, RenphoRegions } from "./renpho";

export type RenphoSmiUnitRetry = { lineIndex: number; prefix: string; unit: string };

const SMI_LINE = /^(SMI\s+[+-]?(?:\d+(?:\.\d*)?|\.\d+))\s+(\S{1,24})$/i;
const SMI_LABEL = /^SMI(?=$|[\s:(])/i;
const READABLE_UNITS = new Set(["kg/m", "kg/m²", "kg/m2", "kg/m^2"]);

function retryableMatch(line: string): RegExpExecArray | null {
  const match = SMI_LINE.exec(line);
  if (!match || READABLE_UNITS.has(match[2]) || /^[+\-\d.]/.test(match[2]) || !Number.isFinite(Number(match[1].replace(/^SMI\s+/i, "")))) return null;
  return match;
}

// Keep separators as well as lines so a retry cannot alter other source evidence.
function indicatorLines(regions: RenphoRegions): string[] {
  return regions.indicators.split(/(\r?\n)/);
}

function singleSmiLine(parts: string[]): number | null {
  const matches: number[] = [];
  for (let index = 0; index < parts.length; index += 2) {
    if (SMI_LABEL.test(parts[index].trim())) matches.push(index / 2);
  }
  return matches.length === 1 ? matches[0] : null;
}

/** A retry may reread only an unreadable SMI unit, never its numeric value. */
export function findRenphoSmiUnitRetry(regions: RenphoRegions, parsed: RenphoParsedReport): RenphoSmiUnitRetry | null {
  if (!parsed.recognizedLayout) return null;
  const errors = parsed.issues.filter(issue => issue.severity === "error");
  if (errors.length !== 1 || errors[0].code !== "unsupported_unit" || errors[0].metric !== "Skeletal Muscle Index") return null;
  const parts = indicatorLines(regions);
  const lineIndex = singleSmiLine(parts);
  if (lineIndex === null || errors[0].line !== 2000 + lineIndex + 1) return null;
  const match = retryableMatch(parts[lineIndex * 2]);
  if (!match) return null;
  return { lineIndex, prefix: match[1], unit: match[2] };
}

/** Accept only explicit unit text from a fresh isolated read of the printed glyphs. */
export function applyRenphoSmiUnitRetry(regions: RenphoRegions, retry: RenphoSmiUnitRetry, rereadUnit: string): RenphoRegions | null {
  const unit = rereadUnit.trim();
  if (!READABLE_UNITS.has(unit) || !Number.isInteger(retry.lineIndex) || retry.lineIndex < 0) return null;
  const parts = indicatorLines(regions);
  if (singleSmiLine(parts) !== retry.lineIndex) return null;
  const line = parts[retry.lineIndex * 2];
  if (line === undefined) return null;
  const match = retryableMatch(line);
  if (!match || match[1] !== retry.prefix || match[2] !== retry.unit) return null;
  parts[retry.lineIndex * 2] = line.slice(0, line.length - retry.unit.length) + unit;
  return { ...regions, indicators: parts.join("") };
}
