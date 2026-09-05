import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_BYTES, MAX_MEASUREMENTS, MAX_TABLE_ROWS, parseDelimited, selectTable, suggestRosterMapping,
  previewRoster, previewMeasurements, parseMeasurementDate,
  ROSTER_FIELDS, findRenphoAthlete, normalizeRenphoId,
  type ImportTable, type Measurement, type MeasurementMapping, type FileContext,
} from "@/lib/imports/engine";
import type { RosterAthlete } from "@/lib/types";
import { HEADERS } from "@/lib/roster/csv";

const table = (headers: string[], rows: string[][]): ImportTable => selectTable([headers, ...rows], 0);
function athlete(code = "PAC-0001", first = "Fictional", last = "Example", email: string | null = "fictional@example.com"): RosterAthlete {
  return {
    id: code, athlete_code: code, first_name: first, last_name: last, preferred_name: null, pacific_email: email,
    profile_photo_url: null, created_at: "", updated_at: "", athlete_seasons: [{
      athlete_id: code, season: "2026", jersey_number: 17, primary_position: "P", secondary_position: null,
      player_type: "pitcher", bats: "R", throws: "R", academic_class: "senior", eligibility_year: null,
      graduation_year: null, roster_status: "active",
    }],
  };
}
const roster = [athlete()];
const context: FileContext = { fileHash: "a".repeat(64), fileName: "fictional-tests.csv", sheetName: "Tests" };
const measurementMapping: MeasurementMapping = {
  identityKind: "code", identityColumn: 0, dateColumn: 1, dateFormat: "ISO", source: "User-selected test source",
  metrics: [{ column: 2, label: "User-selected test", unit: "s" }],
};
const measurementTable = () => table(["Athlete", "Date", "Test"], [["PAC-0001", "2026-09-04", "0"]]);
const runMeasurements = (input = measurementTable(), mapping = measurementMapping, existing: Measurement[] = [], sourceContext = context, athletes = roster) => previewMeasurements(input, mapping, athletes, existing, sourceContext);

describe("local import table parsing", () => {
  it("reads BOM, CRLF, quotes, quoted delimiters and tab-delimited exports", () => {
    expect(parseDelimited('\uFEFFName\tNote\r\n"Fictional, Example"\t"Said ""hello"""\r\n')).toEqual([
      ["Name", "Note"], ["Fictional, Example", 'Said "hello"'],
    ]);
    expect(parseDelimited('Name,Note\nFictional,"two\nlines"')).toEqual([["Name", "Note"], ["Fictional", "two\nlines"]]);
  });
  it("accepts a single column and rejects malformed quotes, oversized UTF-8 and wide tables", () => {
    expect(parseDelimited("Athlete\nPAC-0001")).toEqual([["Athlete"], ["PAC-0001"]]);
    expect(() => parseDelimited('Name,Note\nFictional,"unterminated')).toThrow("could not be read");
    expect(() => parseDelimited("é".repeat(MAX_IMPORT_BYTES / 2 + 1))).toThrow("2 MiB");
    expect(() => parseDelimited(Array.from({ length: 101 }, (_, i) => `h${i}`).join(","))).toThrow("100 columns");
    expect(() => parseDelimited("A\n" + "x\n".repeat(MAX_TABLE_ROWS))).toThrow("records");
    expect(() => parseDelimited(" \r\n")).toThrow("empty");
  });
  it("keeps original record numbers after an explicit header row and blank records", () => {
    const parsed = parseDelimited("Report title\nFirstName,LastName\n\nFictional,One\n,\nFictional,Two\n");
    const selected = selectTable(parsed, 1);
    expect(selected.headers).toEqual(["FirstName", "LastName"]);
    expect(selected.rowNumbers).toEqual([4, 6]);
    expect(selected.rows).toHaveLength(2);
  });
  it("labels unnamed columns explicitly without inferring meaning, and rejects duplicate headers or excess cells", () => {
    expect(selectTable([["", "Player", "Weight"], ["1", "Fictional Example", "150"]], 0).headers).toEqual(["Column 1 (unnamed)", "Player", "Weight"]);
    expect(() => selectTable([["", ""], ["Fictional", "x"]], 0)).toThrow("at least one named");
    expect(() => selectTable([["Name", " name "], ["Fictional", "x"]], 0)).toThrow("Duplicate");
    expect(() => selectTable([["Name"], ["Fictional", "x"]], 0)).toThrow("Row 2");
    expect(() => selectTable([["Name"]], 0)).toThrow("no data rows");
    expect(selectTable([["Name", "Optional"], ["Fictional"]], 0).rows).toEqual([["Fictional", ""]]);
  });
  it("suggests only exact template headers and the observed roster aliases", () => {
    expect(suggestRosterMapping(["FirstName", "LastName", "PacificEmail", "JerseyNumber", "PrimaryPosition", "SecondaryPosition", "PlayerType", "Bats", "Throws", "Class"])).toEqual({
      first_name: 0, last_name: 1, pacific_email: 2, jersey_number: 3, primary_position: 4, secondary_position: 5, player_type: 6, bats: 7, throws: 8, academic_class: 9,
    });
    expect(suggestRosterMapping(["Name", "DOB", "Velocity", "EMAIL", "first_name"])).toEqual({ first_name: 4 });
    expect(suggestRosterMapping(["constructor", "toString", "__proto__"])).toEqual({});
    expect(() => suggestRosterMapping(["FirstName", "first_name"])).toThrow("Multiple");
  });
  it("recognizes the observed spaced roster headers without guessing other labels", () => {
    expect(suggestRosterMapping(["First Name", "Last Name", "Pacific Email", "Jersey Number", "Primary Position", "Secondary Position", "Player Type", "Bats", "Throws", "Class"])).toEqual({
      first_name: 0, last_name: 1, pacific_email: 2, jersey_number: 3, primary_position: 4, secondary_position: 5, player_type: 6, bats: 7, throws: 8, academic_class: 9,
    });
    expect(suggestRosterMapping(["Full Name", "Player Email", "Jersey", "First  Name"])).toEqual({});
  });
  it.each([
    ["FirstName", "First Name"], ["first_name", "First Name"],
    ["PacificEmail", "Pacific Email"], ["Primary Position", "primary_position"],
    ["Player Type", "PlayerType"],
  ])("rejects ambiguous duplicate roster mappings for %s and %s", (first, second) => {
    expect(() => suggestRosterMapping([first, second])).toThrow("Multiple source headers match");
  });
});

