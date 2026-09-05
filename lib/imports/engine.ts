import Papa from "papaparse";
import { HEADERS } from "@/lib/roster/csv";
import type { AthleteSeason, RosterAthlete } from "@/lib/types";

// Pure, local-only parsing and previews. This module does not read or write storage.
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_TABLE_ROWS = 5000;
export const MAX_TABLE_COLUMNS = 100;
export const MAX_MEASUREMENTS = 20000;
export const MAX_ROSTER_ATHLETES = 1000;
export const ROSTER_FIELDS = [...HEADERS, "renpho_id"] as const;
export type RosterField = (typeof ROSTER_FIELDS)[number];
export const RENPHO_ID_PATTERN = /^[A-Z0-9_-]{1,80}$/;
export const MAX_RENPHO_ALIASES = 1000;
export const normalizeRenphoId = (value: string) => value.trim().toUpperCase();
export type RosterMapping = Partial<Record<RosterField, number>>;
export type ImportTable = { headers: string[]; rows: string[][]; rowNumbers: number[] };
export type ImportIssue = { row: number; field: string; message: string };
export type ImportStatus = "create" | "update" | "unchanged" | "reject";
export type FieldChange = { field: string; before: string | number | null; after: string | number | null };
export type MatchMethod = "code" | "email" | "name" | "override" | "new" | "none";
export type ImportRowResult = {
  row: number; status: ImportStatus; athlete_code: string; matchMethod: MatchMethod;
  requiresNameReview: boolean; changes: FieldChange[]; issues: ImportIssue[];
};
export type ImportCounts = Record<ImportStatus, number>;
export type RosterPreview = {
  candidateRoster: RosterAthlete[]; rows: ImportRowResult[]; counts: ImportCounts; canApply: boolean;
};
export type Measurement = {
  id: string; athlete_code: string; measured_at: string; source: string; metric: string;
  value: number; unit: string; source_file: string; source_sheet: string; source_row: number; file_hash: string;
};
export type DateFormat = "ISO" | "MDY" | "DMY";
export type MeasurementMapping = {
  identityKind: "code" | "email" | "name"; identityColumn: number;
  identityOverrides?: Record<string, string>; dateColumn?: number; fixedDate?: string;
  dateFormat: DateFormat; source: string; metrics: { column: number; label: string; unit: string }[];
};
export type FileContext = { fileHash: string; fileName: string; sheetName?: string };
export type MeasurementPreview = {
  candidateMeasurements: Measurement[]; rows: ImportRowResult[]; counts: ImportCounts;
  issues: ImportIssue[]; canApply: boolean; nameMatches: number;
};

