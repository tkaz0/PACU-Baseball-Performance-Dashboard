import { isTimedMetric, isVisibleProfileMetric, normalizePlayerMetric, PLAYER_METRICS, validatePlayerMetricValue } from "@/lib/player-performance";
import { CLASSIFIED_METRICS, classifiedPitchSource } from "@/lib/imports/classified-pitch-results";
import { BLAST_MAIN_METRICS } from "@/lib/blast-fall";
import { validBlastObservation } from "@/lib/blast-metrics";
import { playerGameSources } from "@/lib/coaching-tools";
import type { SharedGameStat } from "@/lib/game-server";
import type { DashboardVisitWindow } from "@/lib/personal-dashboard-server";
export type VisitReading = { id: string; athleteId: string; metric: string; label: string; source: string; unit: string; value: number; date: string; importedAt: string };
export type VisitPlayer = { id: string; name?: string; playerType?: string | null; position?: string | null; secondaryPosition?: string | null };
export type VisitBest = { athleteId: string; playerName: string | null; metric: string; label: string; unit: string; source: string; value: number; previous: number; measuredAt: string; addedAt: string };
export type VisitDigest = { newResults: number; updatedPlayers: number; newBests: number; bests: VisitBest[]; gameSources: number };
const maxMetrics = new Set(["max_exit_velocity","max_bat_speed","max_distance","max_pitch_velocity","infield_velocity","outfield_velocity","classified_max_velocity"]);
/** Own-profile labels and staff canonical keys resolve to the same activity catalog. */
export function visitMetricKey(label: string, unit: string): string {
  return normalizePlayerMetric(label, unit)?.key
    ?? BLAST_MAIN_METRICS.find(metric => metric.label === label && metric.unit === unit)?.key
    ?? CLASSIFIED_METRICS.find(metric => metric.label === label && metric.unit === unit)?.key
    ?? "";
}
function visible(r: VisitReading, player: VisitPlayer): boolean {
  if (!isVisibleProfileMetric(r.metric)) return false;
  // The shared roster rule matches the profile's pitcher-only and explicit two-way sections.
  const sources = playerGameSources({ playerType: player.playerType ?? "", position: player.position ?? "", secondaryPosition: player.secondaryPosition ?? "" });
  const hitting = sources.includes("qpa_fall_2026"), pitching = sources.includes("pitching_fall_2026");
  if (r.metric.startsWith("blast_") || r.metric === "p95_bat_speed" || r.source.startsWith("Blast Motion · ")) {
    return hitting && (BLAST_MAIN_METRICS.some(metric => metric.key === r.metric) || r.metric === "p95_bat_speed")
      && validBlastObservation(r.metric, r.value, r.unit, r.source, r.date);
  }
  if (r.metric.startsWith("classified_")) {
    return pitching && !!classifiedPitchSource(r.source) && CLASSIFIED_METRICS.some(metric => metric.key === r.metric && metric.unit !== "count" && metric.unit === r.unit)
      && Number.isFinite(r.value) && r.value >= 0;
  }
  const metric = PLAYER_METRICS.find(metric => metric.key === r.metric);
  if (!metric || !validatePlayerMetricValue(metric.key, r.value, r.unit)) return false;
  if (metric.group === "hitting") return hitting;
  if (metric.group === "pitching") return pitching;
  if (metric.group === "throwing") {
    const positions = [player.position, player.secondaryPosition].map(position => position?.trim().toUpperCase());
    const relevant = metric.key === "infield_velocity" ? ["1B", "2B", "3B", "SS", "IF"] : ["LF", "CF", "RF", "OF"];
    return positions.some(position => !!position && relevant.includes(position));
  }
  return true;
}
const timestamp = (v: string) => Date.parse(v);
/** Scope to already authorized players; no new source fetches or invented session counts. */
export function buildVisitDigest(players: readonly VisitPlayer[], readings: readonly VisitReading[], games: readonly SharedGameStat[], visit: DashboardVisitWindow, today: string): VisitDigest {
  const empty: VisitDigest = { newResults: 0, updatedPlayers: 0, newBests: 0, bests: [], gameSources: 0 };
  if (!visit.since || !Number.isFinite(timestamp(visit.since)) || timestamp(visit.since) >= timestamp(visit.viewedAt)) return empty;
  const ids = new Map(players.map(p => [p.id, p])), cutoff = today < "2026-12-31" ? today : "2026-12-31";
  const valid = readings.filter(r => ids.has(r.athleteId) && visible(r, ids.get(r.athleteId)!) && r.date >= "2026-09-01" && r.date <= cutoff && Number.isFinite(timestamp(r.importedAt)) && timestamp(r.importedAt) <= timestamp(visit.viewedAt));
  const unique = [...new Map(valid.map(r => [r.id, r])).values()];
  const recent = unique.filter(r => timestamp(r.importedAt) > timestamp(visit.since!));
  const key = (r: VisitReading) => JSON.stringify([r.athleteId,r.metric,r.source,r.unit]);
  const groups = new Map<string, VisitReading[]>();
  for (const r of unique) if ((maxMetrics.has(r.metric) || (isTimedMetric(r.metric) && r.unit === "s")) && (!r.metric.startsWith("classified_") || classifiedPitchSource(r.source))) groups.set(key(r), [...(groups.get(key(r)) ?? []),r]);
  const bests: VisitBest[] = [];
  for (const rows of groups.values()) {
    const older = rows.filter(r => timestamp(r.importedAt) <= timestamp(visit.since!)), added = rows.filter(r => timestamp(r.importedAt) > timestamp(visit.since!));
    if (!older.length || !added.length) continue;
    const lower = isTimedMetric(rows[0].metric), sort = (a: VisitReading,b: VisitReading) => (lower ? a.value-b.value : b.value-a.value) || b.date.localeCompare(a.date);
    const previous = [...older].sort(sort)[0], latest = [...added].sort(sort)[0];
    if (lower ? latest.value >= previous.value : latest.value <= previous.value) continue;
    bests.push({ athleteId: latest.athleteId, playerName: ids.get(latest.athleteId)!.name ?? null, metric: latest.metric, label: latest.label, unit: latest.unit, source: latest.source, value: latest.value, previous: previous.value, measuredAt: latest.date, addedAt: latest.importedAt });
  }
  bests.sort((a,b) => b.addedAt.localeCompare(a.addedAt) || a.label.localeCompare(b.label));
  const refreshedGames = games.filter(g => ids.has(g.athlete_id) && timestamp(g.fetched_at) > timestamp(visit.since!) && timestamp(g.fetched_at) <= timestamp(visit.viewedAt));
  return { newResults: recent.length, updatedPlayers: new Set(recent.map(r => r.athleteId)).size, newBests: bests.length, bests: bests.slice(0,5), gameSources: new Set(refreshedGames.map(g => g.source)).size };
}