describe("roster import previews", () => {
  it("creates permanent sequential codes, reserving explicit codes from this file", () => {
    const source = table(["athlete_code", "first_name", "last_name"], [["", "Fictional", "Two"], ["PAC-0007", "Fictional", "Three"]]);
    const preview = previewRoster(source, suggestRosterMapping(source.headers), "2026", roster);
    expect(preview.canApply).toBe(true);
    expect(preview.rows.map(row => row.athlete_code)).toEqual(["PAC-0008", "PAC-0007"]);
    expect(preview.candidateRoster.map(a => a.id)).toEqual(["PAC-0001", "PAC-0008", "PAC-0007"]);
    expect(preview.candidateRoster[1].pacific_email).toBeNull();
    expect(preview.candidateRoster[1].athlete_seasons[0].jersey_number).toBeNull();
  });
  it("matches an explicit code, preserves blanks and jersey zero, and leaves omitted athletes intact", () => {
    const existing = [athlete(), athlete("PAC-0002", "Fictional", "Other", "other@example.com")];
    const before = JSON.stringify(existing);
    const source = table(["athlete_code", "first_name", "last_name", "pacific_email", "jersey_number", "primary_position"], [["pac-0001", "", "", "", "0", ""]]);
    const preview = previewRoster(source, suggestRosterMapping(source.headers), "2026", existing);
    expect(preview.counts).toEqual({ create: 0, update: 1, unchanged: 0, reject: 0 });
    expect(preview.rows[0].changes).toEqual([{ field: "jersey_number", before: 17, after: 0 }]);
    expect(preview.candidateRoster).toHaveLength(2);
    expect(preview.candidateRoster[0].first_name).toBe("Fictional");
    expect(preview.candidateRoster[0].pacific_email).toBe("fictional@example.com");
    expect(preview.candidateRoster[0].athlete_seasons[0].primary_position).toBe("P");
    expect(JSON.stringify(existing)).toBe(before);
  });
  it("matches only a unique normalized email when code is omitted", () => {
    const source = table(["pacific_email", "jersey_number"], [[" FICTIONAL@EXAMPLE.COM ", "0"]]);
    const preview = previewRoster(source, suggestRosterMapping(source.headers), "2026", roster);
    expect(preview.rows[0].matchMethod).toBe("email");
    expect(preview.rows[0].athlete_code).toBe("PAC-0001");
    const ambiguous = previewRoster(source, suggestRosterMapping(source.headers), "2026", [...roster, athlete("PAC-0002")]);
    expect(ambiguous.canApply).toBe(false);
    expect(ambiguous.rows[0].status).toBe("reject");
  });
  it("treats the observed slash jersey placeholder as unassigned on create and preserves existing jerseys on merge", () => {
    const source = table(["athlete_code", "first_name", "last_name", "jersey_number"], [["PAC-0003", "Fictional", "SlashExample", " / "]]);
    const created = previewRoster(source, suggestRosterMapping(source.headers), "2026", []);
    expect(created.canApply).toBe(true);
    expect(created.candidateRoster[0].athlete_seasons[0].jersey_number).toBeNull();
    const update = table(["athlete_code", "jersey_number"], [["PAC-0001", "/"]]);
    const merged = previewRoster(update, suggestRosterMapping(update.headers), "2026", roster);
    expect(merged.canApply).toBe(true);
    expect(merged.counts.unchanged).toBe(1);
    expect(merged.candidateRoster[0].athlete_seasons[0].jersey_number).toBe(17);
    const zeroRoster = structuredClone(roster); zeroRoster[0].athlete_seasons[0].jersey_number = 0;
    expect(previewRoster(update, suggestRosterMapping(update.headers), "2026", zeroRoster).candidateRoster[0].athlete_seasons[0].jersey_number).toBe(0);
  });
  it("does not extend the slash convention to other numeric fields or malformed jersey values", () => {
    for (const jersey of ["//", "1/2", "N/A", "-", "one", "100", "-1", "1.5"]) {
      const source = table(["athlete_code", "jersey_number"], [["PAC-0001", jersey]]);
      expect(previewRoster(source, suggestRosterMapping(source.headers), "2026", roster).counts.reject).toBe(1);
    }
    for (const field of ["eligibility_year", "graduation_year"]) {
      const source = table(["athlete_code", field], [["PAC-0001", "/"]]);
      expect(previewRoster(source, suggestRosterMapping(source.headers), "2026", roster).counts.reject).toBe(1);
    }
  });
  it("does not merge an explicit new code by email, name or jersey", () => {
    const source = table(["athlete_code", "first_name", "last_name", "pacific_email", "jersey_number"], [["PAC-0002", "Fictional", "Example", "fictional@example.com", "17"]]);
    const conflicting = previewRoster(source, suggestRosterMapping(source.headers), "2026", roster);
    expect(conflicting.rows[0].issues.some(i => i.message.includes("different athlete code"))).toBe(true);
    const nameOnly = table(["first_name", "last_name", "jersey_number"], [["Fictional", "Example", "17"]]);
    const newIdentity = previewRoster(nameOnly, suggestRosterMapping(nameOnly.headers), "2026", roster);
    expect(newIdentity.rows[0].status).toBe("create");
    expect(newIdentity.candidateRoster).toHaveLength(2);
  });
  it("rejects every repeated code, repeated email, and two source rows resolving to one identity", () => {
    const source = table(["athlete_code", "first_name", "last_name", "pacific_email"], [
      ["PAC-0001", "", "", ""], ["", "", "", "fictional@example.com"],
    ]);
    expect(previewRoster(source, suggestRosterMapping(source.headers), "2026", roster).counts.reject).toBe(2);
    const duplicateEmail = table(["first_name", "last_name", "pacific_email"], [["Fictional", "One", "new@example.com"], ["Fictional", "Two", "NEW@example.com"]]);
    const preview = previewRoster(duplicateEmail, suggestRosterMapping(duplicateEmail.headers), "2026", []);
    expect(preview.counts.reject).toBe(2);
    expect(preview.candidateRoster).toEqual([]);
  });
  it("normalizes the observed live roster conventions and validates against schema enums", () => {
    const headers = ["FirstName", "LastName", "PlayerType", "SecondaryPosition", "Class", "Bats", "Throws"];
    const source = table(headers, [["Fictional", "Two", "Two-Way", "N/A", "Freshman", "s", "r"], ["Fictional", "Three", "Position Player", "OF", "Junior", "L", "L"]]);
    const preview = previewRoster(source, suggestRosterMapping(headers), "2026", []);
    expect(preview.canApply).toBe(true);
    expect(preview.candidateRoster[0].athlete_seasons[0]).toMatchObject({ player_type: "two_way", secondary_position: null, academic_class: "freshman", bats: "S", throws: "R" });
    expect(preview.candidateRoster[1].athlete_seasons[0].player_type).toBe("position");
  });
  it("imports a fictional spaced-header roster with full handedness words, jersey zero, and blank optional values", () => {
    const headers = ["First Name", "Last Name", "Pacific Email", "Jersey Number", "Primary Position", "Secondary Position", "Player Type", "Bats", "Throws", "Class"];
    const source = table(headers, [
      ["Fictional", "LeftExample", "fictional.left@example.com", "0", "CF", "N/A", "Position Player", "Left", "Right", "Freshman"],
      ["Fictional", "RightExample", "fictional.right@example.com", "17", "P", "", "Pitcher", "Right", "Left", "Senior"],
      ["Fictional", "SwitchExample", "fictional.switch@example.com", "", "SS", "2B", "Two-Way", "Switch", "Right", "Junior"],
      ["Fictional", "BlankExample", "fictional.blank@example.com", "", "", "", "", "", "", ""],
    ]);
    const before = structuredClone(source);
    const preview = previewRoster(source, suggestRosterMapping(headers), "2026", []);
    expect(preview.canApply).toBe(true);
    expect(preview.counts).toEqual({ create: 4, update: 0, unchanged: 0, reject: 0 });
    expect(preview.candidateRoster.map(athlete => {
      const season = athlete.athlete_seasons[0];
      return [season.bats, season.throws, season.jersey_number];
    })).toEqual([["L", "R", 0], ["R", "L", 17], ["S", "R", null], [null, null, null]]);
    expect(preview.candidateRoster[0].athlete_seasons[0].secondary_position).toBeNull();
    expect(preview.candidateRoster.every(athlete => athlete.athlete_seasons[0].roster_status === null)).toBe(true);
    expect(source).toEqual(before);
    expect(previewRoster(source, suggestRosterMapping(headers), "2026", preview.candidateRoster).counts.unchanged).toBe(4);
  });
  it.each(["Left-handed", "Both", "Ambidextrous", "N/A"])("continues rejecting unsupported handedness text: %s", value => {
    const source = table(["First Name", "Last Name", "Bats", "Throws"], [["Fictional", "InvalidExample", value, value]]);
    const preview = previewRoster(source, suggestRosterMapping(source.headers), "2026", []);
    expect(preview.canApply).toBe(false);
    expect(preview.rows[0].issues.map(issue => issue.field)).toEqual(["bats", "throws"]);
    expect(preview.candidateRoster).toEqual([]);
  });
  it("rejects invalid required identity fields, optional emails, numeric fields and enums atomically", () => {
    const headers = ["first_name", "last_name", "pacific_email", "jersey_number", "primary_position", "player_type", "bats", "academic_class", "eligibility_year", "graduation_year", "roster_status"];
    const source = table(headers, [["", "", "invalid", "100", "SP", "hitter", "B", "unknown", "0", "2101", "deleted"]]);
    const preview = previewRoster(source, suggestRosterMapping(headers), "2026", roster);
    expect(preview.rows[0].issues).toHaveLength(11);
    expect(preview.canApply).toBe(false);
    expect(preview.candidateRoster).toEqual(roster);
  });
  it("rejects unsafe photo URLs/control cells, and enforces mapping and season bounds", () => {
    const source = table(["first_name", "last_name", "profile_photo_url"], [["Fictional\nName", "Example", "https://user:pass@example.com/photo.png"]]);
    expect(previewRoster(source, suggestRosterMapping(source.headers), "2026", []).rows[0].issues).toHaveLength(2);
    expect(() => previewRoster(source, { first_name: 99 }, "2026", [])).toThrow("valid source column");
    expect(() => previewRoster(source, { first_name: 0, last_name: 0 }, "2026", [])).toThrow("only one roster field");
    expect(() => previewRoster(source, { first_name: 0 }, "26", [])).toThrow("Season");
  });
  it("adds a season without replacing history and recognizes an identical replay", () => {
    const source = table(["athlete_code", "jersey_number"], [["PAC-0001", "0"]]);
    const first = previewRoster(source, suggestRosterMapping(source.headers), "2027", roster);
    expect(first.candidateRoster[0].athlete_seasons).toHaveLength(2);
    expect(first.candidateRoster[0].athlete_seasons[0].jersey_number).toBe(17);
    expect(first.rows[0].changes).toContainEqual({ field: "season", before: null, after: "2027" });
    expect(previewRoster(source, suggestRosterMapping(source.headers), "2027", first.candidateRoster).counts.unchanged).toBe(1);
  });
  it("blocks new identities at the roster capacity while still allowing existing athlete updates", () => {
    const full = Array.from({ length: 1000 }, (_, index) => athlete(`PAC-${String(index + 1).padStart(4, "0")}`, "Fictional", `Example ${index + 1}`, `fictional.${index + 1}@example.com`));
    const source = table(["first_name", "last_name"], [["Fictional", "Additional"]]);
    const blocked = previewRoster(source, suggestRosterMapping(source.headers), "2026", full);
    expect(blocked.canApply).toBe(false);
    expect(blocked.candidateRoster).toHaveLength(1000);
    expect(blocked.rows[0].issues.some(value => value.field === "capacity")).toBe(true);
    const update = table(["athlete_code", "jersey_number"], [["PAC-0001", "0"]]);
    expect(previewRoster(update, suggestRosterMapping(update.headers), "2026", full).canApply).toBe(true);
  });
  it("recomputes against current roster state so a changed email match cannot reuse an old preview", () => {
    const source = table(["pacific_email", "jersey_number"], [["fictional@example.com", "0"]]);
    const mapping = suggestRosterMapping(source.headers);
    expect(previewRoster(source, mapping, "2026", roster).canApply).toBe(true);
    const changed = [athlete("PAC-0001", "Fictional", "Example", "changed@example.com")];
    expect(previewRoster(source, mapping, "2026", changed).canApply).toBe(false);
  });
});

