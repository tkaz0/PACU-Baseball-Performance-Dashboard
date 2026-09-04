import Papa from "papaparse";

export const HEADERS = ["athlete_code","first_name","preferred_name","last_name","pacific_email","jersey_number","primary_position","secondary_position","player_type","bats","throws","academic_class","eligibility_year","graduation_year","roster_status","profile_photo_url"] as const;
export type RosterInput = Record<(typeof HEADERS)[number], string>;
export const MAX_BYTES = 1024 * 1024;
export const MAX_ROWS = 500;

export function parseRosterCsv(source: string): RosterInput[] {
  if (new TextEncoder().encode(source).byteLength > MAX_BYTES) throw new Error("CSV exceeds the 1 MiB limit.");
  const parsed = Papa.parse<string[]>(source.replace(/^\uFEFF/, "").replace(/[\r\n]+$/, ""), { header: false, skipEmptyLines: false, delimiter: "," });
  if (parsed.errors.length) throw new Error(`CSV could not be read: ${parsed.errors[0].message}`);
  const [headers, ...data] = parsed.data;
  if (!headers || headers.length !== HEADERS.length || headers.some((h, i) => h.trim() !== HEADERS[i])) {
    throw new Error("Use the downloadable template with all 16 headers in their original order. Extra or duplicate columns are not accepted.");
  }
  if (!data.length || data.length > MAX_ROWS) throw new Error("Upload between 1 and 500 athlete rows.");
  return data.map((cells, index) => {
    if (cells.length !== HEADERS.length) throw new Error(`Row ${index + 2}: expected 16 cells, received ${cells.length}.`);
    if (cells.some(cell => /[\r\n]/.test(cell))) throw new Error(`Row ${index + 2}: multiline cells are not supported. Keep one athlete per line.`);
    const record = Object.fromEntries(HEADERS.map((key, col) => [key, cells[col].trim()])) as RosterInput;
    record.athlete_code = record.athlete_code.toUpperCase();
    record.pacific_email = record.pacific_email.toLowerCase();
    return record;
  });
}
