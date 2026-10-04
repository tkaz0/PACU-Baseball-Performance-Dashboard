import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { fullSwingPitchReviewKey, requireFullSwingPitchReview, type FullSwingPitchReview } from "@/lib/imports/full-swing-review";
import { FULL_SWING_SESSION_HEADERS, summarizeFullSwingSession } from "@/lib/imports/full-swing-session";

vi.mock("@/app/(workspace)/imports/actions", () => ({ saveReviewedContacts: vi.fn() }));
import { FullSwingSessionReview } from "@/components/full-swing-session-review";

const draft: FullSwingPitchReview = { assignments: [{ sourceRow: 2, pitchType: "Four-Seam Fastball" }], assignmentVersion: 2, ready: true, pitchApproved: true, rpmConfirmed: true };
const context = { fileName: "fictional-session.csv", fileHash: "a".repeat(64), date: "2026-09-11", category: "intrasquad" as const, matches: [{ identity: "Fictional Pitcher", athleteCode: "PAC-9998" }, { identity: "Fictional Batter", athleteCode: "PAC-9999" }] };

describe("complete Full Swing review safeguards", () => {
  it("requires loaded labels, explicit review and RPM for matched pitchers", () => {
    expect(() => requireFullSwingPitchReview(null, true)).toThrow("saved pitch labels");
    expect(() => requireFullSwingPitchReview({ ...draft, ready: false }, true)).toThrow("saved pitch labels");
    expect(() => requireFullSwingPitchReview({ ...draft, rpmConfirmed: false }, true)).toThrow("RPM");
    expect(() => requireFullSwingPitchReview({ ...draft, pitchApproved: false }, true)).toThrow("Review the pitch labels");
    expect(requireFullSwingPitchReview(draft, true)).toBe(draft);
  });
  it("allows reviewed unknown pitches without inventing labels", () => {
    expect(requireFullSwingPitchReview({ ...draft, assignments: [] }, true).assignments).toEqual([]);
  });
  it("preserves existing annotations and their version for excluded pitchers", () => {
    expect(() => requireFullSwingPitchReview(null, false, true)).toThrow("saved pitch labels");
    expect(requireFullSwingPitchReview({ ...draft, pitchApproved: false, rpmConfirmed: false }, false, true)).toMatchObject({ assignments: draft.assignments, assignmentVersion: 2 });
  });
  it("never puts machine labels into a practice hitting publication", () => {
    expect(requireFullSwingPitchReview(draft, false, false)).toMatchObject({ assignments: [], assignmentVersion: 0 });
  });
  it("invalidates review for changed labels, roster matches, context, version and units", () => {
    const key = fullSwingPitchReviewKey(context, draft.assignments, 2, true);
    expect(fullSwingPitchReviewKey(context, [], 2, true)).not.toBe(key);
    expect(fullSwingPitchReviewKey({ ...context, matches: [] }, draft.assignments, 2, true)).not.toBe(key);
    expect(fullSwingPitchReviewKey({ ...context, category: "practice" }, draft.assignments, 2, true)).not.toBe(key);
    expect(fullSwingPitchReviewKey(context, draft.assignments, 3, true)).not.toBe(key);
    expect(fullSwingPitchReviewKey(context, draft.assignments, 2, false)).not.toBe(key);
  });
  it("bundled review has no separate contact, label or result save buttons", () => {
    const values: Record<string, string> = { PitchNo: "1", Date: "09/11/26", Pitcher: "Fictional Pitcher", PitcherId: "fixture-p", Batter: "Fictional Batter", BatterId: "fixture-b", RelSpeed: "80", SpinRate: "2000", ExitSpeed: "90", Angle: "20", Direction: "10", BatSpeed: "60", Distance: "250", Environment: "Field", Mode: "Live at Bat" };
    const session = summarizeFullSwingSession({ headers: FULL_SWING_SESSION_HEADERS, rows: [FULL_SWING_SESSION_HEADERS.map(header => values[header] ?? "null")], rowNumbers: [2] });
    const markup = renderToStaticMarkup(createElement(FullSwingSessionReview, { session, bundled: true, resultContext: context }));
    expect(markup).toContain("Pitching Review");
    expect(markup).toContain("Spin readings are in RPM.");
    expect(markup).toContain("Check the RPM box first");
    expect(markup).not.toContain("I confirm the export’s SpinRate values are RPM.");
    expect(markup).toContain("publish with the session");
    expect(markup).not.toContain("Save Contact Map Readings");
    expect(markup).not.toContain("Save Pitch Assignments");
    expect(markup).not.toContain("Save Pitch Results to Profiles");
    expect(markup).not.toContain('checked=""');
  });
});