describe("browser-local RENPHO identity", () => {
  it("adds only the local canonical field and recognizes the explicit ID aliases", () => {
    expect(HEADERS).toHaveLength(16);
    expect(HEADERS).not.toContain("renpho_id");
    expect(ROSTER_FIELDS).toEqual([...HEADERS, "renpho_id"]);
    for (const header of ["renpho_id", "RENPHO ID", "Renpho ID", "RenphoID"]) expect(suggestRosterMapping([header])).toEqual({ renpho_id: 0 });
    expect(() => suggestRosterMapping(["RENPHO ID", "RenphoID"])).toThrow("Multiple source headers");
  });

  it("normalizes exact report IDs and never matches names, code fields, or ID prefixes", () => {
    const saved = [{ ...athlete(), renpho_id: "SYNTHETIC-PRIMARY-A", renpho_ids: ["SYNTHETIC-REPORT-20260904"] }];
    expect(normalizeRenphoId(" synthetic-primary-a ")).toBe("SYNTHETIC-PRIMARY-A");
    expect(findRenphoAthlete(saved, " synthetic-primary-a ")).toBe("PAC-0001");
    expect(findRenphoAthlete(saved, "synthetic-report-20260904")).toBe("PAC-0001");
    for (const id of ["", "FICTIONAL", "PAC-0001", "SYNTHETIC-REPORT", "SYNTHETIC-REPORT-20260905"]) expect(findRenphoAthlete(saved, id)).toBeNull();
    expect(() => findRenphoAthlete(saved, "invalid id")).toThrow("RENPHO ID");
  });

  it("preserves former canonical IDs and blank updates without mutating the current roster", () => {
    const saved = [{ ...athlete(), renpho_id: "SYNTHETIC-PRIMARY-A", renpho_ids: ["SYNTHETIC-OLDER-A"] }];
    const before = structuredClone(saved);
    const source = table(["athlete_code", "RENPHO ID"], [["PAC-0001", " synthetic-primary-b "]]);
    const preview = previewRoster(source, suggestRosterMapping(source.headers), "2026", saved);
    expect(preview.canApply).toBe(true);
    expect(preview.rows[0].changes).toEqual([{ field: "renpho_id", before: "SYNTHETIC-PRIMARY-A", after: "SYNTHETIC-PRIMARY-B" }]);
    expect(preview.candidateRoster[0]).toMatchObject({ renpho_id: "SYNTHETIC-PRIMARY-B", renpho_ids: ["SYNTHETIC-OLDER-A", "SYNTHETIC-PRIMARY-A"] });
    expect(saved).toEqual(before);
    expect(findRenphoAthlete(preview.candidateRoster, "SYNTHETIC-PRIMARY-A")).toBe("PAC-0001");
    const blank = table(source.headers, [["PAC-0001", ""]]);
    const unchanged = previewRoster(blank, suggestRosterMapping(blank.headers), "2026", preview.candidateRoster);
    expect(unchanged.counts.unchanged).toBe(1);
    expect(unchanged.candidateRoster).toEqual(preview.candidateRoster);
    const promote = table(source.headers, [["PAC-0001", "SYNTHETIC-OLDER-A"]]);
    const promoted = previewRoster(promote, suggestRosterMapping(promote.headers), "2026", preview.candidateRoster);
    expect(promoted.candidateRoster[0]).toMatchObject({ renpho_id: "SYNTHETIC-OLDER-A", renpho_ids: ["SYNTHETIC-PRIMARY-A", "SYNTHETIC-PRIMARY-B"] });
  });

  it("rejects IDs already belonging to another athlete, including aliases, without creating a player by report ID", () => {
    const saved = [{ ...athlete(), renpho_id: "SYNTHETIC-PRIMARY-A", renpho_ids: ["SYNTHETIC-REPORT-A"] }];
    for (const id of ["SYNTHETIC-PRIMARY-A", "SYNTHETIC-REPORT-A"]) {
      const source = table(["First Name", "Last Name", "RENPHO ID"], [["Fictional", "Different", id]]);
      const preview = previewRoster(source, suggestRosterMapping(source.headers), "2026", saved);
      expect(preview.canApply).toBe(false);
      expect(preview.rows[0].issues.some(issue => issue.field === "renpho_id")).toBe(true);
      expect(preview.candidateRoster).toEqual(saved);
    }
    const duplicate = table(["First Name", "Last Name", "RENPHO ID"], [["Fictional", "One", "synthetic-new"], ["Fictional", "Two", "SYNTHETIC-NEW"]]);
    expect(previewRoster(duplicate, suggestRosterMapping(duplicate.headers), "2026", []).counts.reject).toBe(2);
  });

  it("fails closed when existing canonical and alias IDs belong to different athletes", () => {
    const saved = [{ ...athlete(), renpho_id: "SYNTHETIC-DUPLICATE" }, { ...athlete("PAC-0002", "Fictional", "Other", "other@example.com"), renpho_ids: ["SYNTHETIC-DUPLICATE"] }];
    expect(() => findRenphoAthlete(saved, "SYNTHETIC-DUPLICATE")).toThrow("more than one athlete");
    const source = table(["athlete_code", "Jersey Number"], [["PAC-0001", "0"]]);
    expect(() => previewRoster(source, suggestRosterMapping(source.headers), "2026", saved)).toThrow("more than one athlete");
  });

  it.each(["SYNTHETIC ID", "SYNTHETIC.ID", "SYNTHETIC\nID", "A".repeat(81)])("rejects an unsupported RENPHO ID value: %s", id => {
    const source = table(["First Name", "Last Name", "RENPHO ID"], [["Fictional", "Invalid", id]]);
    const preview = previewRoster(source, suggestRosterMapping(source.headers), "2026", []);
    expect(preview.canApply).toBe(false);
    expect(preview.candidateRoster).toEqual([]);
  });
});

