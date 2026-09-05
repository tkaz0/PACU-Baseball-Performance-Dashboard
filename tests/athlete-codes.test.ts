import { describe, expect, it } from "vitest";
import { athleteCodeIndex, nextPacCode, pacCodeForLegacy, resolveAthleteCode } from "@/lib/athlete-codes";
import { getPreviewRoster } from "@/lib/preview-roster";
import { migrateWorkspaceAthleteCodes, validateWorkspace, type LocalWorkspace } from "@/lib/local-workspace";
import { canonicalLocalView, localViewAllowsPath, projectLocalView } from "@/lib/local-view";
import { previewRoster, previewMeasurements, suggestRosterMapping, type ImportTable } from "@/lib/imports/engine";
import { reviewPerformanceImport } from "@/lib/performance-import";

const table = (headers: string[], rows: string[][]): ImportTable => ({ headers, rows, rowNumbers: rows.map((_, i) => i + 2) });
function workspace(): LocalWorkspace {
  const roster = getPreviewRoster().slice(0, 2).map((athlete, index) => {
    const code = `LOCAL-000${index + 1}`;
    return { ...athlete, athlete_code: code, id: code, athlete_seasons: athlete.athlete_seasons.map(season => ({ ...season, athlete_id: code })) };
  });
  return { version: 1, revision: 5, mode: "local", roster,
    measurements: [{ id: `observation:${JSON.stringify(["a".repeat(64), "CSV", 2, 1])}`, athlete_code: "LOCAL-0001", measured_at: "2026-09-12", metric: "Weight", value: 0, unit: "lb", source: "Fictional protocol", source_file: "fictional.csv", source_sheet: "CSV", source_row: 2, file_hash: "a".repeat(64), batch_id: "fictional-batch" }],
    batches: [{ id: "fictional-batch", kind: "measurements", fileName: "fictional.csv", source: "Fictional protocol", importedAt: "2026-09-12T00:00:00Z", created: 1, updated: 0, unchanged: 0 }],
  };
}

