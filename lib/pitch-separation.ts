import { classifiedPitchSource } from "@/lib/imports/classified-pitch-results";
import { PITCH_TYPES } from "@/lib/imports/pitch-assignments";
import type { FallArsenalPitch } from "@/lib/pitch-arsenal";

export const FASTBALL_REFERENCES = ["Fastball", "Four-Seam Fastball", "Two-Seam Fastball", "Sinker", "Cutter"] as const;
type Category = FallArsenalPitch["category"];
export type PitchSeparationIssue = "duplicate" | "average" | "count" | "dates" | "basis" | "different-basis" | "different-dates";
export type PitchSeparationVelocity = {
  source: string;
  pitchType: string;
  average: number | null;
  maximum: number | null;
  maximumDate: string | null;
  count: number | null;
  basis: "fall" | "latest" | null;
  firstDate: string | null;
  lastDate: string | null;
  issue: PitchSeparationIssue | null;
};
export type PitchSeparationRow = PitchSeparationVelocity & { gap: number | null };
export type PitchSeparation = {
  category: Category;
  references: PitchSeparationVelocity[];
  reference: PitchSeparationVelocity | null;
  rows: PitchSeparationRow[];
  domain: [number, number] | null;
  velocityDomain: [number, number] | null;
};

export const pitchSeparationDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const calendarDate = (date: string | null): date is string => !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
const validDate = (date: string | null, today: string): date is string => calendarDate(date) && date >= "2026-09-01" && date <= "2026-12-31" && date <= today;

function velocity(source: string, matches: readonly FallArsenalPitch[], today: string): PitchSeparationVelocity {
  const pitchType = classifiedPitchSource(source)!.pitchType;
  const empty: PitchSeparationVelocity = { source, pitchType, average: null, maximum: null, maximumDate: null, count: null, basis: null, firstDate: null, lastDate: null, issue: "duplicate" };
  if (matches.length !== 1) return empty;
  const pitch = matches[0];
  const average = pitch.averageVelocity !== null && Number.isFinite(pitch.averageVelocity) && pitch.averageVelocity > 0 ? pitch.averageVelocity : null;
  const count = pitch.velocityReadings !== null && Number.isSafeInteger(pitch.velocityReadings) && pitch.velocityReadings > 0 ? pitch.velocityReadings : null;
  const basis = pitch.velocityBasis === "fall" || pitch.velocityBasis === "latest" ? pitch.velocityBasis : null;
  const firstDate = validDate(pitch.velocityAverageFirstDate, today) ? pitch.velocityAverageFirstDate : null;
  const lastDate = validDate(pitch.velocityAverageLastDate, today) ? pitch.velocityAverageLastDate : null;
  const datesValid = firstDate !== null && lastDate !== null && firstDate <= lastDate && (basis !== "latest" || firstDate === lastDate);
  const maximumDate = validDate(pitch.maxVelocityDate, today) ? pitch.maxVelocityDate : null;
  const maximum = maximumDate && pitch.maxVelocity !== null && Number.isFinite(pitch.maxVelocity) && pitch.maxVelocity > 0 && (average === null || pitch.maxVelocity >= average) ? pitch.maxVelocity : null;
  return { source, pitchType, average: datesValid ? average : null, maximum, maximumDate: maximum === null ? null : maximumDate, count, basis, firstDate, lastDate,
    issue: average === null ? "average" : !datesValid ? "dates" : !basis ? "basis" : !count ? "count" : null };
}

/** Own-athlete, already authorized summaries only. This derives a display gap, never a new reading.
 * Exact source category, basis and date bounds must agree; a Fall label alone is not enough.
 * Matching bounds do not claim that each pitch came from identical sessions.
 */
export function buildPitchSeparation(pitches: readonly FallArsenalPitch[], category: Category, requestedSource?: string, today = pitchSeparationDay()): PitchSeparation {
  const empty: PitchSeparation = { category, references: [], reference: null, rows: [], domain: null, velocityDomain: null };
  if (!calendarDate(today)) return empty;
  const eligible = pitches.filter(pitch => {
    const parsed = classifiedPitchSource(pitch.source);
    return parsed?.category === category && pitch.category === category && parsed.pitchType === pitch.pitchType;
  });
  const groups = [...new Set(eligible.map(pitch => pitch.source))].map(source => velocity(source, eligible.filter(pitch => pitch.source === source), today))
    .sort((a, b) => PITCH_TYPES.indexOf(a.pitchType as typeof PITCH_TYPES[number]) - PITCH_TYPES.indexOf(b.pitchType as typeof PITCH_TYPES[number]));
  const references = groups.filter(pitch => (FASTBALL_REFERENCES as readonly string[]).includes(pitch.pitchType));
  // A sole recorded type is unambiguous; multiple fastball types require an explicit choice.
  const reference = references.find(pitch => pitch.source === requestedSource) ?? (references.length === 1 ? references[0] : null);
  const rows: PitchSeparationRow[] = groups.filter(pitch => pitch.source !== reference?.source).map(pitch => {
    const issue = pitch.issue ?? reference?.issue ?? (!reference ? null : pitch.basis !== reference.basis ? "different-basis"
      : pitch.firstDate !== reference.firstDate || pitch.lastDate !== reference.lastDate ? "different-dates" : null);
    return { ...pitch, issue, gap: reference && !issue ? reference.average! - pitch.average! : null };
  });
  const comparable = rows.filter(row => row.gap !== null);
  const values = reference && comparable.length ? [reference.average!, ...comparable.map(row => row.average!)] : [];
  const domain: [number, number] | null = values.length ? [Math.max(0, Math.floor((Math.min(...values) - 2) / 5) * 5), Math.ceil((Math.max(...values) + 2) / 5) * 5] : null;
  const speeds = groups.flatMap(pitch => [pitch.average, pitch.maximum].filter((value): value is number => value !== null));
  const velocityDomain: [number, number] | null = speeds.length ? [Math.max(0, Math.floor((Math.min(...speeds) - 2) / 5) * 5), Math.ceil((Math.max(...speeds) + 2) / 5) * 5] : null;
  return { category, references, reference, rows, domain, velocityDomain };
}

export function pitchSeparationReason(issue: PitchSeparationIssue | null): string {
  return issue ? {
    duplicate: "Summary needs review",
    average: "Average speed not recorded",
    count: "Speed reading count unavailable",
    dates: "Average dates unavailable",
    basis: "Average period unavailable",
    "different-basis": "Different averaging periods",
    "different-dates": "Different test dates",
  }[issue] : "";
}

export function pitchSeparationGap(gap: number): string {
  if (Number(Math.abs(gap).toFixed(1)) === 0) return "0.0 mph gap";
  return `${Math.abs(gap).toFixed(1)} mph ${gap > 0 ? "slower" : "faster"}`;
}