describe("measurement dates and numeric values", () => {
  it("requires an explicit format and validates calendar dates including leap years", () => {
    expect(parseMeasurementDate("2024-02-29", "ISO")).toBe("2024-02-29");
    expect(parseMeasurementDate("01/02/2024", "MDY")).toBe("2024-01-02");
    expect(parseMeasurementDate("01/02/2024", "DMY")).toBe("2024-02-01");
    for (const value of ["2023-02-29", "2026-13-01", "2026-00-01", "2026-09-31", "2026-09-00", "2026-9-4", "01/02/2024", "2026-09-04T12:00:00Z"]) expect(() => parseMeasurementDate(value, "ISO")).toThrow();
    expect(() => parseMeasurementDate("1/2/24", "MDY")).toThrow("two-digit years");
    expect(() => parseMeasurementDate("13/1/2024", "MDY")).toThrow("calendar");
  });
  it("requires units and a source; does not infer either from column labels", () => {
    expect(() => runMeasurements(undefined, { ...measurementMapping, metrics: [{ column: 2, label: "Speed (mph)", unit: "" }] })).toThrow("explicit unit");
    expect(() => runMeasurements(undefined, { ...measurementMapping, source: " " })).toThrow("source label");
    expect(() => runMeasurements(undefined, { ...measurementMapping, dateColumn: undefined, fixedDate: "" })).toThrow("test-date");
  });
  it("preserves zero and negatives without conversions, and skips blank measurements", () => {
    const source = table(["Athlete", "Date", "Test", "Other test"], [["PAC-0001", "2026-09-04", "0", "-1.25"], ["PAC-0001", "2026-09-05", "", ""]]);
    const preview = runMeasurements(source, { ...measurementMapping, metrics: [...measurementMapping.metrics, { column: 3, label: "Another test", unit: "user unit" }] });
    expect(preview.canApply).toBe(true);
    expect(preview.candidateMeasurements.map(m => m.value)).toEqual([0, -1.25]);
    expect(preview.counts).toEqual({ create: 1, update: 0, unchanged: 1, reject: 0 });
  });
  it.each(["#DIV/0!", "#VALUE!", "15%", "<5", "2 s", "1,234", "NaN", "Infinity", "1e999"])("rejects mixed/formula/nonfinite measurement %s", value => {
    const source = table(["Athlete", "Date", "Test"], [["PAC-0001", "2026-09-04", value]]);
    const preview = runMeasurements(source);
    expect(preview.canApply).toBe(false);
    expect(preview.candidateMeasurements).toEqual([]);
    expect(preview.rows[0].status).toBe("reject");
  });
  it("supports a user-selected fixed test date and rejects invalid row dates", () => {
    const preview = runMeasurements(table(["Athlete", "Ignored", "Test"], [["PAC-0001", "", "5"]]), { ...measurementMapping, dateColumn: undefined, fixedDate: "09/04/2026", dateFormat: "MDY" });
    expect(preview.candidateMeasurements[0].measured_at).toBe("2026-09-04");
    expect(runMeasurements(table(["Athlete", "Date", "Test"], [["PAC-0001", "2026-02-30", "5"]])).canApply).toBe(false);
  });
});