const CONTROL = /[\u0000-\u001f\u007f]/;
const CODE = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHOTO = /^https:\/\/([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}([/?#][^\s\u0000-\u001f\u007f]*)?$/;
const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "IF", "DH", "UT"];
const IDENTITY_FIELDS = ["first_name", "preferred_name", "last_name", "pacific_email", "profile_photo_url"] as const;
const SEASON_FIELDS = ["jersey_number", "primary_position", "secondary_position", "player_type", "bats", "throws", "academic_class", "eligibility_year", "graduation_year", "roster_status"] as const;
const NUMERIC_FIELDS = new Set<RosterField>(["jersey_number", "eligibility_year", "graduation_year"]);
const normalizeCode = (value: string) => value.trim().toUpperCase();
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");

function renphoOwners(roster: RosterAthlete[]): Map<string, string> {
  const owners = new Map<string, string>();
  for (const athlete of roster) {
    for (const id of [athlete.renpho_id, ...(athlete.renpho_ids ?? [])]) {
      if (!id) continue;
      const normalized = normalizeRenphoId(id);
      if (!RENPHO_ID_PATTERN.test(normalized)) throw new Error("Use a RENPHO ID with 1–80 letters, numbers, underscores or hyphens.");
      const owner = owners.get(normalized);
      if (owner && owner !== athlete.athlete_code) throw new Error("This RENPHO ID belongs to more than one athlete. Resolve the roster IDs before importing.");
      owners.set(normalized, athlete.athlete_code);
    }
  }
  return owners;
}

/** Report identifiers never match names, prefixes, dates, or parts of an identifier. */
export function findRenphoAthlete(roster: RosterAthlete[], id: string): string | null {
  const normalized = normalizeRenphoId(id);
  if (!normalized) return null;
  if (!RENPHO_ID_PATTERN.test(normalized)) throw new Error("Use a RENPHO ID with 1–80 letters, numbers, underscores or hyphens.");
  return renphoOwners(roster).get(normalized) ?? null;
}

function issue(row: number, field: string, message: string): ImportIssue { return { row, field, message }; }
function countsFor(rows: ImportRowResult[]): ImportCounts {
  const counts: ImportCounts = { create: 0, update: 0, unchanged: 0, reject: 0 };
  for (const row of rows) counts[row.status]++;
  return counts;
}
function result(row: number, code = "", method: MatchMethod = "none"): ImportRowResult {
  return { row, athlete_code: code, matchMethod: method, status: "unchanged", requiresNameReview: method === "name", changes: [], issues: [] };
}
function validateColumn(column: number, width: number, label: string) {
  if (!Number.isInteger(column) || column < 0 || column >= width) throw new Error(`${label}: select a valid source column.`);
}

function detectDelimiter(source: string): "," | "\t" {
  let quoted = false, records = 0, commas = 0, tabs = 0, commaRows = 0, tabRows = 0;
  for (let index = 0; index <= source.length && records < 50; index++) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') index++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (character === ",") commas++;
      else if (character === "\t") tabs++;
      else if (character === "\n" || character === undefined) {
        if (commas) commaRows++;
        if (tabs) tabRows++;
        commas = 0; tabs = 0; records++;
      }
    }
  }
  return tabRows > commaRows ? "\t" : ",";
}

/** Returns records; selectTable validates the explicitly selected header record. */
export function parseDelimited(text: string): string[][] {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) throw new Error("File exceeds the 2 MiB limit.");
  const source = text.replace(/^\uFEFF/, "");
  if (!source.trim()) throw new Error("The file is empty.");
  const parsed = Papa.parse<string[]>(source, {
    header: false, skipEmptyLines: false, delimiter: detectDelimiter(source),
  });
  // A one-column file is valid; Papa cannot infer its delimiter.
  const errors = parsed.errors.filter(error => error.code !== "UndetectableDelimiter");
  if (errors.length) throw new Error(`File could not be read: ${errors[0].message}`);
  const matrix = parsed.data;
  while (matrix.length && matrix[matrix.length - 1].every(cell => !cell.trim())) matrix.pop();
  if (!matrix.length) throw new Error("The file is empty.");
  if (matrix.length > MAX_TABLE_ROWS) throw new Error(`Use at most ${MAX_TABLE_ROWS} records, including the header.`);
  if (matrix.some(row => row.length > MAX_TABLE_COLUMNS)) throw new Error(`Use at most ${MAX_TABLE_COLUMNS} columns.`);
  return matrix;
}

