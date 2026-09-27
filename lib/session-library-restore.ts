import type { SessionPublication } from "@/lib/session-library";

export type SessionRestoreRequest = { requestId: string; fileHash: string; expectedRevision: number; targetRevision: number };
export type SessionRestoreReview = Pick<SessionPublication, "fileHash" | "revision" | "restoreTargetRevision" | "fullyPublished">;

export function previousRestorableRevision(session: SessionRestoreReview): number | null {
  return session.fullyPublished && Number.isSafeInteger(session.revision) && session.revision > 1 && session.restoreTargetRevision === session.revision - 1 ? session.restoreTargetRevision : null;
}

/** Keep one immutable payload after the first attempt, including an uncertain response. */
export function prepareSessionRestoreAttempt(session: SessionRestoreReview, reviewed: boolean, priorAttempt: SessionRestoreRequest | null, requestId: () => string): SessionRestoreRequest {
  if (!reviewed) throw new Error("Review the previous revision before restoring.");
  if (priorAttempt) return priorAttempt;
  const targetRevision = previousRestorableRevision(session);
  if (targetRevision === null || !/^[a-f0-9]{64}$/.test(session.fileHash)) throw new Error("The previous saved revision is unavailable. Refresh the Session Library.");
  return Object.freeze({ requestId: requestId(), fileHash: session.fileHash, expectedRevision: session.revision, targetRevision });
}
