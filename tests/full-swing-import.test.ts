import { describe, expect, it } from "vitest";
import { getPreviewRoster } from "@/lib/preview-roster";
import { parseDelimited, selectTable, type MeasurementMapping } from "@/lib/imports/engine";
import { fullSwingMetrics, previewFullSwingSummary, type FullSwingCategory } from "@/lib/imports/full-swing";

const roster = getPreviewRoster();
const player = roster[0];
const file = { fileName: "fictional-summary.csv", fileHash: "a".repeat(64), sheetName: "CSV" };
const mapping: MeasurementMapping = { identityKind: "code", identityColumn: 0, dateColumn: 1, dateFormat: "ISO", source: "Untrusted label", metrics: [{ column: 2, label: "Max EV", unit: "mph" }] };
const run = (csv = `Player,Date,Max EV\n${player.athlete_code},2026-09-12,96`, overrides: Partial<Parameters<typeof previewFullSwingSummary>[0]> = {}) => previewFullSwingSummary({ table: selectTable(parseDelimited(csv), 0), mapping, roster, file, category: "hitting", summaryConfirmed: true, ...overrides });

describe("reviewed Full Swing summary imports", () => {
  it("preserves actual CSV coordinates and uses the selected session source", () => {
    const result = run();
    expect(result.canApply).toBe(true);
    expect(result.candidateMeasurements[0]).toMatchObject({ athlete_code: player.athlete_code, value: 96, unit: "mph", source: "Full Swing · Hitting", source_row: 2, source_sheet: "CSV", file_hash: file.fileHash });
    expect(result.candidateMeasurements[0].id).toBe(`observation:${JSON.stringify([file.fileHash, "CSV", 2, 2])}`);
  });
  it.each(["hitting", "game", "intrasquad"] as FullSwingCategory[])("retains %s separately", category => expect(run(undefined, { category }).candidateMeasurements[0].source).toBe(`Full Swing · ${category === "hitting" ? "Hitting" : category === "game" ? "Game" : "Intrasquad"}`));
  it("does not accept raw events without explicit summary review", () => expect(() => run(undefined, { summaryConfirmed: false })).toThrow("session summaries"));
  it("blocks repeated player/date/metric rows instead of choosing an arbitrary swing", () => expect(() => run(`Player,Date,Max EV\n${player.athlete_code},2026-09-12,96\n${player.athlete_code},2026-09-12,92`)).toThrow("More than one summary"));
  it.each(["2026-08-31", "2027-04-12"])("excludes non-Fall date %s", date => expect(() => run(`Player,Date,Max EV\n${player.athlete_code},${date},96`)).toThrow("Fall 2026"));
  it("rejects wrong category and guessed generic velocity", () => {
    expect(() => run(undefined, { category: "pitching" })).toThrow("listed profile metric");
    expect(() => run(undefined, { mapping: { ...mapping, metrics: [{ column: 2, label: "Velocity", unit: "mph" }] } })).toThrow("listed profile metric");
  });
  it("blocks unknown athlete identities and supports reviewed overrides", () => {
    const csv = "Player,Date,Max EV\nEXPORT-7,2026-09-12,96";
    expect(run(csv).canApply).toBe(false);
    expect(run(csv, { mapping: { ...mapping, identityOverrides: { "EXPORT-7": player.athlete_code } } }).candidateMeasurements[0].athlete_code).toBe(player.athlete_code);
  });
  it("requires names to be separately reviewed and never infers from surname", () => {
    const named = run(`Player,Date,Max EV\n${player.first_name} ${player.last_name},2026-09-12,96`, { mapping: { ...mapping, identityKind: "name" } });
    expect(named.nameMatches).toBe(1);
    expect(run(`Player,Date,Max EV\n${player.last_name},2026-09-12,96`, { mapping: { ...mapping, identityKind: "name" } }).canApply).toBe(false);
  });
  it.each(["#DIV/0!", "96 mph", "95%", "Infinity"])("blocks nonnumeric cell %s", value => expect(run(`Player,Date,Max EV\n${player.athlete_code},2026-09-12,${value}`).canApply).toBe(false));
  it("does not create a zero from an empty cell", () => expect(() => run(`Player,Date,Max EV\n${player.athlete_code},2026-09-12,`)).toThrow("1–500"));
  it("rejects duplicate profile mappings and invalid units", () => {
    expect(() => run(undefined, { mapping: { ...mapping, metrics: [mapping.metrics[0], { ...mapping.metrics[0], column: 3 }] } })).toThrow("only once");
    expect(() => run(undefined, { mapping: { ...mapping, metrics: [{ ...mapping.metrics[0], unit: "rpm" }] } })).toThrow("original unit");
  });
  it("rejects percentages above 100 and keeps fastball spin explicit", () => {
    expect(() => run(`Player,Date,Rate\n${player.athlete_code},2026-09-12,101`, { category: "pitching", mapping: { ...mapping, metrics: [{ column: 2, label: "Strike %", unit: "%" }] } })).toThrow("invalid value");
    expect(fullSwingMetrics("pitching").find(metric => metric.key === "avg_fastball_spin")?.label).toBe("Average Fastball Spin");
  });
  it("rejects averages above the maximum in the same unit", () => {
    expect(() => run(`Player,Date,Max,Avg\n${player.athlete_code},2026-09-12,92,94`, { mapping: { ...mapping, metrics: [mapping.metrics[0], { column: 3, label: "Average EV", unit: "mph" }] } })).toThrow("cannot exceed");
  });
  it.each([
    ["hitting", "Max Bat Speed", "Average Bat Speed"],
    ["pitching", "Max Velocity", "Average Velocity"],
  ] as const)("requires consistent reviewed %s maximum and average", (category, maximum, average) => {
    const selected = { ...mapping, metrics: [{ column: 2, label: maximum, unit: "mph" }, { column: 3, label: average, unit: "mph" }] };
    expect(() => run(`Player,Date,Max,Avg\n${player.athlete_code},2026-09-12,70,75`, { category, mapping: selected })).toThrow("cannot exceed");
    const result = run(`Player,Date,Max,Avg\n${player.athlete_code},2026-09-12,75,70`, { category, mapping: selected });
    expect(result.canApply).toBe(true);
    expect(result.candidateMeasurements.map(row => row.value)).toEqual([75, 70]);
  });
  it("accepts separately reviewed smash factor and distance without calculating either", () => {
    const result = run(`Player,Date,Ratio,Distance\n${player.athlete_code},2026-09-12,1.3,300`, { mapping: { ...mapping, metrics: [
      { column: 2, label: "Smash Factor", unit: "ratio" }, { column: 3, label: "Max Distance", unit: "ft" },
    ] } });
    expect(result.canApply).toBe(true);
    expect(result.candidateMeasurements.map(row => [row.metric, row.value, row.unit])).toEqual([["Smash Factor", 1.3, "ratio"], ["Max Distance", 300, "ft"]]);
  });
});