describe("measurement identity and repeat imports", () => {
  it("uses only unique exact normalized names and flags every automatic name match for review", () => {
    const source = table(["Name", "Date", "Test"], [[" fictional    EXAMPLE ", "2026-09-04", "1"]]);
    const mapping = { ...measurementMapping, identityKind: "name" as const };
    const preview = runMeasurements(source, mapping);
    expect(preview.nameMatches).toBe(1);
    expect(preview.rows[0]).toMatchObject({ matchMethod: "name", requiresNameReview: true, athlete_code: "PAC-0001" });
    expect(runMeasurements(table(["Name", "Date", "Test"], [["Example", "2026-09-04", "1"]]), mapping).canApply).toBe(false);
    expect(runMeasurements(source, mapping, [], context, [athlete(), athlete("PAC-0002")]).canApply).toBe(false);
  });
  it("uses explicit athlete-code overrides to resolve ambiguous names and validates the chosen code", () => {
    const source = table(["Name", "Date", "Test"], [["Fictional Example", "2026-09-04", "1"]]);
    const athletes = [athlete(), athlete("PAC-0002")];
    const mapping: MeasurementMapping = { ...measurementMapping, identityKind: "name", identityOverrides: { "Fictional Example": "PAC-0002" } };
    const preview = runMeasurements(source, mapping, [], context, athletes);
    expect(preview.rows[0]).toMatchObject({ athlete_code: "PAC-0002", matchMethod: "override", requiresNameReview: false });
    expect(runMeasurements(source, { ...mapping, identityOverrides: { "Fictional Example": "MISSING" } }, [], context, athletes).canApply).toBe(false);
  });
  it("matches normalized email without creating accounts and rejects missing or unknown identity", () => {
    const mapping = { ...measurementMapping, identityKind: "email" as const };
    const source = table(["Email", "Date", "Test"], [[" FICTIONAL@EXAMPLE.COM ", "2026-09-04", "1"]]);
    expect(runMeasurements(source, mapping).rows[0].matchMethod).toBe("email");
    for (const identity of ["", "missing@example.com"]) {
      expect(runMeasurements(table(["Email", "Date", "Test"], [[identity, "2026-09-04", "1"]]), mapping).canApply).toBe(false);
    }
  });
  it("retains repeated trials and source provenance, but makes an identical reimport unchanged", () => {
    const source = table(["Athlete", "Date", "Trial1", "Trial2"], [["PAC-0001", "2026-09-04", "1", "1"], ["PAC-0001", "2026-09-04", "1", "1"]]);
    const mapping = { ...measurementMapping, metrics: [{ column: 2, label: "Test", unit: "s" }, { column: 3, label: "Test", unit: "s" }] };
    const preview = runMeasurements(source, mapping);
    expect(preview.candidateMeasurements).toHaveLength(4);
    expect(new Set(preview.candidateMeasurements.map(m => m.id)).size).toBe(4);
    expect(preview.candidateMeasurements[0]).toMatchObject({ source_file: context.fileName, source_sheet: "Tests", source_row: 2, file_hash: context.fileHash });
    const replay = runMeasurements(source, mapping, preview.candidateMeasurements);
    expect(replay.candidateMeasurements).toEqual([]);
    expect(replay.counts.unchanged).toBe(2);
    expect(replay.canApply).toBe(true);
  });
  it("rejects changed date, unit, label, identity, or value for an already imported source observation", () => {
    const first = runMeasurements();
    const existing = first.candidateMeasurements;
    const unitChange = { ...measurementMapping, metrics: [{ column: 2, label: "User-selected test", unit: "ms" }] };
    expect(runMeasurements(undefined, unitChange, existing).canApply).toBe(false);
    const labelChange = { ...measurementMapping, metrics: [{ column: 2, label: "Different test", unit: "s" }] };
    expect(runMeasurements(undefined, labelChange, existing).canApply).toBe(false);
    for (const row of [["PAC-0001", "2026-09-05", "0"], ["PAC-0001", "2026-09-04", "1"]]) {
      expect(runMeasurements(table(["Athlete", "Date", "Test"], [row]), measurementMapping, existing).canApply).toBe(false);
    }
    expect(runMeasurements(undefined, { ...measurementMapping, identityOverrides: { "PAC-0001": "PAC-0002" } }, existing, context, [...roster, athlete("PAC-0002")]).canApply).toBe(false);
  });
  it("keeps different files/sheets distinct and does not duplicate a renamed identical file", () => {
    const existing = runMeasurements().candidateMeasurements;
    expect(runMeasurements(undefined, undefined, existing, { ...context, fileHash: "b".repeat(64) }).candidateMeasurements).toHaveLength(1);
    expect(runMeasurements(undefined, undefined, existing, { ...context, sheetName: "Other tests" }).candidateMeasurements).toHaveLength(1);
    expect(runMeasurements(undefined, undefined, existing, { ...context, fileName: "renamed.csv" }).candidateMeasurements).toHaveLength(0);
  });
  it("blocks whole apply if one row fails and discards all candidate observations for that failed row", () => {
    const source = table(["Athlete", "Date", "Good", "Bad"], [["PAC-0001", "2026-09-04", "1", "2"], ["PAC-0001", "2026-09-05", "1", "#DIV/0!"]]);
    const mapping = { ...measurementMapping, metrics: [{ column: 2, label: "Good", unit: "s" }, { column: 3, label: "Bad", unit: "s" }] };
    const preview = runMeasurements(source, mapping);
    expect(preview.canApply).toBe(false);
    expect(preview.candidateMeasurements).toHaveLength(2);
    expect(preview.counts.reject).toBe(1);
  });
  it("caps combined local measurement capacity and checks stale repeated observation content", () => {
    const single = runMeasurements().candidateMeasurements[0];
    const full = Array.from({ length: MAX_MEASUREMENTS }, (_, i) => ({ ...single, id: `other-${i}` }));
    const preview = runMeasurements(undefined, undefined, full);
    expect(preview.canApply).toBe(false);
    expect(preview.issues.some(i => i.field === "capacity")).toBe(true);
    expect(runMeasurements(undefined, undefined, [{ ...single, value: 99 }]).canApply).toBe(false);
  });
});