export function selectTable(matrix: string[][], headerRowIndex: number): ImportTable {
  if (!Number.isInteger(headerRowIndex) || headerRowIndex < 0 || headerRowIndex >= matrix.length) throw new Error("Select a valid header row.");
  if (matrix.length > MAX_TABLE_ROWS || matrix.some(row => row.length > MAX_TABLE_COLUMNS)) throw new Error("Table exceeds the 5,000-record or 100-column limit.");
  const headers = matrix[headerRowIndex].map(value => value.trim());
  if (!headers.length || headers.every(value => !value)) throw new Error("Select a header row with at least one named column.");
  if (headers.some(value => CONTROL.test(value))) throw new Error("Header names cannot contain control characters or line breaks.");
  const namedHeaders = headers.filter(Boolean).map(value => value.toLowerCase());
  if (new Set(namedHeaders).size !== namedHeaders.length) throw new Error("Duplicate source headers must be renamed before import.");
  headers.forEach((value, column) => { if (!value) headers[column] = `Column ${column + 1} (unnamed)`; });
  if (new Set(headers.map(value => value.toLowerCase())).size !== headers.length) throw new Error("A header conflicts with an unnamed column label; rename it before import.");
  const table: ImportTable = { headers, rows: [], rowNumbers: [] };
  matrix.slice(headerRowIndex + 1).forEach((row, index) => {
    const sourceRow = headerRowIndex + index + 2;
    if (row.every(cell => !cell.trim())) return;
    if (row.length > headers.length) throw new Error(`Row ${sourceRow}: more cells than source headers.`);
    table.rows.push(headers.map((_, column) => (row[column] ?? "").trim()));
    table.rowNumbers.push(sourceRow);
  });
  if (!table.rows.length) throw new Error("There are no data rows below the selected header.");
  return table;
}

/** Only template fields and the observed compact/spaced roster headers are recognized. */
export function suggestRosterMapping(headers: string[]): RosterMapping {
  const aliases: Record<string, RosterField> = {
    FirstName: "first_name", LastName: "last_name", PacificEmail: "pacific_email", JerseyNumber: "jersey_number",
    PrimaryPosition: "primary_position", SecondaryPosition: "secondary_position", PlayerType: "player_type",
    "First Name": "first_name", "Last Name": "last_name", "Pacific Email": "pacific_email", "Jersey Number": "jersey_number",
    "Primary Position": "primary_position", "Secondary Position": "secondary_position", "Player Type": "player_type",
    Bats: "bats", Throws: "throws", Class: "academic_class",
    "RENPHO ID": "renpho_id", "Renpho ID": "renpho_id", RenphoID: "renpho_id",
  };
  const mapping: RosterMapping = {};
  headers.forEach((header, index) => {
    const name = header.trim();
    const field = (ROSTER_FIELDS as readonly string[]).includes(name) ? name as RosterField : Object.hasOwn(aliases, name) ? aliases[name] : undefined;
    if (field) {
      if (mapping[field] !== undefined) throw new Error(`Multiple source headers match ${field}; choose the mapping explicitly.`);
      mapping[field] = index;
    }
  });
  return mapping;
}

function validateTable(table: ImportTable) {
  if (table.rows.length !== table.rowNumbers.length || table.rows.length > MAX_TABLE_ROWS || !table.headers.length || table.headers.length > MAX_TABLE_COLUMNS) throw new Error("Invalid import table.");
  if (new Set(table.rowNumbers).size !== table.rowNumbers.length || table.rowNumbers.some(row => !Number.isInteger(row) || row < 1)) throw new Error("Source row numbers must be positive and unique.");
  if (table.rows.some(row => row.length > table.headers.length)) throw new Error("A data row has more cells than headers.");
}

function rosterCells(row: string[], mapping: RosterMapping): Record<RosterField, string> {
  const values = Object.fromEntries(ROSTER_FIELDS.map(field => [field, mapping[field] === undefined ? "" : (row[mapping[field]!] ?? "").trim()])) as Record<RosterField, string>;
  values.athlete_code = normalizeCode(values.athlete_code);
  values.pacific_email = normalizeEmail(values.pacific_email);
  values.renpho_id = normalizeRenphoId(values.renpho_id);
  for (const field of ["primary_position", "secondary_position", "bats", "throws"] as const) values[field] = values[field].toUpperCase();
  for (const field of ["player_type", "academic_class", "roster_status"] as const) values[field] = values[field].toLowerCase();
  // These are the exact observed live-roster value conventions, not vendor guesses.
  if (values.jersey_number === "/") values.jersey_number = "";
  if (values.player_type === "position player") values.player_type = "position";
  if (values.player_type === "two-way") values.player_type = "two_way";
  if (values.secondary_position === "N/A") values.secondary_position = "";
  for (const field of ["bats", "throws"] as const) {
    if (values[field] === "LEFT") values[field] = "L";
    else if (values[field] === "RIGHT") values[field] = "R";
    else if (values[field] === "SWITCH") values[field] = "S";
  }
  return values;
}

