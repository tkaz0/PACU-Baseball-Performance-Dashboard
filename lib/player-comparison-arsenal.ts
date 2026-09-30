import type { CoachingData } from "@/lib/coaching-tools";
import { coachingEligible, comparisonLead, daysBetween } from "@/lib/coaching-tools";
import type { FallArsenalPitch } from "@/lib/pitch-arsenal";
import { classifiedPitchSource } from "@/lib/imports/classified-pitch-results";
import { PITCH_TYPES } from "@/lib/imports/pitch-assignments";

export type ArsenalComparisonValue = {
  value: number;
  basis: "Fall average" | "Latest session" | "Fall best";
  count: number | null;
  firstDate: string;
  lastDate: string;
};
export type ArsenalComparisonMetric = {
  key: "classified_avg_velocity" | "classified_max_velocity" | "classified_avg_spin" | "classified_max_spin";
  label: string;
  unit: "mph" | "rpm";
  first: ArsenalComparisonValue | null;
  second: ArsenalComparisonValue | null;
  lead: "a" | "b" | "tie" | null;
  note: string;
};
export type ArsenalComparison = {
  key: string;
  source: string;
  pitchType: string;
  category: "Game" | "Intrasquad" | "Practice";
  eligibleA: boolean;
  eligibleB: boolean;
  reviewA: boolean;
  reviewB: boolean;
  metrics: ArsenalComparisonMetric[];
};
export const arsenalComparisonFields = [
  { key: "classified_avg_velocity", label: "Average Velocity", field: "averageVelocity", family: "velocity", max: false, unit: "mph" },
  { key: "classified_max_velocity", label: "Max Velocity", field: "maxVelocity", family: "velocity", max: true, unit: "mph" },
  { key: "classified_avg_spin", label: "Average Spin", field: "averageSpin", family: "spin", max: false, unit: "rpm" },
  { key: "classified_max_spin", label: "Max Spin", field: "maxSpin", family: "spin", max: true, unit: "rpm" },
] as const;
const dateValid = (date: string | null, today: string): date is string => !!date && /^2026-\d\d-\d\d$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date && date >= "2026-09-01" && date <= "2026-12-31" && date <= today;
export function arsenalComparisonValue(pitch: FallArsenalPitch | null, field: typeof arsenalComparisonFields[number], today: string): ArsenalComparisonValue | null {
  if (!pitch) return null;
  const value = pitch[field.field];
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  const familyBasis = field.family === "velocity" ? pitch.velocityBasis : pitch.spinBasis;
  const firstDate = field.max ? field.family === "velocity" ? pitch.maxVelocityDate : pitch.maxSpinDate : field.family === "velocity" ? pitch.velocityAverageFirstDate : pitch.spinAverageFirstDate;
  const lastDate = field.max ? firstDate : field.family === "velocity" ? pitch.velocityAverageLastDate : pitch.spinAverageLastDate;
  if (!dateValid(firstDate, today) || !dateValid(lastDate, today) || firstDate > lastDate || (!field.max && familyBasis !== "fall" && familyBasis !== "latest")) return null;
  const readingCount = field.max ? field.family === "velocity" ? pitch.maxVelocityReadings : pitch.maxSpinReadings : field.family === "velocity" ? pitch.velocityReadings : pitch.spinReadings;
  const count = typeof readingCount === "number" && Number.isSafeInteger(readingCount) && readingCount > 0 ? readingCount : null;
  return { value, firstDate, lastDate, count, basis: field.max ? "Fall best" : familyBasis === "fall" ? "Fall average" : "Latest session" };
}

/** Presentation-only union of staff-authorized summaries. Never joins pitch types across sources. */
export function comparePitchArsenals(data: CoachingData, a: string, b: string, today: string, maxGap = 30): ArsenalComparison[] {
  if (a === b) return [];
  const playerA = data.players.find(player => player.id === a), playerB = data.players.find(player => player.id === b);
  if (!playerA || !playerB) return [];
  const eligibleA = coachingEligible(playerA, "max_pitch_velocity"), eligibleB = coachingEligible(playerB, "max_pitch_velocity");
  const own = (id: string, eligible: boolean) => {
    if (!eligible) return [];
    const entries = data.arsenals?.filter(entry => entry.athleteId === id) ?? [];
    if (entries.length !== 1) return [];
    return entries[0].pitches.filter(pitch => {
      const parsed = classifiedPitchSource(pitch.source);
      return parsed && parsed.pitchType === pitch.pitchType && parsed.category === pitch.category;
    });
  };
  const aa = own(a, eligibleA), bb = own(b, eligibleB);
  return [...new Set([...aa, ...bb].map(pitch => pitch.source))].flatMap(source => {
    const parsed = classifiedPitchSource(source)!;
    const firstMatches = aa.filter(pitch => pitch.source === source), secondMatches = bb.filter(pitch => pitch.source === source);
    const first = firstMatches.length === 1 ? firstMatches[0] : null, second = secondMatches.length === 1 ? secondMatches[0] : null;
    const metrics: ArsenalComparisonMetric[] = arsenalComparisonFields.map(field => {
      const av = arsenalComparisonValue(first, field, today), bv = arsenalComparisonValue(second, field, today);
      const sameBasis = !!av && !!bv && av.basis === bv.basis;
      const sameWindow = sameBasis && (av!.basis !== "Latest session" || daysBetween(av!.lastDate, bv!.lastDate) <= maxGap);
      const lead = comparisonLead(av?.value, bv?.value, field.unit === "rpm" ? "neutral" : "higher", sameWindow);
      const note = field.unit === "rpm" ? "Spin is descriptive" : !av || !bv ? "Waiting for both results" : !sameBasis ? "Different averaging periods" : !sameWindow ? "Sessions outside selected window" : field.max ? "Higher Fall best" : av.basis === "Fall average" ? "Higher Fall average" : "Higher session average";
      return { key: field.key, label: field.label, unit: field.unit, first: av, second: bv, lead, note };
    });
    return metrics.some(metric => metric.first || metric.second) ? [{ key: source, source, pitchType: parsed.pitchType, category: parsed.category as ArsenalComparison["category"], eligibleA, eligibleB, reviewA: firstMatches.length > 1, reviewB: secondMatches.length > 1, metrics }] : [];
  }).sort((left, right) => ["Game","Intrasquad","Practice"].indexOf(left.category) - ["Game","Intrasquad","Practice"].indexOf(right.category) || PITCH_TYPES.indexOf(left.pitchType as typeof PITCH_TYPES[number]) - PITCH_TYPES.indexOf(right.pitchType as typeof PITCH_TYPES[number]));
}

/** Replace a broad Full Swing velocity row only when every recorded side has its
 * classified counterpart. Manual tests and uncovered players/sources stay visible. */
export function withoutCoveredPitchVelocity<T extends { metric:string; source:string; first:unknown; second:unknown; reviewA?:boolean; reviewB?:boolean }>(tests: readonly T[], arsenals: readonly ArsenalComparison[]): T[] {
  return tests.filter(row => {
    const metric = row.metric === "avg_pitch_velocity" ? "classified_avg_velocity" : row.metric === "max_pitch_velocity" ? "classified_max_velocity" : null;
    const broad = /^Full Swing · (Game|Intrasquad|Practice)$/.exec(row.source);
    if (!metric || !broad || row.reviewA || row.reviewB || (!row.first && !row.second)) return true;
    const category = broad[1];
    const covered = (side: "first" | "second") => arsenals.some(pitch => pitch.category === category && pitch.metrics.some(result => result.key === metric && result[side] !== null));
    return !((!row.first || covered("first")) && (!row.second || covered("second")));
  });
}
