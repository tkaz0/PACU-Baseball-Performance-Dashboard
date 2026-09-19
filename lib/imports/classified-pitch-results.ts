import { PITCH_TYPES, summarizeAssignedPitches, validatePitchAssignments, type PitchAssignment } from "@/lib/imports/pitch-assignments";
import type { FullSwingSession } from "@/lib/imports/full-swing-session";
import type { Measurement } from "@/lib/imports/engine";

export const CLASSIFIED_METRICS = [
  { key: "classified_max_velocity", label: "Pitch Type Max Velocity", unit: "mph", field: "maxVelocity" },
  { key: "classified_avg_velocity", label: "Pitch Type Average Velocity", unit: "mph", field: "averageVelocity" },
  { key: "classified_max_spin", label: "Pitch Type Max Spin", unit: "rpm", field: "maxSpin" },
  { key: "classified_avg_spin", label: "Pitch Type Average Spin", unit: "rpm", field: "averageSpin" },
  { key: "classified_pitch_count", label: "Pitch Type Count", unit: "count", field: "count" },
  { key: "classified_velocity_count", label: "Pitch Type Velocity Readings", unit: "count", field: "velocityCount" },
  { key: "classified_spin_count", label: "Pitch Type Spin Readings", unit: "count", field: "spinCount" },
] as const;
export type PitchResultContext = { fileName: string; fileHash: string; date: string; category: "game" | "intrasquad"; matches: { identity: string; athleteCode: string }[] };
export function classifiedPitchSource(source: string) {
  const match = /^Full Swing · (Game|Intrasquad) · (.+)$/.exec(source);
  return match && PITCH_TYPES.includes(match[2] as typeof PITCH_TYPES[number]) ? { category: match[1], pitchType: match[2] } : null;
}
/** Only reviewed labels, exact roster matches and explicitly confirmed mph/RPM. */
export function prepareClassifiedPitchResults(session: FullSwingSession, assignments: PitchAssignment[], context: PitchResultContext): Measurement[] {
  const labels = validatePitchAssignments(assignments);
  if (!/^[a-f0-9]{64}$/.test(context.fileHash) || context.date !== session.date || !["game", "intrasquad"].includes(context.category) || labels.some(a => !session.pitches.some(p => p.sourceRow === a.sourceRow))) throw new Error("Review the original session and saved pitch labels.");
  const matches = new Map(context.matches.map(m => [m.identity, m.athleteCode]));
  if (matches.size !== context.matches.length || new Set(matches.values()).size !== matches.size) throw new Error("Each export pitcher needs a unique roster match.");
  const sheet = "CSV · Classified pitch summaries v1";
  return summarizeAssignedPitches(session.pitches, labels).flatMap(group => {
    const code = matches.get(group.identity);
    if (!code || group.pitchType === "Unassigned") return [];
    // Fixed per-pitcher source coordinate and per-type columns survive exclusions.
    const row = Math.min(...session.pitches.filter(p => p.identity === group.identity).map(p => p.sourceRow));
    const offset = PITCH_TYPES.indexOf(group.pitchType) * CLASSIFIED_METRICS.length;
    const source = `Full Swing · ${context.category === "game" ? "Game" : "Intrasquad"} · ${group.pitchType}`;
    return CLASSIFIED_METRICS.flatMap((metric, i) => {
      const value = group[metric.field];
      if (value === null) return [];
      return [{ id: `observation:${JSON.stringify([context.fileHash, sheet, row, offset + i])}`, athlete_code: code, measured_at: session.date, source, metric: metric.label, value, unit: metric.unit, source_file: context.fileName, source_sheet: sheet, source_row: row, file_hash: context.fileHash }];
    });
  });
}
