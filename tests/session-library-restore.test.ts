import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const actions = vi.hoisted(() => ({ restore: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/(workspace)/imports/session-actions", () => ({ restoreFullSwingSession: actions.restore }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: actions.refresh }) }));
import { prepareSessionRestoreAttempt, previousRestorableRevision } from "@/lib/session-library-restore";
import { canMutatePresentedAccess, type AccessPresentation } from "@/lib/access-preview";
import { SessionLibrary } from "@/components/session-library";
import { SessionRestore } from "@/components/session-restore";
import { buildSessionLibrary, type SessionPublication } from "@/lib/session-library";

const publication: SessionPublication = { fileHash: "a".repeat(64), fileName: "fictional-session.csv", date: "2026-09-11", category: "intrasquad", mode: "Live at Bat", eventCount: 2, revision: 2, measurementCount: 1, sampleCount: 1, contactCount: 0, assignedCount: 2, unresolvedPitchCount: 0, excludedPlayerCount: 0, removedValueCount: 1, publishedAt: "2026-09-20T12:00:00Z", lastUpdatedAt: "2026-09-21T12:00:00Z", fullyPublished: true, restoreTargetRevision: 1 };

it("requires explicit review before generating any restore request", () => {
  const uuid = vi.fn(() => "fictional-request");
  expect(() => prepareSessionRestoreAttempt(publication, false, null, uuid)).toThrow("Review");
  expect(uuid).not.toHaveBeenCalled();
});
it("locks the original request and revision pair for an explicit uncertain-save retry", () => {
  const uuid = vi.fn(() => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  const request = prepareSessionRestoreAttempt(publication, true, null, uuid);
  expect(request).toEqual({ requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", fileHash: publication.fileHash, expectedRevision: 2, targetRevision: 1 });
  expect(Object.isFrozen(request)).toBe(true);
  const retry = prepareSessionRestoreAttempt({ ...publication, revision: 3, restoreTargetRevision: 2 }, true, request, uuid);
  expect(retry).toBe(request); expect(uuid).toHaveBeenCalledTimes(1);
});
it("offers only a verified immediate previous revision", () => {
  expect(previousRestorableRevision(publication)).toBe(1);
  for (const session of [{ ...publication, fullyPublished: false }, { ...publication, revision: 1 }, { ...publication, restoreTargetRevision: null }, { ...publication, restoreTargetRevision: 2 }, { ...publication, revision: 4, restoreTargetRevision: 1 }]) {
    expect(previousRestorableRevision(session)).toBeNull();
    expect(() => prepareSessionRestoreAttempt(session, true, null, () => "unused")).toThrow("unavailable");
  }
});
it("marks changed live results for review and removes the restore affordance", () => {
  const sessions = buildSessionLibrary([], [], [], [{ ...publication, fullyPublished: false, restoreTargetRevision: null }]);
  const html = renderToStaticMarkup(createElement(SessionLibrary, { sessions, allowRestore: true }));
  expect(html).toContain("Review Needed"); expect(html).toContain("Saved Results Changed");
  expect(html).not.toContain("Restore Previous Revision");
  expect(html).not.toContain("Review Original CSV"); expect(html).toContain("Ask an administrator");
  const admin = renderToStaticMarkup(createElement(SessionLibrary, { sessions, allowRestore: true, canCorrect: true }));
  expect(admin).toContain("/admin/csv-corrections"); expect(admin).toContain("Review Separate Corrections");
});
it("reopens each original Full Swing report in its saved context, keeping legacy lanes in practice", () => {
  for (const category of ["game", "intrasquad", "practice"] as const) {
    const sessions = buildSessionLibrary([], [], [], [{ ...publication, category }]);
    const html = renderToStaticMarkup(createElement(SessionLibrary, { sessions }));
    expect(html).toContain(`/imports?sessionType=${category}`);
  }
  const sessions = buildSessionLibrary([{ observationId: "fictional-obs", athleteId: "fictional-id", fileHash: "a".repeat(64), sourceFile: "fictional.csv", source: "Full Swing · Pitching", metricKey: "max_pitch_velocity", date: "2026-09-11", savedAt: "2026-09-20T12:00:00Z" }], [], [{ id: "fictional-id", code: "SYN-001", name: "Fictional Player" }]);
  expect(renderToStaticMarkup(createElement(SessionLibrary, { sessions }))).toContain("/imports?sessionType=practice");
});
it("renders an unchecked review and disabled restore button without attempting a mutation", () => {
  const html = renderToStaticMarkup(createElement(SessionRestore, { publication }));
  expect(html).toContain("Session History");
  expect(html).toContain("Restore all saved results from revision 1");
  expect(html).toMatch(/<button[^>]*disabled=""/);
  expect(html).not.toMatch(/checked=""/);
  expect(actions.restore).not.toHaveBeenCalled(); expect(actions.refresh).not.toHaveBeenCalled();
});
it("hides restore for coaches and both View-as modes while staff can still read session cards", () => {
  const sessions = buildSessionLibrary([], [], [], [publication]);
  const coachPreview = { version: 1, actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role: "coach", athleteId: null, expiresAt: 1 } as const;
  const presentations: AccessPresentation[] = [{ roles: ["coach"], athleteId: null, preview: null }, { roles: ["coach"], athleteId: null, preview: coachPreview }, { roles: ["player"], athleteId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", preview: { ...coachPreview, role: "player", athleteId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } }];
  for (const access of presentations) {
    expect(canMutatePresentedAccess(access)).toBe(false);
    const html = renderToStaticMarkup(createElement(SessionLibrary, { sessions, allowRestore: canMutatePresentedAccess(access) }));
    expect(html).toContain("Saved Reports");
    expect(html).not.toContain("Restore Previous Revision");
  }
  const html = renderToStaticMarkup(createElement(SessionLibrary, { sessions, allowRestore: canMutatePresentedAccess({ roles: ["admin"], athleteId: null, preview: null }) }));
  expect(html).toContain("Restore Previous Revision");
});
