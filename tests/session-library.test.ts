import { describe, expect, it } from "vitest";
import { buildSessionLibrary, type SessionReadingMetadata, type SessionPublication } from "@/lib/session-library";

// Marked fictional metadata only; no production reports or readings.
const hash = "a".repeat(64), person = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", code: "SYN-001", name: "Fictional Player" };
const row = (overrides: Partial<SessionReadingMetadata> = {}): SessionReadingMetadata => ({ observationId: "fictional-1", athleteId: person.id, fileHash: hash, sourceFile: "fictional-session.csv", source: "Full Swing · Intrasquad", metricKey: "avg_exit_velocity", date: "2026-09-11", savedAt: "2026-09-20T12:00:00Z", ...overrides });
const publication = (overrides: Partial<SessionPublication> = {}): SessionPublication => ({ fileHash: hash, fileName: "fictional-session.csv", date: "2026-09-11", category: "intrasquad", mode: "Live at Bat", eventCount: 12, revision: 1, measurementCount: 2, sampleCount: 1, contactCount: 1, assignedCount: 10, unresolvedPitchCount: 2, excludedPlayerCount: 1, removedValueCount: 0, publishedAt: "2026-09-20T12:00:00Z", lastUpdatedAt: "2026-09-20T12:00:00Z", fullyPublished: true, restoreTargetRevision: null, ...overrides });

describe("session library groups saved evidence without guessing completion", () => {
  it("combines hitter, classified pitcher and contact data only for the same file, date and category", () => {
    const sessions = buildSessionLibrary([row(), row({ observationId: "fictional-2", metricKey: "classified_avg_spin", source: "Full Swing · Intrasquad · Four-Seam Fastball" })], [{ athleteId: person.id, fileHash: hash, sourceFile: "fictional-session.csv", sourceRow: 2, category: "intrasquad", date: "2026-09-11", savedAt: "2026-09-20T12:00:00Z" }], [person]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ label: "BDL (September 11th)", context: "in_game", measurementCount: 2, contactCount: 1, hitterCount: 1, pitcherCount: 1, classifiedPitcherCount: 1, pitchTypes: ["Four-Seam Fastball"], publication: null });
    expect(sessions[0].players).toEqual([{ ...person, hitting: true, pitching: true, contactMap: true }]);
  });
  it("does not infer a pitch type or completed publication from overall velocity alone", () => {
    const sessions = buildSessionLibrary([row({ metricKey: "max_pitch_velocity" })], [], [person]);
    expect(sessions[0]).toMatchObject({ pitcherCount: 1, classifiedPitcherCount: 0, pitchTypes: [], publication: null });
  });
  it("keeps contexts, actual session dates and distinct file contents separate", () => {
    const sessions = buildSessionLibrary([row(), row({ observationId: "fictional-2", source: "Full Swing · Practice" }), row({ observationId: "fictional-3", date: "2026-09-12" }), row({ observationId: "fictional-4", fileHash: "b".repeat(64) })], [], [person]);
    expect(sessions).toHaveLength(4);
    expect(sessions.filter(session => session.context === "practice")).toHaveLength(1);
    expect(sessions[0].date).toBe("2026-09-12");
  });
  it("retains Blast average and P95 as different reports and supports older reviewed summary imports", () => {
    const sessions = buildSessionLibrary([row({ source: "Blast Motion · Average · 2026-09-13:2026-09-20", date: "2026-09-20" }), row({ observationId: "fictional-2", source: "Blast Motion · P95 · 2026-09-13:2026-09-20", date: "2026-09-20" }), row({ observationId: "fictional-3", source: "Blast Motion · Hitting", date: "2026-09-20" })], [], [person]);
    expect(sessions).toHaveLength(3);
    expect(sessions.every(session => session.context === "practice")).toBe(true);
    expect(sessions.map(session => session.reportKind).sort()).toEqual(["average", "p95", null].sort());
    expect(sessions.find(session => session.reportKind === "p95")?.label).toBe("Blast · Weekly Peak (95th)");
  });
  it("shows verified publication metadata while preserving unassigned review counts", () => {
    const sessions = buildSessionLibrary([row()], [], [person], [publication()]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].publication).toMatchObject({ fullyPublished: true, revision: 1, unresolvedPitchCount: 2 });
    expect(sessions[0].measurementCount).toBe(1); // Actual currently saved rows, not historic receipt claims.
  });
  it("retains a published report with no remaining active readings after corrections", () => {
    const sessions = buildSessionLibrary([], [], [], [publication({ revision: 2, restoreTargetRevision: 1, measurementCount: 0, contactCount: 0, sampleCount: 0 })]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].players).toEqual([]);
    expect(sessions[0].measurementCount).toBe(0);
  });
  it("rejects duplicated observations and absent player matches", () => {
    expect(() => buildSessionLibrary([row(), row()], [], [person])).toThrow("changed while loading");
    expect(() => buildSessionLibrary([row()], [], [])).toThrow("player matches");
  });
  it("groups identical file contents under deterministic original filename evidence", () => {
    const sessions = buildSessionLibrary([row({ sourceFile: "z-fictional.csv" }), row({ observationId: "fictional-2", sourceFile: "a-fictional.csv" })], [], [person]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].originalFiles).toEqual(["a-fictional.csv", "z-fictional.csv"]);
  });
});
