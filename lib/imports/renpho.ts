/**
 * Conservative candidates from explicit labelled text, not a verified RENPHO PDF layout.
 * Official label sources (reviewed 2026-09-04):
 * https://renpho.com/products/morphoscan-nova-body-composition-analyzer
 * https://renpho.com/pages/faq-for-renpho-health-app
 * Region parser additionally recognizes the owner-provided portrait report layout.
 * No file I/O, network, storage, account matching, date guessing, OCR, or interpretation.
 */
export const RENPHO_PARSER_VERSION = "renpho-explicit-text-v1" as const;
export const MAX_RENPHO_PAGES = 20;
export const MAX_RENPHO_TEXT_CHARACTERS = 100000;
export const MAX_RENPHO_READINGS = 100;

export type RenphoTextPage = { page: number; lines: string[] };
export type RenphoReading = {
  key: string; metric: string; metricColumn: number; label: string; value: number; valueText: string;
  unit: string; page: number; line: number; rawLabel: string; sourceText: string;
  unitEvidence: "explicit" | "composition-header" | "layout-label" | "dimensionless-index" | "ocr-unit-correction";
  unitNeedsConfirmation?: true;
  region?: "composition" | "assessment" | "indicators";
};
export type RenphoIssue = {
  severity: "error" | "review"; code: string; message: string;
  page?: number; line?: number; metric?: string;
};
export type RenphoParsedReport = {
  parserVersion: typeof RENPHO_PARSER_VERSION; candidateReadings: RenphoReading[];
  reportedDate: string | null;
  reportedIdentity: { kind: "report_id"; value: string; page: number; line: number } | null;
  issues: RenphoIssue[]; requiresReview: true; formatVerified: boolean; recognizedLayout: boolean;
};
export type RenphoRegions = {
  title: string; header: string; compositionHeader: string;
  compositionRows: { label: string; measurement: string; line: number }[];
  assessment: string; indicators: string;
};

type MetricDefinition = { key: string; label: string; aliases: readonly string[]; units: readonly string[] };
const MASS_UNITS = ["kg", "lb"] as const;
const PERCENT_UNITS = ["%"] as const;
// Append only: these positions are stable metric columns for observation provenance.
const METRICS: readonly MetricDefinition[] = [
  { key: "weight", label: "Weight", aliases: ["Weight", "Body Weight"], units: [...MASS_UNITS, "st"] },
  { key: "body_fat_mass", label: "Body Fat Mass", aliases: ["Body Fat Mass"], units: MASS_UNITS },
  { key: "bone_mass", label: "Bone Mass", aliases: ["Bone Mass"], units: MASS_UNITS },
  { key: "protein_mass", label: "Protein Mass", aliases: ["Protein Mass"], units: MASS_UNITS },
  { key: "body_water_mass", label: "Body Water Mass", aliases: ["Body Water Mass"], units: MASS_UNITS },
  { key: "muscle_mass", label: "Muscle Mass", aliases: ["Muscle Mass"], units: MASS_UNITS },
  { key: "skeletal_muscle_mass", label: "Skeletal Muscle Mass", aliases: ["Skeletal Muscle Mass"], units: MASS_UNITS },
  { key: "bmi", label: "BMI", aliases: ["BMI"], units: ["kg/m²"] },
  { key: "body_fat_percentage", label: "Body Fat Percentage", aliases: ["Body Fat Percentage", "Body Fat"], units: PERCENT_UNITS },
  { key: "bmr", label: "BMR", aliases: ["Basal Metabolic Rate (BMR)", "Basal Metabolic Rate", "BMR"], units: ["kcal", "kcal/day"] },
  { key: "fat_free_mass", label: "Fat-Free Mass", aliases: ["Fat-Free Mass", "Fat Free Mass", "Fat-Free Body Mass", "Fat-Free Body Weight"], units: MASS_UNITS },
  { key: "subcutaneous_fat", label: "Subcutaneous Fat", aliases: ["Subcutaneous Fat"], units: PERCENT_UNITS },
  { key: "skeletal_muscle_percentage", label: "Skeletal Muscle Percentage", aliases: ["Skeletal Muscle", "Skeletal Muscle Percentage"], units: PERCENT_UNITS },
  { key: "body_water_percentage", label: "Body Water Percentage", aliases: ["Body Water", "Body Water Percentage"], units: PERCENT_UNITS },
  { key: "protein_percentage", label: "Protein Percentage", aliases: ["Protein", "Protein Percentage"], units: PERCENT_UNITS },
  { key: "metabolic_age", label: "Metabolic Age", aliases: ["Metabolic Age"], units: ["years"] },
  { key: "visceral_fat", label: "Visceral Fat", aliases: ["Visceral Fat", "Visceral Fat Grade", "Visceral Fat Index"], units: ["index", "grade"] },
  { key: "smi", label: "Skeletal Muscle Index", aliases: ["Skeletal Muscle Index (SMI)", "Skeletal Muscle Index", "SMI"], units: ["kg/m²"] },
  { key: "whr", label: "Waist-to-Hip Ratio", aliases: ["Waist-to-Hip Ratio (WHR)", "WHR (Waist-to-Hip Ratio)", "Waist-to-Hip Ratio", "Waist-Hip Ratio", "WHR"], units: ["ratio"] },
  { key: "bone_mass_percentage", label: "Bone Mass Percentage", aliases: ["Bone Mass"], units: PERCENT_UNITS },
  { key: "muscle_mass_percentage", label: "Muscle Mass Percentage", aliases: ["Muscle Mass"], units: PERCENT_UNITS },
];

