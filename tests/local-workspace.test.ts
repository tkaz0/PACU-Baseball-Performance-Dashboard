import { describe, expect, it } from "vitest";
import { emptyWorkspace, validateWorkspace, type LocalWorkspace } from "@/lib/local-workspace";
import { getPreviewRoster } from "@/lib/preview-roster";

function validWorkspace(): LocalWorkspace {
  return {
    version: 1, revision: 3, mode: "local",
    roster: [getPreviewRoster().find(athlete => athlete.athlete_code === "SYN-001")!],
    batches: [{
      id: "batch-one", kind: "measurements", fileName: "fictional-measurements.csv", source: "Synthetic test",
      importedAt: "2026-09-04T12:00:00.000Z", created: 1, updated: 0, unchanged: 0,
    }],
    measurements: [{
      id: "measurement-one", athlete_code: "SYN-001", measured_at: "2026-09-04",
      metric: "Jump height", value: 0, unit: "cm", source: "Synthetic test",
      source_file: "fictional-measurements.csv", source_sheet: "", source_row: 2,
      file_hash: "a".repeat(64), batch_id: "batch-one",
    }],
  };
}

const rejectsBackup = (value: unknown) => expect(() => validateWorkspace(value)).toThrow(/valid PACU workspace backup/);

describe("local workspace backup validation", () => {
  it("accepts an empty sample and a JSON-round-tripped local workspace without losing zero or null", () => {
    expect(validateWorkspace(JSON.parse(JSON.stringify(emptyWorkspace())))).toEqual(emptyWorkspace());
    const backup = JSON.parse(JSON.stringify(validWorkspace()));
    const restored = validateWorkspace(backup);
    expect(restored.measurements[0].value).toBe(0);
    expect(restored.roster[0].athlete_seasons[0].jersey_number).toBe(0);
    expect(restored.roster[0].profile_photo_url).toBeNull();
    expect(restored).toEqual(backup);
  });

  it.each([
    null, [], {}, { ...emptyWorkspace(), version: 2 }, { ...emptyWorkspace(), mode: "cloud" },
    { ...emptyWorkspace(), mode: ["sample"] },
    { ...emptyWorkspace(), revision: -1 }, { ...emptyWorkspace(), revision: 0.5 },
    { ...emptyWorkspace(), revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...emptyWorkspace(), roster: null }, { ...emptyWorkspace(), measurements: {} },
    { ...emptyWorkspace(), batches: undefined },
  ])("rejects an incompatible or incomplete top-level backup %#", value => {
    rejectsBackup(value);
  });

  it("does not allow saved records to masquerade as the built-in sample workspace", () => {
    const backup = validWorkspace();
    backup.mode = "sample";
    rejectsBackup(backup);
  });

  it.each(["syn-001", " SYN-001", "A", "A".repeat(41)])("rejects a noncanonical or invalid permanent code: %s", code => {
    const backup = validWorkspace();
    backup.roster[0].id = backup.roster[0].athlete_code = code;
    backup.roster[0].athlete_seasons[0].athlete_id = code;
    backup.measurements[0].athlete_code = code;
    rejectsBackup(backup);
  });

  it("rejects repeated roster emails and requires stored email normalization", () => {
    const backup = validWorkspace();
    const duplicate = structuredClone(backup.roster[0]);
    duplicate.id = duplicate.athlete_code = "SYN-002";
    duplicate.athlete_seasons[0].athlete_id = duplicate.id;
    backup.roster.push(duplicate);
    rejectsBackup(backup);
    for (const email of ["SYNTHETIC.AVERY@EXAMPLE.COM", " synthetic.avery@example.com", "not-an-email"]) {
      const invalid = validWorkspace();
      invalid.roster[0].pacific_email = email;
      rejectsBackup(invalid);
    }
  });

  it.each([
    ["jersey_number", -1], ["jersey_number", 100], ["jersey_number", 1.5],
    ["eligibility_year", 0], ["eligibility_year", 7], ["graduation_year", 1999], ["graduation_year", 2101],
    ["primary_position", "cf"], ["secondary_position", "N/A"], ["player_type", "position player"],
    ["bats", "B"], ["throws", "r"], ["academic_class", "first year"], ["roster_status", "eligible"],
    ["season", "26"], ["season", "2026-2027"], ["season", "2026 "],
  ])("applies importer rules to backed-up season field %s=%s", (field, invalid) => {
    const backup = validWorkspace();
    Object.assign(backup.roster[0].athlete_seasons[0], { [field]: invalid });
    rejectsBackup(backup);
  });

  it("validates identity fields even for an athlete without seasons", () => {
    for (const name of [" ", " Fictional Avery", "A".repeat(81), "Fictional\nAvery"]) {
      const backup = validWorkspace();
      backup.roster[0].athlete_seasons = [];
      backup.roster[0].first_name = name;
      rejectsBackup(backup);
    }
  });

  it("supports the importer's full 2,048-character HTTPS photo URL limit", () => {
    const backup = validWorkspace();
    backup.roster[0].profile_photo_url = "https://example.com/".padEnd(2048, "a");
    expect(validateWorkspace(backup)).toEqual(backup);
    for (const photo of [backup.roster[0].profile_photo_url + "a", "http://example.com/photo.png", "https://user:pass@example.com/photo.png", "javascript:alert(1)"]) {
      rejectsBackup({ ...backup, roster: [{ ...backup.roster[0], profile_photo_url: photo }] });
    }
  });

  it("accepts optional provenance metadata without requiring it on older backups", () => {
    const backup = validWorkspace();
    expect(validateWorkspace(backup)).toEqual(backup);
    Object.assign(backup.batches[0], { fileHash: "b".repeat(64), sheetName: "S".repeat(255), season: "2026-27" });
    expect(validateWorkspace(JSON.parse(JSON.stringify(backup)))).toEqual(backup);
  });

  it.each([
    ["fileHash", "not-a-hash"], ["fileHash", "A".repeat(64)], ["fileHash", "a".repeat(65)],
    ["fileHash", null], ["sheetName", "S".repeat(256)], ["sheetName", "Sheet\nOne"],
    ["sheetName", 1], ["season", "2026-2027"], ["season", null],
  ])("rejects invalid optional batch metadata %s", (field, invalid) => {
    const backup = validWorkspace();
    Object.assign(backup.batches[0], { [field]: invalid });
    rejectsBackup(backup);
  });

  it("requires a measurement reference to point to a measurement batch", () => {
    const backup = validWorkspace();
    backup.batches[0].kind = "roster";
    rejectsBackup(backup);
    const malformed = validWorkspace();
    Object.assign(malformed.batches[0], { kind: ["measurements"] });
    rejectsBackup(malformed);
  });

  it.each([
    ["measurement athlete", (backup: LocalWorkspace) => { backup.measurements[0].athlete_code = "SYN-999"; }],
    ["measurement batch", (backup: LocalWorkspace) => { backup.measurements[0].batch_id = "missing-batch"; }],
    ["season athlete", (backup: LocalWorkspace) => { backup.roster[0].athlete_seasons[0].athlete_id = "SYN-999"; }],
    ["profile identity", (backup: LocalWorkspace) => { backup.roster[0].id = "SYN-999"; }],
  ] as const)("rejects a disconnected %s reference", (_label, mutate) => {
    const backup = validWorkspace();
    mutate(backup);
    rejectsBackup(backup);
  });

  it.each([
    ["athlete codes", (backup: LocalWorkspace) => { backup.roster.push(structuredClone(backup.roster[0])); }],
    ["athlete seasons", (backup: LocalWorkspace) => { backup.roster[0].athlete_seasons.push({ ...backup.roster[0].athlete_seasons[0] }); }],
    ["measurement IDs", (backup: LocalWorkspace) => { backup.measurements.push({ ...backup.measurements[0] }); }],
    ["batch IDs", (backup: LocalWorkspace) => { backup.batches.push({ ...backup.batches[0] }); }],
  ] as const)("rejects duplicate %s", (_label, mutate) => {
    const backup = validWorkspace();
    mutate(backup);
    rejectsBackup(backup);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])("rejects nonfinite measurement and roster numbers: %s", invalid => {
    const measurementBackup = validWorkspace();
    measurementBackup.measurements[0].value = invalid;
    rejectsBackup(measurementBackup);
    const rosterBackup = validWorkspace();
    rosterBackup.roster[0].athlete_seasons[0].jersey_number = invalid;
    rejectsBackup(rosterBackup);
  });

  it.each(["2026-02-30", "2026-13-01", "09/04/2026", "2026-09-04T00:00:00Z"])("rejects an invalid or noncanonical measurement date: %s", date => {
    const backup = validWorkspace();
    backup.measurements[0].measured_at = date;
    rejectsBackup(backup);
  });

  it("rejects truncated measurement metadata and invalid import counts", () => {
    for (const field of ["metric", "unit", "source"] as const) {
      const backup = validWorkspace();
      backup.measurements[0][field] = " ";
      rejectsBackup(backup);
    }
    for (const count of [-1, 0.5, Number.NaN]) {
      const backup = validWorkspace();
      backup.batches[0].created = count;
      rejectsBackup(backup);
    }
    for (const sourceRow of [0, -1, 1.5]) {
      const backup = validWorkspace();
      backup.measurements[0].source_row = sourceRow;
      rejectsBackup(backup);
    }
  });

  it("accepts the documented capacities and rejects one additional unique record", () => {
    const backup = validWorkspace();
    const athlete = backup.roster[0];
    backup.roster = Array.from({ length: 1000 }, (_, index) => {
      const code = index === 0 ? "SYN-001" : `LOCAL-${String(index).padStart(4, "0")}`;
      return { ...athlete, id: code, athlete_code: code, pacific_email: `fictional.${index}@example.com`, athlete_seasons: athlete.athlete_seasons.map(season => ({ ...season, athlete_id: code })) };
    });
    backup.measurements = Array.from({ length: 20000 }, (_, index) => ({ ...backup.measurements[0], id: `measurement-${index}`, source_row: index + 1 }));
    backup.batches = Array.from({ length: 1000 }, (_, index) => ({ ...backup.batches[0], id: index === 0 ? "batch-one" : `batch-${index}` }));
    expect(validateWorkspace(backup)).toEqual(backup);

    const extraAthlete = { ...athlete, id: "LOCAL-1000", athlete_code: "LOCAL-1000", pacific_email: "fictional.1000@example.com", athlete_seasons: [] };
    rejectsBackup({ ...backup, roster: [...backup.roster, extraAthlete] });
    rejectsBackup({ ...backup, measurements: [...backup.measurements, { ...backup.measurements[0], id: "measurement-extra" }] });
    rejectsBackup({ ...backup, batches: [...backup.batches, { ...backup.batches[0], id: "batch-extra" }] });
  });

  it("leaves the supplied backup untouched when a late reference check fails", () => {
    const backup = validWorkspace();
    backup.measurements[0].batch_id = "missing-batch";
    const before = structuredClone(backup);
    rejectsBackup(backup);
    expect(backup).toEqual(before);
  });
});
