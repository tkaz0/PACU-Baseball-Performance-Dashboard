import { MAX_TABLE_COLUMNS, previewMeasurements, type ImportRowResult, type Measurement, type MeasurementPreview } from "@/lib/imports/engine";
import { MAX_RENPHO_PAGES, MAX_RENPHO_READINGS, type RenphoParsedReport, type RenphoReading } from "@/lib/imports/renpho";
import type { RosterAthlete } from "@/lib/types";

export type RenphoMeasurementPreviewInput = {
  parsed: RenphoParsedReport; candidates: RenphoReading[];
  athleteCode: string; measuredAt: string; roster: RosterAthlete[]; existing: Measurement[];
  fileHash: string; fileName: string;
  confirmedUnits?: string[];
};

const IDENTITY_COLUMN = MAX_TABLE_COLUMNS - 1;
const provenanceKey = (reading: RenphoReading) => JSON.stringify([reading.key, reading.page, reading.line, reading.metricColumn]);
const IMMUTABLE_FIELDS = ["key", "metric", "metricColumn", "label", "unit", "page", "line", "rawLabel", "sourceText", "unitEvidence", "unitNeedsConfirmation", "region"] as const;

// OCR line grouping may change between runtimes. Reconcile only this adapter's exact
// file/page/fixed-column provenance, never a metric name or a different report file.
function reportObservationKey(measurement: Measurement): string | null {
  if (!measurement.id.startsWith("observation:") || !/^RENPHO report · Page [1-9]\d*$/.test(measurement.source_sheet)) return null;
  try {
    const parts: unknown = JSON.parse(measurement.id.slice("observation:".length));
    if (!Array.isArray(parts) || parts.length !== 4 || parts[0] !== measurement.file_hash.toLowerCase() || parts[1] !== measurement.source_sheet || parts[2] !== measurement.source_row || !Number.isInteger(parts[3]) || parts[3] < 0 || parts[3] >= IDENTITY_COLUMN) return null;
    return JSON.stringify([parts[0], parts[1], parts[3]]);
  } catch { return null; }
}

/**
 * Previews only; no storage or identity mapping is mutated. Candidate exclusions never
 * renumber a metric or source row. The caller must separately require explicit review.
 */