export function validateRosterValues(values: Record<RosterField, string>, row: number, isNew = true): ImportIssue[] {
  const issues: ImportIssue[] = [];
  for (const field of ROSTER_FIELDS) {
    if (values[field].length > 2048 || CONTROL.test(values[field]) || values[field] !== values[field].trim()) issues.push(issue(row, field, "Use at most 2,048 characters without leading/trailing whitespace, control characters or line breaks."));
  }
  if (values.athlete_code && !CODE.test(values.athlete_code)) issues.push(issue(row, "athlete_code", "Use 3–40 uppercase letters, numbers, underscores or hyphens."));
  for (const field of ["first_name", "last_name", "preferred_name"] as const) {
    if (values[field].length > 80 || (isNew && field !== "preferred_name" && !values[field])) issues.push(issue(row, field, "New athletes require first and last names; each name can have at most 80 characters."));
  }
  if (values.pacific_email && (values.pacific_email.length > 254 || !EMAIL.test(values.pacific_email) || values.pacific_email !== normalizeEmail(values.pacific_email))) issues.push(issue(row, "pacific_email", "Enter a valid lowercase email address or leave it blank."));
  if (values.profile_photo_url && !PHOTO.test(values.profile_photo_url)) issues.push(issue(row, "profile_photo_url", "Use an HTTPS domain URL without credentials or a port."));
  if (values.renpho_id && !RENPHO_ID_PATTERN.test(values.renpho_id)) issues.push(issue(row, "renpho_id", "Use 1–80 uppercase letters, numbers, underscores or hyphens, or leave blank."));
  const enums: Partial<Record<RosterField, string[]>> = {
    primary_position: POSITIONS, secondary_position: POSITIONS, player_type: ["pitcher", "position", "two_way"],
    bats: ["L", "R", "S"], throws: ["L", "R", "S"], academic_class: ["freshman", "sophomore", "junior", "senior", "graduate"],
    roster_status: ["active", "inactive", "redshirt", "alumni"],
  };
  for (const [field, allowed] of Object.entries(enums) as [RosterField, string[]][]) {
    if (values[field] && !allowed.includes(values[field])) issues.push(issue(row, field, `Use ${allowed.join(", ")} or leave blank.`));
  }
  for (const [field, pattern, label] of [
    ["jersey_number", /^\d{1,2}$/, "0–99"], ["eligibility_year", /^[1-6]$/, "1–6"], ["graduation_year", /^(20\d{2}|2100)$/, "2000–2100"],
  ] as const) {
    if (values[field] && !pattern.test(values[field])) issues.push(issue(row, field, `Use a whole number in ${label} or leave blank.`));
  }
  return issues;
}

function blankSeason(code: string, season: string): AthleteSeason {
  return { athlete_id: code, season, jersey_number: null, primary_position: null, secondary_position: null, player_type: null, bats: null, throws: null, academic_class: null, eligibility_year: null, graduation_year: null, roster_status: null };
}

