import { attackPath, type HitterSwingProfile } from "@/lib/hitter-swing-profile";
import { HITTER_STUDY_REFERENCES, type HitterStudyReference } from "@/lib/hitter-study-references";
import { FEATURED_HITTER_STUDY_IDS } from "@/lib/hitter-study-featured";

/** Custom PAC browsing scales, not cross-device calibration or ideal ranges. */
export const HITTER_STUDY_WINDOWS = { attackAngle: 5, percentile: 100 } as const;
export const HITTER_STUDY_FIT_WEIGHTS = { attackAngle: 0.7, build: 0.3 } as const;
export type HitterStudyMatches = {
  matches: readonly HitterStudyReference[];
  basis: "path_and_size" | "path_and_height" | "path_and_weight" | "path_only" | "none";
  sizeFallback: boolean;
};
export type HitterStudyPreferences = { bats?: string | null };
type RelativeRank = { value: number; sampleSize: number };

const positive = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value > 0 ? value : null;
const percentileValue = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
const ownRankValue = (rank: RelativeRank | null | undefined) => rank && Number.isSafeInteger(rank.sampleSize) && rank.sampleSize >= 5 ? percentileValue(rank.value) : null;
const validReference = (reference: HitterStudyReference) => Number.isSafeInteger(reference.id) && reference.id > 0 &&
  typeof reference.name === "string" && reference.name.trim().length > 0 &&
  attackPath(reference.attackAngle) !== null && Number.isSafeInteger(reference.competitiveSwings) && reference.competitiveSwings > 0 &&
  positive(reference.heightInches) !== null && positive(reference.weightLb) !== null;
const featured = new Set<number>(FEATURED_HITTER_STUDY_IDS);

function uniqueReferences(references: readonly HitterStudyReference[]) {
  const counts = new Map<number, number>();
  references.forEach(reference => counts.set(reference.id, (counts.get(reference.id) ?? 0) + 1));
  // An ambiguous ID never contributes to either matching or its reference ranks.
  return references.filter(reference => validReference(reference) && counts.get(reference.id) === 1);
}

function proPercentile(reference: HitterStudyReference, references: readonly HitterStudyReference[], valueFor: (item: HitterStudyReference) => number | null): RelativeRank | null {
  const value = valueFor(reference);
  const cohort = uniqueReferences(references).flatMap(item => {
    const observedValue = valueFor(item);
    return observedValue === null ? [] : [{ id: item.id, value: observedValue }];
  });
  if (!validReference(reference) || value === null || cohort.length < 5 || !cohort.some(item => item.id === reference.id && item.value === value)) return null;
  const below = cohort.filter(item => item.value < value).length;
  const equal = cohort.filter(item => item.value === value).length;
  return { value: 100 * (below + (equal - 1) / 2) / (cohort.length - 1), sampleSize: cohort.length };
}

/** Rank against all qualified MLB references, before path, handedness or shortlist filters. */
export function proBatSpeedPercentile(reference: HitterStudyReference, references: readonly HitterStudyReference[] = HITTER_STUDY_REFERENCES): RelativeRank | null {
  return proPercentile(reference, references, item => item.averageBatSpeed !== null && Number.isFinite(item.averageBatSpeed) && item.averageBatSpeed >= 0 ? item.averageBatSpeed : null);
}

/** Listed height and weight are neutral size ranks, never health or skill grades. */
export function proBodyPercentile(reference: HitterStudyReference, dimension: "height" | "weight", references: readonly HitterStudyReference[] = HITTER_STUDY_REFERENCES): RelativeRank | null {
  return proPercentile(reference, references, item => positive(dimension === "height" ? item.heightInches : item.weightLb));
}

export function compatibleBattingSide(own: string | null | undefined, professional: HitterStudyReference["bats"]) {
  const side = own?.trim().toUpperCase();
  // A switch hitter's pooled reference cannot be relabeled as a single-side swing.
  return (side === "R" || side === "L" || side === "S") && professional === side;
}

/** Swing direction leads; environment-relative build is secondary. Bat speed is display-only. */
export function hitterStudyMatches(profile: HitterSwingProfile, references: readonly HitterStudyReference[] = HITTER_STUDY_REFERENCES, preferences?: HitterStudyPreferences): HitterStudyMatches {
  const none: HitterStudyMatches = { matches: [], basis: "none", sizeFallback: false };
  const angle = profile.attackAngle;
  const path = attackPath(angle);
  if (angle === null || !path || !profile.path || path.key !== profile.path.key || profile.summary?.issues.length) return none;

  const candidates = uniqueReferences(references).filter(reference => featured.has(reference.id) &&
    compatibleBattingSide(preferences?.bats, reference.bats) && attackPath(reference.attackAngle)?.key === path.key &&
    Math.abs(reference.attackAngle - angle) <= HITTER_STUDY_WINDOWS.attackAngle);
  if (!candidates.length) return none;

  const heightRank = profile.height?.unit === "in" && positive(profile.height.value) !== null ? ownRankValue(profile.heightRank) : null;
  const weightRank = profile.weight?.unit === "lb" && positive(profile.weight.value) !== null ? ownRankValue(profile.weightRank) : null;
  const relativeRanks = new Map(candidates.map(reference => [reference.id, {
    height: proBodyPercentile(reference, "height", references)?.value ?? null,
    weight: proBodyPercentile(reference, "weight", references)?.value ?? null,
  }]));
  const usesHeight = heightRank !== null && candidates.some(reference => relativeRanks.get(reference.id)?.height !== null);
  const usesWeight = weightRank !== null && candidates.some(reference => relativeRanks.get(reference.id)?.weight !== null);
  const fit = (reference: HitterStudyReference) => {
    const angleGap = Math.abs(reference.attackAngle - angle) / HITTER_STUDY_WINDOWS.attackAngle;
    const bodyGaps: number[] = [];
    const ranks = relativeRanks.get(reference.id)!;
    for (const [ownRank, proRank] of [[heightRank, ranks.height], [weightRank, ranks.weight]]) {
      if (ownRank !== null && proRank !== null) bodyGaps.push(Math.abs(ownRank - proRank) / HITTER_STUDY_WINDOWS.percentile);
    }
    if (!bodyGaps.length) return angleGap;
    const meanBodyGap = bodyGaps.reduce((sum, value) => sum + value, 0) / bodyGaps.length;
    return HITTER_STUDY_FIT_WEIGHTS.attackAngle * angleGap + HITTER_STUDY_FIT_WEIGHTS.build * meanBodyGap;
  };
  return {
    matches: [...candidates].sort((a, b) => fit(a) - fit(b) || a.id - b.id).slice(0, 3),
    basis: usesHeight && usesWeight ? "path_and_size" : usesHeight ? "path_and_height" : usesWeight ? "path_and_weight" : "path_only",
    sizeFallback: false,
  };
}