describe("permanent PAC identities", () => {
  it("preserves the exact legacy number and never renumbers fictional or unrelated IDs", () => {
    expect(pacCodeForLegacy("LOCAL-0001")).toBe("PAC-0001");
    expect(pacCodeForLegacy("LOCAL-10000")).toBe("PAC-10000");
    for (const code of ["LOCAL-0000", "LOCAL-01", "LOCAL-00001", "local-0001", "SYN-001", "TEAM-001", "PAC-0001"]) expect(pacCodeForLegacy(code)).toBeNull();
  });
  it("migrates all references without changing source observations, zero values, batches or roster order", () => {
    const old = workspace(), snapshot = JSON.stringify(old), migrated = migrateWorkspaceAthleteCodes(old);
    expect(JSON.stringify(old)).toBe(snapshot);
    expect(migrated.roster.map(a => a.athlete_code)).toEqual(["PAC-0001", "PAC-0002"]);
    expect(migrated.roster[0].athlete_code_aliases).toEqual(["LOCAL-0001"]);
    expect(migrated.roster[0].athlete_seasons[0].athlete_id).toBe("PAC-0001");
    expect(migrated.measurements[0]).toEqual({ ...old.measurements[0], athlete_code: "PAC-0001" });
    expect(migrated.batches).toEqual(old.batches);
    expect(migrated.revision).toBe(old.revision);
    expect(migrateWorkspaceAthleteCodes(migrated)).toBe(migrated);
    expect(migrateWorkspaceAthleteCodes({ ...old, roster: [...old.roster].reverse() }).roster.map(a => a.athlete_code)).toEqual(["PAC-0002", "PAC-0001"]);
  });
  it("fails closed when a target PAC ID already belongs to another identity", () => {
    const old = workspace();
    old.roster[1] = { ...old.roster[1], athlete_code: "PAC-0001", id: "PAC-0001", athlete_seasons: [] };
    expect(() => migrateWorkspaceAthleteCodes(old)).toThrow("conflicts");
  });
  it.each([{ aliases: ['LOCAL-0001', 'LOCAL-0001'] }, { aliases: ['PAC-0002'] }, { aliases: ['PAC-0001'] }, { aliases: [' bad '] }, { aliases: [42] }])("rejects duplicate, reused or malformed aliases %#", ({ aliases }) => {
    const migrated = migrateWorkspaceAthleteCodes(workspace());
    Object.assign(migrated.roster[0], { athlete_code_aliases: aliases });
    expect(() => validateWorkspace(migrated)).toThrow("valid PACU workspace");
  });
  it("reserves previous IDs and advances monotonically past existing and proposed codes", () => {
    expect(nextPacCode([])).toBe("PAC-0001");
    expect(nextPacCode(["PAC-0001", "PAC-0003", "LOCAL-0009", "SYN-999"])).toBe("PAC-0010");
    expect(() => nextPacCode(["PAC-999999999"])).toThrow("sequence is full");
  });
  it("resolves only recorded exact aliases, including player-view links", () => {
    const migrated = migrateWorkspaceAthleteCodes(workspace()), roster = migrated.roster;
    expect(resolveAthleteCode(roster, "LOCAL-0001")).toBe("PAC-0001");
    expect(resolveAthleteCode(roster, "LOCAL-0003")).toBeNull();
    expect(resolveAthleteCode(roster, roster[0].first_name)).toBeNull();
    const oldView = { role: "player" as const, athleteCode: "LOCAL-0001" };
    expect(canonicalLocalView(oldView, roster)).toEqual({ role: "player", athleteCode: "PAC-0001" });
    expect(projectLocalView(oldView, roster, migrated.measurements).roster).toEqual([roster[0]]);
    for (const code of ["LOCAL-0001", "PAC-0001"]) expect(localViewAllowsPath(oldView, `/preview/athletes/${code}`, roster)).toBe(true);
    for (const code of ["LOCAL-0002", "PAC-0002", "PAC-0001/extra"]) expect(localViewAllowsPath(oldView, `/preview/athletes/${code}`, roster)).toBe(false);
    expect(() => athleteCodeIndex([roster[0], { ...roster[1], athlete_code_aliases: ['LOCAL-0001'] }])).toThrow("conflict");
  });
  it("old and new roster codes update one identity and reject duplicates within one input", () => {
    const { roster } = migrateWorkspaceAthleteCodes(workspace());
    const old = table(["athlete_code", "jersey_number"], [["LOCAL-0001", "0"]]);
    const preview = previewRoster(old, suggestRosterMapping(old.headers), "2026", roster);
    expect(preview.canApply).toBe(true); expect(preview.rows[0].athlete_code).toBe("PAC-0001");
    expect(preview.candidateRoster).toHaveLength(2);
    const duplicates = table(old.headers, [["LOCAL-0001", "0"], ["PAC-0001", "0"]]);
    expect(previewRoster(duplicates, suggestRosterMapping(old.headers), "2026", roster).counts.reject).toBe(2);
  });
  it("accepts supported identity corrections but rejects a different name and email on an occupied PAC ID", () => {
    const { roster } = migrateWorkspaceAthleteCodes(workspace());
    const headers = ["athlete_code", "first_name", "last_name", "pacific_email"];
    const run = (first: string, last: string, email: string) => previewRoster(table(headers, [["PAC-0001", first, last, email]]), suggestRosterMapping(headers), "2026", roster);
    expect(run("Fictional Corrected", roster[0].last_name, roster[0].pacific_email!).canApply).toBe(true);
    expect(run(roster[0].first_name, roster[0].last_name, "fictional.corrected@example.com").canApply).toBe(true);
    expect(run("Fictional Other", "Different", "fictional.other@example.com").canApply).toBe(false);
  });
  it("keeps a measurement reimport unchanged through the recorded old alias", () => {
    const migrated = migrateWorkspaceAthleteCodes(workspace());
    const input = table(["athlete", "value"], [["LOCAL-0001", "0"]]);
    const preview = previewMeasurements(input, { identityKind: "code", identityColumn: 0, dateFormat: "ISO", fixedDate: "2026-09-12", source: "Fictional protocol", metrics: [{ column: 1, label: "Weight", unit: "lb" }] }, migrated.roster, migrated.measurements, { fileHash: "a".repeat(64), fileName: "fictional.csv", sheetName: "CSV" });
    expect(preview.canApply).toBe(true); expect(preview.counts.unchanged).toBe(1); expect(preview.candidateMeasurements).toEqual([]);
  });
  it("prepares old backup measurements for the shared PAC roster without uploading aliases or extra backup fields", () => {
    const old = workspace();
    old.measurements[0].value = 1;
    const restored = migrateWorkspaceAthleteCodes(validateWorkspace(JSON.parse(JSON.stringify(old))));
    const review = reviewPerformanceImport(restored.measurements);
    expect(review.canApply).toBe(true);
    expect(review.candidateMeasurements[0].athlete_code).toBe("PAC-0001");
    expect(review.candidateMeasurements[0].id).toBe(old.measurements[0].id);
    expect(review.candidateMeasurements[0]).not.toHaveProperty("athlete_code_aliases");
    expect(review.candidateMeasurements[0]).not.toHaveProperty("batch_id");
  });
});