export function previewRoster(table: ImportTable, mapping: RosterMapping, season: string, existingRoster: RosterAthlete[]): RosterPreview {
  validateTable(table);
  if (existingRoster.length > MAX_ROSTER_ATHLETES) throw new Error("The local roster exceeds the 1,000-athlete capacity.");
  if (!/^20\d{2}(-\d{2})?$/.test(season)) throw new Error("Season must be YYYY or YYYY-YY.");
  if (!Object.keys(mapping).length) throw new Error("Map at least one roster field.");
  for (const [field, column] of Object.entries(mapping)) {
    if (!(ROSTER_FIELDS as readonly string[]).includes(field)) throw new Error("Unknown roster field.");
    validateColumn(column, table.headers.length, field);
  }
  if (new Set(Object.values(mapping)).size !== Object.values(mapping).length) throw new Error("Map each source column to only one roster field.");
  const values = table.rows.map(row => rosterCells(row, mapping));
  const candidateRoster = existingRoster.map(athlete => ({ ...athlete, ...(athlete.renpho_ids ? { renpho_ids: [...athlete.renpho_ids] } : {}), id: athlete.athlete_code, athlete_seasons: athlete.athlete_seasons.map(s => ({ ...s, athlete_id: athlete.athlete_code })) }));
  const renphoIndex = renphoOwners(candidateRoster);
  const codeIndex = new Map<string, RosterAthlete[]>();
  const emailIndex = new Map<string, RosterAthlete[]>();
  for (const athlete of candidateRoster) {
    const code = normalizeCode(athlete.athlete_code);
    codeIndex.set(code, [...(codeIndex.get(code) ?? []), athlete]);
    if (athlete.pacific_email) {
      const email = normalizeEmail(athlete.pacific_email);
      emailIndex.set(email, [...(emailIndex.get(email) ?? []), athlete]);
    }
  }
  const usedCodes = new Set([...codeIndex.keys(), ...values.map(row => row.athlete_code).filter(Boolean)]);
  let nextLocal = 1;
  for (const code of usedCodes) {
    const match = /^LOCAL-(\d+)$/.exec(code);
    if (match && Number.isSafeInteger(Number(match[1]))) nextLocal = Math.max(nextLocal, Number(match[1]) + 1);
  }
  const resolved = values.map((value, index) => {
    const row = result(table.rowNumbers[index]);
    const byEmail = value.pacific_email ? emailIndex.get(value.pacific_email) ?? [] : [];
    let matched: RosterAthlete | undefined;
    if (value.athlete_code) {
      const byCode = codeIndex.get(value.athlete_code) ?? [];
      if (byCode.length > 1) row.issues.push(issue(row.row, "athlete_code", "The current roster contains duplicate codes; resolve them first."));
      else matched = byCode[0];
      row.matchMethod = matched ? "code" : "new";
    } else if (byEmail.length === 1) {
      matched = byEmail[0]; value.athlete_code = matched.athlete_code; row.matchMethod = "email";
    } else if (byEmail.length > 1) {
      row.issues.push(issue(row.row, "pacific_email", "The email matches multiple athletes; choose a permanent code."));
    } else {
      if (!Number.isSafeInteger(nextLocal)) nextLocal = 1;
      do { value.athlete_code = `LOCAL-${String(nextLocal++).padStart(4, "0")}`; } while (usedCodes.has(value.athlete_code));
      usedCodes.add(value.athlete_code); row.matchMethod = "new";
    }
    row.athlete_code = value.athlete_code;
    if (byEmail.some(athlete => athlete.athlete_code !== value.athlete_code)) row.issues.push(issue(row.row, "pacific_email", "This email belongs to a different athlete code."));
    if (value.renpho_id) {
      const owner = renphoIndex.get(value.renpho_id);
      if (owner && owner !== value.athlete_code) row.issues.push(issue(row.row, "renpho_id", "This RENPHO ID is already assigned to another athlete."));
      if (matched?.renpho_id && matched.renpho_id !== value.renpho_id && !matched.renpho_ids?.includes(value.renpho_id) && (matched.renpho_ids?.length ?? 0) >= MAX_RENPHO_ALIASES) row.issues.push(issue(row.row, "renpho_id", "This athlete has reached the saved RENPHO ID limit."));
    }
    row.issues.push(...validateRosterValues(value, row.row, !matched));
    return { value, row, matched };
  });
  const codeCounts = new Map<string, number>();
  const emailCounts = new Map<string, number>();
  const renphoCounts = new Map<string, number>();
  for (const { value } of resolved) {
    if (value.athlete_code) codeCounts.set(value.athlete_code, (codeCounts.get(value.athlete_code) ?? 0) + 1);
    if (value.pacific_email) emailCounts.set(value.pacific_email, (emailCounts.get(value.pacific_email) ?? 0) + 1);
    if (value.renpho_id) renphoCounts.set(value.renpho_id, (renphoCounts.get(value.renpho_id) ?? 0) + 1);
  }
  const rows = resolved.map(({ value, row, matched }) => {
    if ((codeCounts.get(value.athlete_code) ?? 0) > 1) row.issues.push(issue(row.row, "athlete_code", "Multiple source rows resolve to this athlete code."));
    if ((emailCounts.get(value.pacific_email) ?? 0) > 1) row.issues.push(issue(row.row, "pacific_email", "The email is repeated in multiple source rows."));
    if ((renphoCounts.get(value.renpho_id) ?? 0) > 1) row.issues.push(issue(row.row, "renpho_id", "The RENPHO ID is repeated in multiple source rows."));
    if (!matched && candidateRoster.length >= MAX_ROSTER_ATHLETES) row.issues.push(issue(row.row, "capacity", "The local workspace supports at most 1,000 athletes."));
    if (row.issues.length) { row.status = "reject"; return row; }
    const athlete: RosterAthlete = matched ?? {
      id: value.athlete_code, athlete_code: value.athlete_code, first_name: value.first_name, last_name: value.last_name,
      preferred_name: null, pacific_email: null, profile_photo_url: null, created_at: "", updated_at: "", athlete_seasons: [],
    };
    if (!matched) row.changes.push({ field: "athlete_code", before: null, after: value.athlete_code });
    for (const field of IDENTITY_FIELDS) {
      const before = matched ? athlete[field] : null;
      const after = value[field] || before;
      if (before !== after) row.changes.push({ field, before, after });
      if (after !== null) athlete[field] = after;
    }
    const previousRenphoId = athlete.renpho_id ?? null;
    if (value.renpho_id && value.renpho_id !== previousRenphoId) {
      const aliases = [...new Set([...(athlete.renpho_ids ?? []), ...(previousRenphoId ? [previousRenphoId] : [])])].filter(id => id !== value.renpho_id);
      athlete.renpho_id = value.renpho_id;
      if (aliases.length || athlete.renpho_ids) athlete.renpho_ids = aliases;
      row.changes.push({ field: "renpho_id", before: previousRenphoId, after: value.renpho_id });
    }
    let seasonal = athlete.athlete_seasons.find(s => s.season === season);
    if (!seasonal) {
      seasonal = blankSeason(value.athlete_code, season); athlete.athlete_seasons.push(seasonal);
      row.changes.push({ field: "season", before: null, after: season });
    }
    for (const field of SEASON_FIELDS) {
      const before = seasonal[field];
      const after = value[field] ? NUMERIC_FIELDS.has(field) ? Number(value[field]) : value[field] : before;
      if (before !== after) row.changes.push({ field, before, after });
      Object.assign(seasonal, { [field]: after });
    }
    row.status = !matched ? "create" : row.changes.length ? "update" : "unchanged";
    if (!matched) candidateRoster.push(athlete);
    return row;
  });
  const counts = countsFor(rows);
  return { candidateRoster, rows, counts, canApply: rows.length > 0 && counts.reject === 0 };
}

