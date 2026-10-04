import type { PitchAssignment } from "@/lib/imports/pitch-assignments";

/** An explicit staff review of the current pitch labels and confirmed export units. */
export type FullSwingPitchReview = {
  assignments: PitchAssignment[];
  assignmentVersion: number;
  ready: boolean;
  pitchApproved: boolean;
  rpmConfirmed: boolean;
};

export function fullSwingPitchReviewKey(context: unknown, assignments: readonly PitchAssignment[], assignmentVersion: number, rpmConfirmed: boolean): string {
  return JSON.stringify([context, assignments, assignmentVersion, rpmConfirmed]);
}

export function requireFullSwingPitchReview(review: FullSwingPitchReview | null, hasPitchers: boolean, hasPitchRows = hasPitchers): FullSwingPitchReview {
  if (!hasPitchRows) return { assignments: [], assignmentVersion: 0, ready: true, pitchApproved: true, rpmConfirmed: true };
  if (!review?.ready) throw new Error("Wait for the saved pitch labels to load before publishing this session.");
  if (!hasPitchers) return { ...review, pitchApproved: true, rpmConfirmed: true };
  if (!review.rpmConfirmed) throw new Error("In Pitching Review, check “Spin readings are in RPM” before publishing.");
  if (!review.pitchApproved) throw new Error("Review the pitch labels and any unassigned pitches before publishing this session.");
  return review;
}
