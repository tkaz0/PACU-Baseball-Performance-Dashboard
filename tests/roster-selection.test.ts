import { describe, expect, it } from "vitest";
import { selectRosterSummaries } from "@/lib/imports/roster-selection";
import { getPreviewRoster } from "@/lib/preview-roster";
import { previewMeasurements, type MeasurementMapping } from "@/lib/imports/engine";
import { previewFullSwingSummary } from "@/lib/imports/full-swing";
import { FULL_SWING_SESSION_HEADERS, SESSION_METRICS, summarizeFullSwingSession } from "@/lib/imports/full-swing-session";

const roster = getPreviewRoster(), player = roster[0], second = roster[1];
const name = `${player.first_name} ${player.last_name}`;
const mapping: MeasurementMapping = { identityKind: "name", identityColumn: 0, fixedDate: "2026-09-11", dateFormat: "ISO", source: "Full Swing · Hitting", metrics: [{ column: 1, label: "Max EV", unit: "mph" }] };
const table = { headers: ["Player", "Max EV"], rows: [["Fictional Guest", "95"], [name, "90"]], rowNumbers: [4, 8] };
const file = { fileHash: "a".repeat(64), fileName: "fictional.csv", sheetName: "CSV" };

describe("roster-only import selection", () => {
  it("skips guests without blocking known players or renumbering source observations", () => {
    const selection = selectRosterSummaries(table, mapping, roster);
    expect(selection.skipped.map(p => p.identity)).toEqual(["Fictional Guest"]);
    expect(selection.table.rowNumbers).toEqual([8]);
    const before = previewMeasurements(table, mapping, roster, [], file);
    const after = previewMeasurements(selection.table, mapping, roster, [], file);
    expect(before.canApply).toBe(false); expect(after.canApply).toBe(true);
    expect(after.candidateMeasurements).toEqual(before.candidateMeasurements);
    expect(after.candidateMeasurements[0].id).toBe(`observation:${JSON.stringify([file.fileHash, "CSV", 8, 1])}`);
  });
  it("allows an explicit roster match later, and explicit exclusion of any matched name", () => {
    const matched = { ...mapping, identityOverrides: { "Fictional Guest": second.athlete_code } };
    expect(selectRosterSummaries(table, matched, roster).skipped).toHaveLength(0);
    const selected = selectRosterSummaries(table, matched, roster, [name]);
    expect(selected.table.rowNumbers).toEqual([4]);
    expect(selected.skipped[0].reason).toBe("Excluded by staff");
    expect(selectRosterSummaries(table, matched, roster, [name, "Fictional Guest"]).table.rows).toHaveLength(0);
  });
  it("excludes ambiguous names until explicitly matched; never guesses surnames", () => {
    const duplicate = { ...second, first_name: player.first_name, last_name: player.last_name };
    expect(selectRosterSummaries(table, mapping, [player, duplicate]).table.rows).toHaveLength(0);
    const matched = { ...mapping, identityOverrides: { [name]: player.athlete_code } };
    expect(selectRosterSummaries(table, matched, [player, duplicate]).table.rowNumbers).toEqual([8]);
    expect(selectRosterSummaries({ ...table, rows: [[player.last_name, "90"]], rowNumbers: [8] }, mapping, roster).table.rows).toHaveLength(0);
  });
  it("uses exactly the final preview's normalization and permanent-code aliases", () => {
    for (const [kind, identity] of [["name", `  ${player.first_name.toUpperCase()}   ${player.last_name} `], ["email", player.pacific_email!.toUpperCase()], ["code", "LEGACY-001"]] as const) {
      const athletes = [{ ...player, athlete_code_aliases: ["LEGACY-001"] }];
      const input = { ...table, rows: [[identity, "90"]], rowNumbers: [8] }, selectedMapping = { ...mapping, identityKind: kind };
      const selection = selectRosterSummaries(input, selectedMapping, athletes);
      expect(selection.table.rows).toHaveLength(1);
      expect(previewMeasurements(selection.table, selectedMapping, athletes, [], file).canApply).toBe(true);
    }
  });
  it("keeps unmatched names with no readings available for later matching, without inventing stats", () => {
    const selection = selectRosterSummaries(table, mapping, roster, [], ["Fictional No Readings"]);
    expect(selection.skipped).toHaveLength(2);
    expect(selection.table.rows).toHaveLength(1);
    expect(() => selectRosterSummaries(table, { ...mapping, identityColumn: -1 }, roster)).toThrow("player column");
  });
  it("retains both known hitter and pitcher results against unknown opponents", () => {
    const headers = FULL_SWING_SESSION_HEADERS;
    const event = (PitchNo: string, Pitcher: string, Batter: string) => headers.map(h => ({ PitchNo, Date: "09/11/26", Pitcher, PitcherId: Pitcher, Batter, BatterId: Batter, RelSpeed: "80", SpinRate: "2000", ExitSpeed: "90", BatSpeed: "60", Distance: "250", Environment: "Field", Mode: "Live at Bat" } as Record<string, string>)[h] ?? "null");
    const session = summarizeFullSwingSession({ headers: [...headers], rows: [event("1", name, "Fictional Guest"), event("2", "Fictional Guest", name)], rowNumbers: [2, 3] });
    const sessionMapping: MeasurementMapping = { ...mapping, dateColumn: 1, metrics: SESSION_METRICS.map((m, i) => ({ column: i + 2, label: m.label, unit: m.unit })) };
    const selection = selectRosterSummaries(session.table, sessionMapping, roster, [], session.players.map(p => p.identity));
    const preview = previewFullSwingSummary({ table: selection.table, mapping: sessionMapping, roster, file, category: "intrasquad", summaryConfirmed: true });
    expect(preview.canApply).toBe(true);
    expect(preview.candidateMeasurements).toHaveLength(7);
    expect(preview.candidateMeasurements.every(m => m.athlete_code === player.athlete_code)).toBe(true);
    expect(preview.candidateMeasurements.find(m => m.metric === "Average Velocity")?.value).toBe(80);
    expect(preview.candidateMeasurements.find(m => m.metric === "Average EV")?.value).toBe(90);
    expect(session.pitches).toHaveLength(2); // Full original session is retained for saved-label validation.
  });
});
