import type { Measurement } from "@/lib/imports/engine";
import { classifiedPitchSource } from "@/lib/imports/classified-pitch-results";
import { PITCH_TYPES, pitchTypeLabel } from "@/lib/imports/pitch-assignments";
import { fallArsenalPitches } from "@/lib/pitch-arsenal";
import { contactAllowedSummary, type AllowedContact } from "@/lib/contacts-allowed";

export type PitchDevelopmentDay = {
  date: string; velocity: number | null; velocityCount: number | null;
  spin: number | null; spinCount: number | null; avgEv: number | null;
  hardHit: number | null; balls: number;
};
export type PitchDevelopmentGroup = {
  key: string; pitchType: string; label: string; category: "Game" | "Intrasquad" | "Practice";
  days: PitchDevelopmentDay[];
};
const validDate = (date: string) => /^2026-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;

/** Authorized own-athlete input only. Return daily numeric summaries, never file/row identities.
 * Same-date files use each metric's verified reading count. Exact source categories stay separate.
 * Contacts have no readable file identity, so contact comparisons are by actual date, not by file.
 */
export function pitchDevelopment(readings: readonly Measurement[], contacts: readonly AllowedContact[] | null, athleteCode: string, context: "in_game" | "practice", today: string): PitchDevelopmentGroup[] {
  if (!validDate(today) || !/^PAC-\d{4,9}$/.test(athleteCode)) return [];
  const cutoff = today < "2026-12-31" ? today : "2026-12-31";
  const relevant = readings.filter(r => classifiedPitchSource(r.source) && validDate(r.measured_at) && r.measured_at >= "2026-09-01" && r.measured_at <= cutoff);
  if (relevant.some(r => r.athlete_code !== athleteCode)) return [];
  const groups: PitchDevelopmentGroup[] = [];
  for (const category of ["Game", "Intrasquad", "Practice"] as const) {
    if ((category === "Practice" ? "practice" : "in_game") !== context) continue;
    for (const pitchType of PITCH_TYPES.filter(p => p !== "Fastball")) {
      const rows = relevant.filter(r => { const p = classifiedPitchSource(r.source)!; return p.category === category && p.pitchType === pitchType; });
      const byFile = new Map<string, Set<string>>();
      for (const r of rows) { const dates = byFile.get(r.file_hash) ?? new Set(); dates.add(r.measured_at); byFile.set(r.file_hash, dates); }
      if ([...byFile.values()].some(dates => dates.size !== 1)) continue;
      const allowed = (contacts ?? []).filter(c => c.category === category.toLowerCase() && c.pitchType === pitchType && validDate(c.playedOn) && c.playedOn >= "2026-09-01" && c.playedOn <= cutoff);
      const dates = [...new Set([...rows.map(r => r.measured_at), ...allowed.map(c => c.playedOn)])].sort();
      const days = dates.map(date => {
        const pitch = fallArsenalPitches(rows.filter(r => r.measured_at === date), today)[0];
        const contact = contactAllowedSummary(allowed.filter(c => c.playedOn === date));
        return { date, velocity: pitch?.velocityBasis === "fall" ? pitch.averageVelocity : null,
          velocityCount: pitch?.velocityBasis === "fall" ? pitch.velocityReadings : null,
          spin: pitch?.spinBasis === "fall" ? pitch.averageSpin : null,
          spinCount: pitch?.spinBasis === "fall" ? pitch.spinReadings : null,
          avgEv: contact.avgEv, hardHit: contact.hardHitPct, balls: contact.count };
      });
      if (days.some(d => d.velocity !== null || d.spin !== null || d.avgEv !== null)) groups.push({ key: `${category}:${pitchType}`, category, pitchType, label: pitchTypeLabel(pitchType), days });
    }
  }
  return groups;
}
