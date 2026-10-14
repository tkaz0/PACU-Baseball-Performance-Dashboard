import type { PlayerMetricCard, PlayerPerformance } from "@/lib/player-performance";
import type { AthleteSeason } from "@/lib/types";
import type { FallArsenalPitch } from "@/lib/pitch-arsenal";
import { profileShowsHitting, profileShowsPitching } from "@/lib/player-profile-layout";
import { profileMetricLabel } from "@/lib/profile-metric-label";
import { pitchTypeLabel } from "@/lib/imports/pitch-assignments";
import { pitchSourceLabel } from "@/lib/pitch-display";
import { formatMetricNumber, formatSpin } from "@/lib/measurement-display";

export type ProfileHeaderResult = { key: string; label: string; value: string; source: string; date: string; guide: { value: number; unit: string; source: string } };
/** A small role-aware projection of existing results. No new averages or cross-source pooling. */
export function profileHeaderResults(performance: PlayerPerformance, season: AthleteSeason | null | undefined, arsenal: readonly FallArsenalPitch[]): ProfileHeaderResult[] {
  const results: ProfileHeaderResult[] = [];
  const add = (card?: PlayerMetricCard) => {
    const reading = card?.latest;
    if (!card || !reading || !Number.isFinite(reading.value)) return;
    const basis = card.fallSummary?.basis === "best" ? "Fall best" : card.fallSummary?.pooled ? "Fall average" : "Latest session";
    results.push({ key: card.metric.key, label: card.metric.key === "body_score" ? "Body Score" : profileMetricLabel(card.metric.key, card.metric.label, reading.source), value: `${formatMetricNumber(reading.value, card.metric.key, reading.source)} ${reading.unit}`.trim(), source: `${pitchSourceLabel(reading.source)}${card.metric.group === "hitting" ? ` · ${basis}` : ""}`, date: card.fallSummary?.basis === "best" ? card.fallSummary.bestDate : reading.measuredAt, guide: { value: reading.value, unit: reading.unit, source: reading.source } });
  };
  if (profileShowsHitting(season)) add(performance.hitting.find(card => card.metric.key === "max_exit_velocity"));
  if (profileShowsPitching(season)) {
    // Prefer an in-game pitch. Each value remains attached to its exact classified pitch/source.
    const available = arsenal.filter(pitch => pitch.maxVelocity !== null && Number.isFinite(pitch.maxVelocity));
    const pitch = [...available].sort((a, b) => Number(a.category === "Practice") - Number(b.category === "Practice") || b.maxVelocity! - a.maxVelocity!)[0];
    if (pitch) {
      results.push({ key: "classified_max_velocity", label: `${pitchTypeLabel(pitch.pitchType).replace(" Fastball", "")} · Max Velo`, value: `${pitch.maxVelocity!.toFixed(1)} mph`, source: `Full Swing · ${pitch.category} · Fall best`, date: pitch.maxVelocityDate ?? pitch.lastDate, guide: { value: pitch.maxVelocity!, unit: "mph", source: pitch.source } });
      if (!profileShowsHitting(season) && pitch.averageSpin !== null) results.push({ key: "classified_avg_spin", label: `${pitchTypeLabel(pitch.pitchType).replace(" Fastball", "")} · Avg Spin`, value: `${formatSpin(pitch.averageSpin)} RPM`, source: `${pitch.category} · ${pitch.spinBasis === "fall" ? "Fall average" : "Latest session"}`, date: pitch.spinAverageLastDate ?? pitch.lastDate, guide: { value: pitch.averageSpin, unit: "rpm", source: pitch.source } });
    }
  } else if (profileShowsHitting(season)) add(performance.hitting.find(card => card.metric.key === "avg_exit_velocity"));
  for (const key of ["body_score", "muscle_mass", "body_fat_pct"]) {
    if (results.length >= 3) break;
    add(performance.body.find(card => card.metric.key === key));
  }
  return results.slice(0, 3);
}