const normalize = (value: string) => value.replace(/[\u2010-\u2014\u2212]/g, "-").replace(/[\u00a0\t ]+/g, " ").trim();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ALIASES = Array.from(new Set(METRICS.flatMap(metric => [...metric.aliases])))
  .sort((a, b) => b.length - a.length)
  .map(label => ({ label, pattern: new RegExp(`^${escape(label)}(?=$|[\\s:(])`, "i") }));

function normalizeUnit(value: string): string {
  const unit = value.trim().toLowerCase().replace(/\s+/g, "");
  if (unit === "lbs") return "lb";
  if (unit === "kg/m2" || unit === "kg/m^2") return "kg/m²";
  if (["year", "yr", "yrs"].includes(unit)) return "years";
  return unit;
}

/** Source lines must already preserve page/line geometry; adjacent columns are never joined here. */
export function parseRenphoText(pages: RenphoTextPage[]): RenphoParsedReport {
  if (!pages.length || pages.length > MAX_RENPHO_PAGES) throw new Error("Use a report with 1–20 text pages.");
  if (pages.some(page => !Number.isInteger(page.page) || page.page < 1) || new Set(pages.map(page => page.page)).size !== pages.length) throw new Error("Report page numbers must be positive and unique.");
  if (pages.reduce((total, page) => total + page.lines.reduce((length, line) => length + line.length + 1, 0), 0) > MAX_RENPHO_TEXT_CHARACTERS) throw new Error("The report text exceeds the 100,000-character limit.");
  const issues: RenphoIssue[] = [{ severity: "review", code: "unverified_layout", message: "These are candidates from explicit labels and units. This report layout is not verified; compare every reading with the original and select its athlete and test date." }];
  const found: RenphoReading[] = [];
  const occurrences = new Map<string, { page: number; line: number; label: string }[]>();
  let recognizedReadings = 0;

  for (const page of pages) {
    page.lines.forEach((sourceText, lineIndex) => {
      const line = lineIndex + 1;
      const text = normalize(sourceText);
      const alias = ALIASES.find(item => item.pattern.test(text));
      if (!alias) return; // Report prose, targets, ranges and classifications are not metric aliases.
      if (++recognizedReadings > MAX_RENPHO_READINGS) throw new Error("The report contains more than 100 recognized reading lines. Use one report at a time.");
      const definitions = METRICS.map((definition, metricColumn) => ({ ...definition, metricColumn }))
        .filter(definition => definition.aliases.some(label => label.toLowerCase() === alias.label.toLowerCase()));
      const metricLabel = definitions[0].label;
      const addIssue = (code: string, message: string) => issues.push({ severity: "error", code, message, page: page.page, line, metric: metricLabel });
      let remainder = text.slice(alias.label.length).trim().replace(/^:\s*/, "");
      let headerUnit = "";
      const inLabel = /^\(([^()]{1,24})\)\s*:?\s*(.*)$/.exec(remainder);
      if (inLabel) { headerUnit = normalizeUnit(inLabel[1]); remainder = inLabel[2]; }

      // A recognized metric line with several numbers must never supply its first number.
      if (/[<>≤≥±]|\d\s*[-–—]\s*[+-]?\d|\d\s+to\s+[+-]?\d/i.test(remainder)) {
        addIssue("range_or_inequality", "A range, inequality or uncertainty was found instead of one explicit reading."); return;
      }
      if (remainder.includes(",")) { addIssue("ambiguous_number", "Comma decimal/grouping formats need explicit normalization; no value was guessed."); return; }
      const reading = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*([^\d\s][^\s]*|)?$/.exec(remainder);
      if (!reading || !Number.isFinite(Number(reading[1]))) {
        addIssue("unrecognized_reading", "Expected one finite number and an explicit unit on the same line. Extra values, classifications or text were not imported."); return;
      }
      const suffixUnit = normalizeUnit(reading[2] ?? "");
      if (headerUnit && suffixUnit && headerUnit !== suffixUnit) { addIssue("conflicting_units", "The unit in the label conflicts with the unit after the value."); return; }
      const unit = suffixUnit || headerUnit;
      if (!unit) { addIssue("missing_unit", "The source does not explicitly give a unit for this reading; no unit was inferred."); return; }
      const definition = definitions.find(metric => metric.units.includes(unit));
      if (!definition) { addIssue("unsupported_unit", "This metric does not support the explicitly printed unit. No conversion or reassignment was attempted."); return; }
      const locations = occurrences.get(definition.key) ?? [];
      locations.push({ page: page.page, line, label: definition.label });
      occurrences.set(definition.key, locations);
      found.push({ key: definition.key, metric: definition.label, metricColumn: definition.metricColumn, label: definition.label,
        value: Number(reading[1]), valueText: reading[1], unit, page: page.page, line, rawLabel: sourceText.trim().slice(0, alias.label.length), sourceText, unitEvidence: "explicit" });
    });
  }
  const duplicateKeys = new Set<string>();
  for (const [key, locations] of occurrences) {
    if (locations.length < 2) continue;
    duplicateKeys.add(key);
    for (const location of locations) issues.push({ severity: "error", code: "duplicate_metric", message: "This metric appears more than once. All its candidates were removed; choose a report containing one unambiguous reading per metric.", page: location.page, line: location.line, metric: location.label });
  }
  const candidateReadings = found.filter(reading => !duplicateKeys.has(reading.key));
  if (!candidateReadings.length) issues.push({ severity: "error", code: "no_candidates", message: "No unambiguous supported readings were found. A sample report or structured export is needed to verify its layout." });
  return { parserVersion: RENPHO_PARSER_VERSION, candidateReadings, reportedDate: null, reportedIdentity: null, issues, requiresReview: true, formatVerified: false, recognizedLayout: false };
}

