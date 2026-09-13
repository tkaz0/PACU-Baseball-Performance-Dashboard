import type { SharedGameStat } from "@/lib/game-server";

export type TeamGameMetric = {
  metric: string; label: string; value: number | null; unit: "count" | "%" | "avg";
  opportunities?: number; opportunityLabel?: string;
  pending: boolean;
};
export type TeamGameSummary = {
  players: number; entries: number; games: number; updatedAt: string | null;
  counts: TeamGameMetric[]; rates: TeamGameMetric[];
};
type Counts = Map<string, number>;
type Ratio = { top: number; bottom: number };
const battingCounts = [["pa", "PA"], ["ab", "AB"], ["base_hit", "Hits"], ["pumps", "HR"], ["rbi", "RBI"], ["sb", "SB"], ["gdp", "GDP"]] as const;
const pitchingCounts = [["pitches", "Pitches"], ["strikes", "Strikes"], ["k", "K"], ["bb_outcome", "BB"], ["h", "Hits Allowed"], ["r", "Runs Allowed"]] as const;

/** Aggregate only one current source snapshot. Never average player rates or mix manual logs. */
export function teamGameSummary(stats: readonly SharedGameStat[], source: SharedGameStat["source"]): TeamGameSummary {
  const rows = stats.filter(row => row.source === source);
  const qpa = source === "qpa_fall_2026", groups = new Map<string, Counts>();
  let valid = new Set(rows.map(r => r.snapshot_id)).size <= 1 && new Set(rows.map(r => r.content_hash)).size <= 1;
  for (const row of rows) {
    const key = JSON.stringify([row.athlete_id, row.event_id]);
    const values = groups.get(key) ?? new Map<string, number>();
    if (values.has(row.metric) || !Number.isFinite(row.value) || row.value < 0 || (row.unit === "count" && !Number.isSafeInteger(row.value))) valid = false;
    values.set(row.metric, row.value); groups.set(key, values);
  }
  const entries = [...groups.values()];
  const count = (metric: string, label: string): TeamGameMetric => {
    const complete = valid && entries.length > 0 && entries.every(v => v.has(metric));
    return { metric, label, unit: "count", value: complete ? entries.reduce((n, v) => n + v.get(metric)!, 0) : null, pending: entries.length > 0 && !complete };
  };
  const rate = (metric: string, label: string, unit: "%" | "avg", keys: string[], ratio: (v: Counts) => Ratio | null, opportunityLabel: string): TeamGameMetric => {
    const parts = valid ? entries.map(v => keys.every(k => v.has(k)) ? ratio(v) : null) : [null];
    const complete = entries.length > 0 && parts.every((p): p is Ratio => p !== null && p.top >= 0 && p.bottom >= 0 && p.top <= p.bottom);
    const top = complete ? parts.reduce((n, p) => n + p!.top, 0) : 0;
    const bottom = complete ? parts.reduce((n, p) => n + p!.bottom, 0) : 0;
    return { metric, label, unit, value: complete && bottom > 0 ? top / bottom * (unit === "%" ? 100 : 1) : null,
      ...(complete && bottom > 0 ? { opportunities: bottom, opportunityLabel } : {}), pending: entries.length > 0 && !complete };
  };
  const simple = (metric: string, label: string, top: string, bottom: string, unit: "%" | "avg", opportunity: string) => rate(metric, label, unit, [top, bottom], v => ({ top: v.get(top)!, bottom: v.get(bottom)! }), opportunity);
  const rates = qpa ? [
    simple("batting_avg", "AVG", "base_hit", "ab", "avg", "AB"),
    rate("batting_obp", "OBP", "avg", ["base_hit", "ab", "bb", "hbp", "sac_fly"], v => {
      const bottom = v.get("ab")! + v.get("bb")! + v.get("hbp")! + v.get("sac_fly")!;
      if (v.get("base_hit")! > v.get("ab")! || (v.has("pa") && bottom > v.get("pa")!)) return null;
      return { top: v.get("base_hit")! + v.get("bb")! + v.get("hbp")!, bottom };
    }, "OBP opportunities"),
    simple("qpa_pct", "QPA %", "qpa", "pa", "%", "PA"),
    rate("batting_hh_pct", "HH %", "%", ["hh_base_hit", "three_eight_hh", "hh_extra_base_hit", "pumps", "ab", "punchies", "sac_bunt"], v => ({
      top: v.get("hh_base_hit")! + v.get("three_eight_hh")! + v.get("hh_extra_base_hit")! + v.get("pumps")!,
      bottom: v.get("ab")! - v.get("punchies")! - v.get("sac_bunt")!,
    }), "HH opportunities"),
    simple("batting_bb_pct", "BB %", "bb", "pa", "%", "PA"),
    simple("batting_k_pct", "K %", "punchies", "pa", "%", "PA"),
    rate("batting_hr_pct", "HR %", "%", ["pumps", "pa"], v => v.has("base_hit") && v.get("pumps")! > v.get("base_hit")! ? null : { top: v.get("pumps")!, bottom: v.get("pa")! }, "PA"),
  ] : [simple("strike_pct", "Strike %", "strikes", "pitches", "%", "pitches")];
  return { players: new Set(rows.map(r => r.athlete_id)).size, entries: entries.length,
    games: qpa ? 0 : new Set(rows.map(r => r.event_id)).size,
    updatedAt: rows.length ? rows.reduce((latest, r) => r.fetched_at > latest ? r.fetched_at : latest, rows[0].fetched_at) : null,
    counts: (qpa ? battingCounts : pitchingCounts).map(([metric, label]) => count(metric, label)), rates };
}

export function formatTeamGameMetric(metric: TeamGameMetric): string {
  if (metric.value === null) return "—";
  if (metric.unit === "%") return `${metric.value.toFixed(1)}%`;
  if (metric.unit === "avg") return metric.value.toFixed(3).replace(/^0\./, ".");
  return metric.value.toLocaleString("en-US");
}