export function previewRenphoMeasurements(input: RenphoMeasurementPreviewInput): MeasurementPreview {
  const { parsed, candidates, athleteCode, measuredAt, roster, existing, fileHash, fileName } = input;
  if (!candidates.length) throw new Error("Select at least one report reading.");
  if (candidates.length > MAX_RENPHO_READINGS || parsed.candidateReadings.length > MAX_RENPHO_READINGS) throw new Error("Select at most 100 report readings.");
  const available = new Map(parsed.candidateReadings.map(reading => [provenanceKey(reading), reading]));
  if (available.size !== parsed.candidateReadings.length) throw new Error("The parsed report contains duplicate source readings.");
  const selected = new Set<string>();
  const metricKeys = new Set<string>();
  for (const reading of candidates) {
    const key = provenanceKey(reading); const original = available.get(key);
    if (!original || IMMUTABLE_FIELDS.some(field => original[field] !== reading[field])) throw new Error("A selected reading does not match its parsed source. Reload the report before importing.");
    if (reading.unitNeedsConfirmation && !input.confirmedUnits?.includes(reading.key)) throw new Error(`Confirm the ${reading.label} unit against the original report or uncheck this reading before importing.`);
    if (selected.has(key) || metricKeys.has(reading.key)) throw new Error("Select each report metric only once.");
    selected.add(key); metricKeys.add(reading.key);
    if (!Number.isInteger(reading.metricColumn) || reading.metricColumn < 0 || reading.metricColumn >= IDENTITY_COLUMN) throw new Error("The report metric has an invalid fixed source column.");
    if (!Number.isInteger(reading.page) || reading.page < 1 || reading.page > MAX_RENPHO_PAGES || !Number.isInteger(reading.line) || reading.line < 1) throw new Error("The report reading has an invalid source location.");
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(reading.valueText.trim()) || !Number.isFinite(reading.value) || Number(reading.valueText) !== reading.value) throw new Error("Each edited report reading must contain one finite number, with matching numeric and text values.");
  }

  const result: MeasurementPreview = { candidateMeasurements: [], rows: [], counts: { create: 0, update: 0, unchanged: 0, reject: 0 }, issues: [], canApply: false, nameMatches: 0 };
  const previousByField = new Map<string, Measurement[]>();
  for (const measurement of existing) {
    const key = reportObservationKey(measurement);
    if (key) previousByField.set(key, [...(previousByField.get(key) ?? []), measurement]);
  }
  const pages = [...new Set(candidates.map(reading => reading.page))].sort((a, b) => a - b);
  for (const page of pages) {
    const readings = candidates.filter(reading => reading.page === page);
    const columns = new Set<number>();
    for (const reading of readings) {
      if (columns.has(reading.metricColumn)) throw new Error("The report maps more than one metric to the same fixed source column.");
      columns.add(reading.metricColumn);
    }
    const headers = Array.from({ length: MAX_TABLE_COLUMNS }, (_, index) => index === IDENTITY_COLUMN ? "Athlete code" : `Report column ${index + 1}`);
    const rowsByLine = new Map<number, string[]>();
    for (const reading of readings) {
      headers[reading.metricColumn] = reading.metric;
      const cells = rowsByLine.get(reading.line) ?? Array<string>(MAX_TABLE_COLUMNS).fill("");
      cells[IDENTITY_COLUMN] = athleteCode; cells[reading.metricColumn] = reading.valueText.trim();
      rowsByLine.set(reading.line, cells);
    }
    const rowNumbers = [...rowsByLine.keys()].sort((a, b) => a - b);
    const sheetName = `RENPHO report · Page ${page}`;
    const selectedByField = new Map(readings.map(reading => [JSON.stringify([fileHash.toLowerCase(), sheetName, reading.metricColumn]), reading]));
    // Temporary comparison aliases let the ordinary engine compare old semantics at the
    // current OCR location without adding capacity or ever returning rewritten old records.
    const comparisonExisting = existing.map(measurement => {
      const key = reportObservationKey(measurement);
      const reading = key ? selectedByField.get(key) : undefined;
      if (!reading || previousByField.get(key!)?.length !== 1) return measurement;
      return { ...measurement, id: `observation:${JSON.stringify([fileHash.toLowerCase(), sheetName, reading.line, reading.metricColumn])}`, source_row: reading.line };
    });
    const preview = previewMeasurements({ headers, rows: rowNumbers.map(line => rowsByLine.get(line)!), rowNumbers }, {
      identityKind: "code", identityColumn: IDENTITY_COLUMN, fixedDate: measuredAt, dateFormat: "ISO", source: "RENPHO",
      metrics: readings.map(reading => ({ column: reading.metricColumn, label: reading.metric, unit: reading.unit })),
    }, roster, [...comparisonExisting, ...result.candidateMeasurements], { fileHash, fileName, sheetName });
    for (const [key, reading] of selectedByField) {
      if ((previousByField.get(key)?.length ?? 0) < 2) continue;
      const row = preview.rows.find(row => row.row === reading.line)!;
      row.status = "reject";
      row.issues.push({ row: row.row, field: reading.metric, message: "This report metric already has multiple saved observations. Remove its earlier report batches before importing it again." });
    }
    result.candidateMeasurements.push(...preview.candidateMeasurements.filter(measurement => preview.rows.find(row => row.row === measurement.source_row)?.status !== "reject"));
    result.rows.push(...preview.rows); result.issues.push(...preview.rows.flatMap(row => row.issues));
  }
  // A bad source region or ambiguous report cannot be made applicable by excluding its issue.
  for (const issue of parsed.issues.filter(issue => issue.severity === "error")) {
    const importIssue = { row: issue.line ?? 1, field: issue.metric ?? "Report", message: issue.message };
    const row: ImportRowResult = { row: importIssue.row, status: "reject", athlete_code: athleteCode, matchMethod: "none", requiresNameReview: false, changes: [], issues: [importIssue] };
    result.rows.push(row); result.issues.push(importIssue);
  }
  for (const row of result.rows) result.counts[row.status]++;
  result.canApply = result.rows.length > 0 && result.issues.length === 0;
  return result;
}
