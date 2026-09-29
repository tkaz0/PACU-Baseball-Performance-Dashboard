import { attackPath, type HitterSwingProfile } from "@/lib/hitter-swing-profile";
import { HITTER_STUDY_REFERENCES, type HitterStudyReference } from "@/lib/hitter-study-references";

/** Custom PAC browsing windows, not cross-device calibration or ideal ranges. */
export const HITTER_STUDY_WINDOWS = { attackAngle: 5, heightInches: 3, weightLb: 30 } as const;
export type HitterStudyMatches = {
  matches: readonly HitterStudyReference[];
  basis: "path_and_size" | "path_and_height" | "path_and_weight" | "path_only" | "none";
  sizeFallback: boolean;
};

const positive = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value > 0 ? value : null;
const validReference = (reference: HitterStudyReference) => Number.isSafeInteger(reference.id) && reference.id > 0 &&
  typeof reference.name === "string" && reference.name.trim().length > 0 &&
  attackPath(reference.attackAngle) !== null && Number.isSafeInteger(reference.competitiveSwings) && reference.competitiveSwings > 0 &&
  positive(reference.heightInches) !== null && positive(reference.weightLb) !== null;

/** Select study examples using coarse direction and listed size, without a similarity score. */
export function hitterStudyMatches(profile: HitterSwingProfile, references: readonly HitterStudyReference[] = HITTER_STUDY_REFERENCES): HitterStudyMatches {
  const angle = profile.attackAngle;
  const path = attackPath(angle);
  if (angle === null || !path || !profile.path || path.key !== profile.path.key || profile.summary?.issues.length) {
    return { matches: [], basis: "none", sizeFallback: false };
  }
  const idCounts = new Map<number, number>();
  for (const reference of references) idCounts.set(reference.id, (idCounts.get(reference.id) ?? 0) + 1);
  // Omit all ambiguous IDs instead of letting input order choose a conflicting record.
  const candidates = references.filter(reference => validReference(reference) && idCounts.get(reference.id) === 1 &&
    attackPath(reference.attackAngle)?.key === path.key && Math.abs(reference.attackAngle - angle) <= HITTER_STUDY_WINDOWS.attackAngle);
  if (!candidates.length) return { matches: [], basis: "none", sizeFallback: false };

  const height = profile.height?.unit === "in" ? positive(profile.height.value) : null;
  const weight = profile.weight?.unit === "lb" ? positive(profile.weight.value) : null;
  const hasSize = height !== null || weight !== null;
  const byAngle = (a: HitterStudyReference, b: HitterStudyReference) => Math.abs(a.attackAngle - angle) - Math.abs(b.attackAngle - angle) || a.id - b.id;
  if (!hasSize) return { matches: [...candidates].sort(byAngle).slice(0, 3), basis: "path_only", sizeFallback: false };

  const sizeCandidates = candidates.filter(reference =>
    (height === null || Math.abs(reference.heightInches - height) <= HITTER_STUDY_WINDOWS.heightInches) &&
    (weight === null || Math.abs(reference.weightLb - weight) <= HITTER_STUDY_WINDOWS.weightLb));
  if (!sizeCandidates.length) return { matches: [...candidates].sort(byAngle).slice(0, 3), basis: "path_only", sizeFallback: true };

  const sizeDistance = (reference: HitterStudyReference) =>
    (height === null ? 0 : Math.abs(reference.heightInches - height) / HITTER_STUDY_WINDOWS.heightInches) +
    (weight === null ? 0 : Math.abs(reference.weightLb - weight) / HITTER_STUDY_WINDOWS.weightLb);
  return {
    matches: [...sizeCandidates].sort((a, b) => sizeDistance(a) - sizeDistance(b) || byAngle(a, b)).slice(0, 3),
    basis: height !== null && weight !== null ? "path_and_size" : height !== null ? "path_and_height" : "path_and_weight",
    sizeFallback: false,
  };
}
