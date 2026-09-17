import { describe, expect, it } from "vitest";
import { FULL_SWING_SESSION_HEADERS as headers, summarizeFullSwingSession } from "@/lib/imports/full-swing-session";
import { previewFullSwingSummary } from "@/lib/imports/full-swing";
import { getPreviewRoster } from "@/lib/preview-roster";
import { SESSION_METRICS } from "@/lib/imports/full-swing-session";

const player = getPreviewRoster()[0];
const name = `${player.first_name} ${player.last_name}`;
const event = (overrides: Record<string, string> = {}) => headers.map(h => ({ PitchNo: "1", Date: "09/11/26", Pitcher: name, PitcherId: "fictional-pitcher", Batter: name, BatterId: "fictional-batter", RelSpeed: "80", SpinRate: "1800", ExitSpeed: "90", BatSpeed: "60", Distance: "250", Environment: "Field", Mode: "Live at Bat", ...overrides } as Record<string, string>)[h] ?? "null");
const table = (rows = [event(), event({ PitchNo: "2", RelSpeed: "84", ExitSpeed: "null", BatSpeed: "70", Distance: "null" })]) => ({ headers: [...headers], rows, rowNumbers: rows.map((_, i) => i + 2) });

describe("reviewed Full Swing Live at Bat session", () => {
  it("separates pitching and hitting, skips nulls, and uses each metric's sample", () => {
    const result = summarizeFullSwingSession(table());
    expect(result).toMatchObject({ date: "2026-09-11", eventCount: 2, pitcherCount: 1, batterCount: 1 });
    const hitter = result.table.rows.find(r => r[2]);
    const pitcher = result.table.rows.find(r => r[7]);
    expect(hitter?.slice(2)).toEqual(["90", "90", "70", "65", "250", "", ""]);
    expect(pitcher?.slice(2)).toEqual(["", "", "", "", "", "84", "82"]);
    expect(result.samples.find(s => s.metric === "Average EV")?.count).toBe(1);
    expect(result.samples.find(s => s.metric === "Average Bat Speed")?.count).toBe(2);
    expect(result.samples.find(s => s.metric === "Average Velocity")?.sourceRows).toEqual([2, 3]);
  });
  it("preserves original file with distinct derived-summary coordinates", () => {
    const session = summarizeFullSwingSession(table());
    const preview = previewFullSwingSummary({ table: session.table, roster: [player], category: "intrasquad", summaryConfirmed: true, file: { fileHash: "a".repeat(64), fileName: "fictional.csv", sheetName: "CSV · Full Swing session summaries v1" }, mapping: { identityKind: "name", identityColumn: 0, dateColumn: 1, dateFormat: "ISO", source: "", metrics: SESSION_METRICS.map((m, i) => ({ column: i + 2, label: m.label, unit: m.unit })) } });
    expect(preview.canApply).toBe(true);
    expect(preview.candidateMeasurements).toHaveLength(7);
    expect(new Set(preview.candidateMeasurements.map(m => m.id)).size).toBe(7);
    expect(preview.candidateMeasurements.every(m => m.source === "Full Swing · Intrasquad" && [2, 3].includes(m.source_row))).toBe(true);
    expect(preview.candidateMeasurements.some(m => /Spin|Strike|Smash|Potential/.test(m.metric))).toBe(false);
  });
  it.each(["0", "-3", "Infinity", "80 mph"])("rejects malformed speed %s", RelSpeed => expect(() => summarizeFullSwingSession(table([event({ RelSpeed })]))).toThrow("RelSpeed"));
  it("retains recorded zero distance and withholds missing hitting readings", () => {
    const r = summarizeFullSwingSession(table([event({ Distance: "0", ExitSpeed: "null", BatSpeed: "null" })]));
    expect(r.table.rows.find(row => row[6] === "0")?.slice(2, 6)).toEqual(["", "", "", ""]);
  });
  it("rejects repeated pitches, changed layouts, mixed dates and unknown modes", () => {
    expect(() => summarizeFullSwingSession(table([event(), event()]))).toThrow("repeated");
    expect(() => summarizeFullSwingSession({ ...table(), headers: headers.slice(1) })).toThrow("layout");
    expect(() => summarizeFullSwingSession(table([event(), event({ PitchNo: "2", Date: "09/12/26" })]))).toThrow("one dated");
    expect(() => summarizeFullSwingSession(table([event({ Mode: "Bullpen" })]))).toThrow("Live at Bat");
    expect(() => summarizeFullSwingSession(table([event({ Date: "08/31/26" })]))).toThrow("Fall 2026");
    expect(() => summarizeFullSwingSession(table([event({ Date: "09/31/26" })]))).toThrow();
  });
  it("does not merge conflicting vendor identities", () => {
    expect(() => summarizeFullSwingSession(table([event(), event({ PitchNo: "2", BatterId: "another-fictional-id" })]))).toThrow("conflicting");
    expect(() => summarizeFullSwingSession(table([event({ Batter: "null" })]))).toThrow("identity");
  });
});