/** No Date.parse or locale inference; a slash date is accepted only with an explicit order. */
export function parseMeasurementDate(value: string, format: DateFormat): string {
  const input = value.trim();
  let year: number, month: number, day: number;
  if (format === "ISO") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    if (!match) throw new Error("Use an ISO date in YYYY-MM-DD format.");
    [, year, month, day] = match.map(Number);
  } else if (format === "MDY" || format === "DMY") {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
    if (!match) throw new Error(`Use ${format === "MDY" ? "MM/DD/YYYY" : "DD/MM/YYYY"}; two-digit years and inferred formats are not accepted.`);
    year = Number(match[3]); month = Number(match[format === "MDY" ? 1 : 2]); day = Number(match[format === "MDY" ? 2 : 1]);
  } else throw new Error("Select an explicit date format.");
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day); date.setUTCHours(0, 0, 0, 0);
  if (year < 1000 || year > 9999 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error("The test date is not a valid calendar date.");
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function measurementEqual(a: Measurement, b: Measurement) {
  return a.athlete_code === b.athlete_code && a.measured_at === b.measured_at && a.source === b.source && a.metric === b.metric && a.value === b.value && a.unit === b.unit;
}

export function previewMeasurements(table: ImportTable, mapping: MeasurementMapping, roster: RosterAthlete[], existingMeasurements: Measurement[], fileContext: FileContext): MeasurementPreview {
  validateTable(table);
  if (existingMeasurements.length > MAX_MEASUREMENTS) throw new Error("The local workspace exceeds the 20,000-measurement capacity.");
  validateColumn(mapping.identityColumn, table.headers.length, "Athlete identity");
  if (!["code", "email", "name"].includes(mapping.identityKind)) throw new Error("Select a supported athlete identity kind.");
  if (!["ISO", "MDY", "DMY"].includes(mapping.dateFormat)) throw new Error("Select an explicit date format.");
  if (!mapping.source.trim() || CONTROL.test(mapping.source) || mapping.source.length > 120) throw new Error("Enter a source label with at most 120 characters.");
  if (mapping.dateColumn !== undefined) validateColumn(mapping.dateColumn, table.headers.length, "Test date");
  else if (!mapping.fixedDate?.trim()) throw new Error("Select a test-date column or enter a test date.");
  const fixedDate = mapping.dateColumn === undefined ? parseMeasurementDate(mapping.fixedDate!, mapping.dateFormat) : undefined;
  if (!mapping.metrics.length) throw new Error("Map at least one measurement column.");
  if (new Set(mapping.metrics.map(metric => metric.column)).size !== mapping.metrics.length) throw new Error("Map each measurement source column only once.");
  for (const metric of mapping.metrics) {
    validateColumn(metric.column, table.headers.length, "Measurement");
    if (!metric.label.trim() || metric.label.length > 120 || CONTROL.test(metric.label)) throw new Error("Every measurement requires an explicit label with at most 120 characters.");
    if (!metric.unit.trim() || metric.unit.length > 60 || CONTROL.test(metric.unit)) throw new Error("Every measurement requires an explicit unit with at most 60 characters.");
    if (metric.column === mapping.identityColumn || metric.column === mapping.dateColumn) throw new Error("Identity and date columns cannot also be measurement columns.");
  }
  if (!/^[a-f0-9]{64}$/i.test(fileContext.fileHash)) throw new Error("A SHA-256 file hash is required for repeat-import detection.");
  if (!fileContext.fileName.trim() || fileContext.fileName.length > 255 || CONTROL.test(fileContext.fileName)) throw new Error("Use a valid source filename.");
  if ((fileContext.sheetName?.length ?? 0) > 255 || CONTROL.test(fileContext.sheetName ?? "")) throw new Error("Use a valid source sheet name.");
  const byIdentity = new Map<string, RosterAthlete[]>();
  const byCode = new Map<string, RosterAthlete[]>();
  const normalizeIdentity = mapping.identityKind === "code" ? normalizeCode : mapping.identityKind === "email" ? normalizeEmail : normalizeName;
  for (const athlete of roster) {
    const code = normalizeCode(athlete.athlete_code);
    byCode.set(code, [...(byCode.get(code) ?? []), athlete]);
    const value = mapping.identityKind === "code" ? code : mapping.identityKind === "email" ? athlete.pacific_email ?? "" : `${athlete.first_name} ${athlete.last_name}`;
    if (value.trim()) {
      const key = normalizeIdentity(value); byIdentity.set(key, [...(byIdentity.get(key) ?? []), athlete]);
    }
  }
  const overrides = new Map<string, string>();
  for (const [identity, code] of Object.entries(mapping.identityOverrides ?? {})) {
    const key = normalizeIdentity(identity), normalizedCode = normalizeCode(code);
    if (overrides.has(key) && overrides.get(key) !== normalizedCode) throw new Error("Conflicting athlete overrides match the same source identity.");
    overrides.set(key, normalizedCode);
  }
  const existing = new Map<string, Measurement>();
  for (const measurement of existingMeasurements) {
    if (existing.has(measurement.id)) throw new Error("Existing measurements contain duplicate observation IDs; restore a valid local backup first.");
    existing.set(measurement.id, measurement);
  }
  const candidateMeasurements: Measurement[] = [];
  const rows = table.rows.map((cells, index) => {
    const row = result(table.rowNumbers[index]);
    const populated = mapping.metrics.filter(metric => (cells[metric.column] ?? "").trim() !== "");
    if (!populated.length) return row;
    const sourceIdentity = (cells[mapping.identityColumn] ?? "").trim();
    const key = normalizeIdentity(sourceIdentity);
    const override = overrides.get(key);
    const matches = override === undefined ? byIdentity.get(key) ?? [] : byCode.get(override) ?? [];
    if (!sourceIdentity) row.issues.push(issue(row.row, "identity", "The athlete identity is blank."));
    else if (matches.length !== 1) row.issues.push(issue(row.row, "identity", matches.length ? "This identity matches more than one athlete; explicitly choose a permanent athlete code." : "No roster athlete matches this identity; import the roster or explicitly select an athlete."));
    const athlete = matches.length === 1 ? matches[0] : undefined;
    row.athlete_code = athlete?.athlete_code ?? "";
    row.matchMethod = athlete ? override !== undefined ? "override" : mapping.identityKind : "none";
    row.requiresNameReview = row.matchMethod === "name";
    let measuredAt = fixedDate ?? "";
    if (mapping.dateColumn !== undefined) {
      try { measuredAt = parseMeasurementDate(cells[mapping.dateColumn] ?? "", mapping.dateFormat); }
      catch (error) { row.issues.push(issue(row.row, "date", error instanceof Error ? error.message : "Invalid test date.")); }
    }
    const newForRow: Measurement[] = [];
    for (const metric of populated) {
      const cell = (cells[metric.column] ?? "").trim();
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(cell) || !Number.isFinite(Number(cell))) {
        row.issues.push(issue(row.row, table.headers[metric.column], "Use a finite number only. Resolve formula errors, percentages, inequalities and mixed text; units are mapped separately."));
        continue;
      }
      if (!athlete || !measuredAt) continue;
      const measurement: Measurement = {
        id: `observation:${JSON.stringify([fileContext.fileHash.toLowerCase(), fileContext.sheetName ?? "", row.row, metric.column])}`,
        athlete_code: athlete.athlete_code, measured_at: measuredAt, source: mapping.source.trim(), metric: metric.label.trim(),
        value: Number(cell), unit: metric.unit.trim(), source_file: fileContext.fileName, source_sheet: fileContext.sheetName ?? "",
        source_row: row.row, file_hash: fileContext.fileHash.toLowerCase(),
      };
      const previous = existing.get(measurement.id);
      if (previous && !measurementEqual(previous, measurement)) row.issues.push(issue(row.row, table.headers[metric.column], "This source observation was already imported with a different athlete, date, source, metric, unit or value. Remove its old batch before replacing it."));
      else if (!previous) newForRow.push(measurement);
    }
    if (existingMeasurements.length + candidateMeasurements.length + newForRow.length > MAX_MEASUREMENTS) row.issues.push(issue(row.row, "capacity", "The local workspace supports at most 20,000 measurements. Remove an old batch before importing more."));
    if (row.issues.length) row.status = "reject";
    else if (newForRow.length) { row.status = "create"; candidateMeasurements.push(...newForRow); }
    return row;
  });
  const issues = rows.flatMap(row => row.issues);
  return { candidateMeasurements, rows, counts: countsFor(rows), issues, canApply: rows.length > 0 && issues.length === 0, nameMatches: rows.filter(row => row.requiresNameReview).length };
}