const COMPOSITION_KEYS = METRICS.slice(0, 7).map(metric => metric.key);
const ASSESSMENT_KEYS = ["bmi", "body_fat_percentage"];
const INDICATOR_KEYS = ["visceral_fat", "bmr", "fat_free_mass", "subcutaneous_fat", "smi", "metabolic_age", "whr"];
const LAYOUT_UNITS: Readonly<Record<string, { unit: string; evidence: RenphoReading["unitEvidence"] }>> = {
  bmi: { unit: "kg/m²", evidence: "layout-label" },
  visceral_fat: { unit: "index", evidence: "dimensionless-index" },
  metabolic_age: { unit: "years", evidence: "layout-label" },
  whr: { unit: "ratio", evidence: "dimensionless-index" },
};
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function reportedTestDate(header: string): string | null {
  const labels = [...header.matchAll(/\bTest\s+Date\s*[:：]/gi)];
  if (labels.length !== 1) return null;
  const rest = header.slice((labels[0].index ?? 0) + labels[0][0].length).trim();
  const match = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+at\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)\b/i.exec(rest);
  if (!match) return null;
  // The provided portrait report prints an English three-letter month abbreviation.
  // Accept full names too, but never use locale-dependent Date.parse.
  const monthLabel = match[1].toLowerCase();
  const month = MONTHS.findIndex(name => name === monthLabel || name.slice(0, 3) === monthLabel);
  const day = Number(match[2]); const year = Number(match[3]);
  if (month < 0 || year < 1900 || year > 9999 || Number(match[4]) < 1 || Number(match[4]) > 12 || Number(match[5]) > 59 || Number(match[6]) > 59) return null;
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Only pass geometry-isolated regions from the supported portrait report. In particular,
 * composition measurements must exclude the neighboring optimal-range/evaluation columns.
 * Text/identity evidence is for temporary review and must not be copied into saved metrics.
 */
