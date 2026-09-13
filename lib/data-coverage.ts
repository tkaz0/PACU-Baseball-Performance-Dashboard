import { coachingEligible, coachingReadingVisible, type CoachingPlayer } from "@/lib/coaching-tools";
import type { AnalyticsReading } from "@/lib/analytics";
import { PLAYER_METRICS } from "@/lib/player-performance";
import { validTestingDate } from "@/lib/testing-checklist";

export const COVERAGE_GROUPS = [
  { key: "renpho", label: "RENPHO", metrics: ["height", "weight", "body_score", "muscle_mass", "body_fat_pct"] },
  { key: "hitting", label: "Hitting", metrics: ["max_exit_velocity", "avg_exit_velocity", "max_bat_speed", "avg_bat_speed", "smash_factor", "max_distance"] },
  { key: "throwing", label: "Throwing", metrics: ["infield_velocity", "outfield_velocity", "max_pitch_velocity", "avg_pitch_velocity", "avg_fastball_spin", "strike_pct", "k_pct", "bb_pct"] },
] as const;
export type CoverageGroup = (typeof COVERAGE_GROUPS)[number]["key"];
export type CoverageMetric = { label: string; date: string | null; status: "recorded" | "missing" | "review" };
export type CoverageCell = { status: "recorded" | "partial" | "missing" | "review" | "not_applicable"; latest: string | null; recorded: number; expected: number; metrics: CoverageMetric[] };
export type CoverageRow = { player: Pick<CoachingPlayer, "id" | "code" | "name" | "position">; cells: Record<CoverageGroup, CoverageCell> };
export type DataCoverage = { today: string; rows: CoverageRow[] };

/** Counts coverage, never averages or compares values across source/unit partitions.
 * Only dated, validated Fall observations count; a roster ID is not a test. */
export function buildDataCoverage(players: readonly CoachingPlayer[], readings: readonly AnalyticsReading[], today: string): DataCoverage {
  if (!validTestingDate(today)) throw new Error("A valid coverage date is required.");
  const current = readings.filter(r => coachingReadingVisible(r) && r.date >= "2026-09-01" && r.date <= "2026-12-31" && r.date <= today);
  return { today, rows: players.map(player => {
    const cells = Object.fromEntries(COVERAGE_GROUPS.map(group => {
      const metrics: CoverageMetric[] = group.metrics.filter(key => coachingEligible(player, key)).map(key => {
        const candidates = current.filter(r => r.athleteId === player.id && r.metric === key && (group.key !== "renpho" || r.source === "RENPHO"));
        const partitions = new Map<string, AnalyticsReading[]>();
        for (const reading of candidates) { const k = JSON.stringify([reading.source, reading.unit]); partitions.set(k, [...(partitions.get(k) ?? []), reading]); }
        let review = false;
        for (const partition of partitions.values()) {
          const latest = partition.map(r => r.date).sort().at(-1);
          if (new Set(partition.filter(r => r.date === latest).map(r => r.value)).size > 1) review = true;
        }
        return { label: PLAYER_METRICS.find(m => m.key === key)!.label, date: candidates.map(r => r.date).sort().at(-1) ?? null, status: review ? "review" : candidates.length ? "recorded" : "missing" };
      });
      const recorded = metrics.filter(m => m.status === "recorded").length;
      const status = !metrics.length ? "not_applicable" : metrics.some(m => m.status === "review") ? "review" : recorded === metrics.length ? "recorded" : recorded ? "partial" : "missing";
      return [group.key, { status, latest: metrics.flatMap(m => m.date ? [m.date] : []).sort().at(-1) ?? null, recorded, expected: metrics.length, metrics } satisfies CoverageCell];
    })) as Record<CoverageGroup, CoverageCell>;
    return { player: { id: player.id, code: player.code, name: player.name, position: player.position }, cells };
  }).sort((a, b) => a.player.name.localeCompare(b.player.name)) };
}
