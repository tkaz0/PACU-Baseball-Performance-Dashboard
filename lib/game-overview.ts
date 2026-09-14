import { pitchingRates } from "@/lib/pitching-stats";
import { pitchingWeek } from "@/lib/game-source";
import { battingRates } from "@/lib/batting-stats";
import { GAME_METRIC_LABELS, gameDirection, type GameComparison } from "@/lib/game-metrics";
import { gameOpportunities } from "@/lib/game-opportunities";
import type { SharedGameStat } from "@/lib/game-server";

export type GameOverviewMetric = {
  metric: string; label: string; source: string; eventId: string; value: number; unit: string;
  updatedAt: string; playedOn: string | null; opportunities: number | null;
  comparison: GameComparison | null; direction: "higher" | "lower" | "neutral"; insightEligible: boolean;
};
const battingOrder = ["batting_avg", "batting_obp", "qpa_pct", "batting_hh_pct", "batting_hr_pct", "batting_bb_pct", "batting_k_pct", "pumps", "sb", "gdp", "batting_sb_per_pa"];
const insightRates = new Set(battingOrder.slice(0, 7));
/** Own-player rows only. Bind each comparison to the exact current snapshot/event/value. */
export function gameOverviewMetrics(stats: readonly SharedGameStat[], comparisons: readonly GameComparison[]): GameOverviewMetric[] {
  if (new Set(stats.map(r => r.athlete_id)).size !== 1) return [];
  const output: GameOverviewMetric[] = [];
  function group(rows: SharedGameStat[], source: string, eventId: string) {
    if (!rows.length || new Set(rows.map(r => r.snapshot_id)).size !== 1 || new Set(rows.map(r => r.metric)).size !== rows.length || rows.some(r => !Number.isFinite(r.value) || r.value < 0)) return;
    const qpa = source === "qpa_fall_2026";
    const order = qpa ? battingOrder : ["pitching_k9","pitching_bb9","pitching_era","strike_pct", "k", "bb_outcome"];
    const values = qpa ? [...battingRates(rows), ...rows.filter(r => ["qpa_pct", "pumps", "sb", "gdp"].includes(r.metric))] : [...rows,...pitchingRates(rows).filter(r=>r.value!==null).map(r=>({...r,value:r.value!}))];
    for (const metric of order) {
      const reading = values.find(r => r.metric === metric); if (!reading) continue;
      const matches = comparisons.filter(c => c.source === source && c.metric === metric && c.eventId === eventId);
      const c = matches.length === 1 ? matches[0] : null;
      const comparison = c && c.snapshotId === rows[0].snapshot_id && Number.isFinite(c.value) && Math.abs(c.value - reading.value) < 1e-10 && Number.isSafeInteger(c.sampleSize) && c.sampleSize >= 5 && c.percentile !== null && Number.isFinite(c.percentile) && c.percentile >= 0 && c.percentile <= 100 ? c : null;
      output.push({ metric, source, eventId, value: reading.value, unit: reading.unit,
        label: qpa ? GAME_METRIC_LABELS[metric] ?? "SB/PA" : ({ pitching_k9:"K/9",pitching_bb9:"BB/9",pitching_era:"ERA",strike_pct: "Strike %", k: "Strikeouts", bb_outcome: "Walks Allowed" }[metric] ?? metric),
        updatedAt: rows.map(r => r.fetched_at).sort().at(-1)!, playedOn: rows[0].played_on,
        opportunities: gameOpportunities(rows, source, metric, eventId || null), comparison,
        direction: gameDirection(source, metric), insightEligible: qpa ? insightRates.has(metric) : ["pitching_k9","pitching_bb9","pitching_era","strike_pct"].includes(metric) });
    }
  }
  group(stats.filter(r => r.source === "qpa_fall_2026" && r.event_id === null), "qpa_fall_2026", "");
  // Keep weekly and dated result series separate; never infer where an undated week falls among games.
  const pitching = stats.filter(r => r.source === "pitching_fall_2026" && r.event_id);
  const weekly = pitching.filter(r => pitchingWeek(r.event_id) !== null && r.played_on === null);
  const dated = pitching.filter(r => r.played_on);
  // The current sheet is weekly. Mixed series need an explicit period choice before an overview is shown.
  const newest = weekly.length && dated.length ? undefined : weekly.length
    ? [...weekly].sort((a,b)=>pitchingWeek(b.event_id)!-pitchingWeek(a.event_id)!)[0]
    : [...dated].sort((a,b)=>b.played_on!.localeCompare(a.played_on!)||b.event_id!.localeCompare(a.event_id!))[0];
  if (newest) group(pitching.filter(r => r.event_id === newest.event_id), "pitching_fall_2026", newest.event_id!);
  return output;
}