export function parseRenphoRegions(regions: RenphoRegions, page = 1): RenphoParsedReport {
  if (!Number.isInteger(page) || page < 1 || page > MAX_RENPHO_PAGES) throw new Error("Report page numbers must be between 1 and 20.");
  const inputText = [regions.title, regions.header, regions.compositionHeader, regions.assessment, regions.indicators,
    ...regions.compositionRows.flatMap(row => [row.label, row.measurement])];
  if (inputText.reduce((total, value) => total + value.length + 1, 0) > MAX_RENPHO_TEXT_CHARACTERS) throw new Error("The report text exceeds the 100,000-character limit.");
  if (regions.compositionRows.length > MAX_RENPHO_READINGS) throw new Error("The report contains more than 100 composition rows.");
  if (regions.compositionRows.some(row => !Number.isInteger(row.line) || row.line < 1)) throw new Error("Composition source rows must be positive integers.");
  const issues: RenphoIssue[] = [];
  const addIssue = (code: string, message: string, line?: number, metric?: string) => issues.push({ severity: "error", code, message, page, ...(line ? { line } : {}), ...(metric ? { metric } : {}) });
  const titleMatches = /^Body\s+Composition\s+Analysis\s+Report$/i.test(normalize(regions.title));
  const header = normalize(regions.header.replace(/\r?\n/g, " "));
  const identityMatches = [...header.matchAll(/\bID\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9._-]{0,79})(?=\s|$)/g)];
  const reportedIdentity = identityMatches.length === 1 ? { kind: "report_id" as const, value: identityMatches[0][1], page, line: 1 } : null;
  const reportedDate = reportedTestDate(header);
  const measurementHeader = /^Measurement\s*\(\s*(lb|lbs|kg)\s*\)$/i.exec(normalize(regions.compositionHeader.replace(/\r?\n/g, " ")));
  const compositionUnit = measurementHeader ? normalizeUnit(measurementHeader[1]) : null;
  const compositionRows = regions.compositionRows.map(row => ({ ...row, normalizedLabel: normalize(row.label.replace(/\r?\n/g, " ")) }));
  const knownRows = compositionRows.map(row => METRICS.slice(0, 7).find(metric => metric.label.toLowerCase() === row.normalizedLabel.toLowerCase()));
  const allCompositionLabels = COMPOSITION_KEYS.every(key => knownRows.filter(metric => metric?.key === key).length === 1) && compositionRows.length === 7;
  const recognizedLayout = titleMatches && !!reportedIdentity && !!reportedDate && !!compositionUnit && allCompositionLabels;
  if (!titleMatches) addIssue("layout_title", "The expected report title was not found in its title region.");
  if (!reportedIdentity) addIssue("report_id", "One explicit report ID is required for this layout. A report ID never selects an athlete automatically.");
  if (!reportedDate) addIssue("report_date", "One valid English-month Test Date with its printed time is required; the report ID is never used to infer a date.");
  if (!compositionUnit) addIssue("composition_unit", "The isolated measurement column must explicitly say Measurement(lb) or Measurement(kg).");
  if (!allCompositionLabels) addIssue("composition_labels", "The seven expected composition labels were not recognized exactly once. Check the crop and OCR against the original report.");

  // Each prepared line is isolated before parsing. Mapping preserves its original review evidence.
  const prepared: { text: string; sourceText: string; rawLabel: string; line: number; region: NonNullable<RenphoReading["region"]>; unitEvidence: RenphoReading["unitEvidence"]; unitNeedsConfirmation?: true }[] = [];
  compositionRows.forEach((row, index) => {
    const metric = knownRows[index];
    if (!metric || !compositionUnit) return;
    const valueText = normalize(row.measurement);
    // Do not accept a second value, printed range, unit mismatch, or OCR-correct a digit.
    const bareNumber = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(valueText);
    if (!bareNumber || !Number.isFinite(Number(valueText))) {
      addIssue("composition_reading", "The isolated measurement cell must contain one finite number only. Ranges, units, mixed text and OCR substitutions were not guessed.", row.line, metric.label); return;
    }
    const text = `${metric.label} ${valueText} ${compositionUnit}`;
    prepared.push({ text, sourceText: `${row.label}: ${row.measurement} [${regions.compositionHeader}]`, rawLabel: row.label,
      line: row.line, region: "composition", unitEvidence: "composition-header" });
  });
  const prepareRegion = (text: string, region: "assessment" | "indicators", allowed: string[], offset: number) => {
    text.split(/\r?\n/).forEach((sourceText, index) => {
      const normalized = normalize(sourceText);
      const alias = ALIASES.find(item => item.pattern.test(normalized));
      if (!alias) return;
      const metric = METRICS.find(item => allowed.includes(item.key) && item.aliases.some(label => label.toLowerCase() === alias.label.toLowerCase()));
      if (!metric) return; // Excludes target scores, classifications, segmental charts and unrelated percentages.
      let preparedText = normalized;
      let unitEvidence: RenphoReading["unitEvidence"] = "explicit";
      let unitNeedsConfirmation: true | undefined;
      const rest = normalized.slice(alias.label.length).trim().replace(/^:\s*/, "");
      const convention = Object.hasOwn(LAYOUT_UNITS, metric.key) ? LAYOUT_UNITS[metric.key] : undefined;
      if (recognizedLayout && convention && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(rest)) {
        preparedText = `${normalized} ${convention.unit}`; unitEvidence = convention.evidence;
      }
      if (recognizedLayout && metric.key === "smi") {
        const missingExponent = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*kg\/m$/.exec(rest);
        if (missingExponent) {
          preparedText = `${alias.label} ${missingExponent[1]} kg/m²`; unitEvidence = "layout-label"; unitNeedsConfirmation = true;
          issues.push({ severity: "review", code: "smi_unit_confirmation", page, line: offset + index + 1, metric: metric.label,
            message: "The SMI unit exponent was unreadable. Confirm kg/m² against the original report or uncheck SMI before importing." });
        }
      }
      if (recognizedLayout && metric.key === "fat_free_mass") {
        // Only the known lb suffix glyph is corrected. A digit-like '1b' requires
        // separating whitespace so it can never consume a measurement's last digit.
        const lbGlyph = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:\s*Ib|\s+1b)$/.exec(rest);
        if (lbGlyph) {
          preparedText = `${alias.label} ${lbGlyph[1]} lb`; unitEvidence = "ocr-unit-correction";
          issues.push({ severity: "review", code: "mass_unit_ocr", page, line: offset + index + 1, metric: metric.label,
            message: "The Fat-Free Mass lb unit glyph was read as Ib or 1b. Compare the proposed lb unit with the original report; its numeric value was not changed." });
        }
      }
      prepared.push({ text: preparedText, sourceText, rawLabel: sourceText.trim().slice(0, alias.label.length), line: offset + index + 1, region, unitEvidence, ...(unitNeedsConfirmation ? { unitNeedsConfirmation } : {}) });
    });
  };
  prepareRegion(regions.assessment, "assessment", ASSESSMENT_KEYS, 1000);
  prepareRegion(regions.indicators, "indicators", INDICATOR_KEYS, 2000);
  const parsed = parseRenphoText([{ page, lines: prepared.map(item => item.text) }]);
  for (const issue of parsed.issues.filter(issue => issue.code !== "unverified_layout")) {
    const source = issue.line ? prepared[issue.line - 1] : undefined;
    issues.push({ ...issue, ...(source ? { line: source.line } : {}) });
  }
  const candidateReadings = parsed.candidateReadings.map(reading => {
    const source = prepared[reading.line - 1];
    return { ...reading, sourceText: source.sourceText, rawLabel: source.rawLabel, line: source.line, region: source.region, unitEvidence: source.unitEvidence, ...(source.unitNeedsConfirmation ? { unitNeedsConfirmation: true as const } : {}) };
  });
  issues.unshift({ severity: "review", code: "ocr_review", message: "Compare every candidate and its unit with the original report. Confirm the athlete and test date; OCR and layout recognition do not verify measurement accuracy." });
  return { parserVersion: RENPHO_PARSER_VERSION, candidateReadings, reportedDate, reportedIdentity, issues,
    requiresReview: true, formatVerified: recognizedLayout, recognizedLayout };
}
