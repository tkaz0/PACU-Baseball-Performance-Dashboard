import type { SharedGameStat } from "@/lib/game-server";
import { gameCountMap, productionParts } from "@/lib/advanced-game-stats";

export type ProductionPart = { key: string; label: string; count: number; weight: number; points: number; share: number };
export type HittingProduction = { pa: number; total: number; rate: number; players: number; parts: ProductionPart[] };

/** A decomposition of the existing PAC Production numerator, not a new score or run estimate.
 * Pool source counts for team views; never average player rates or hide incomplete contributors.
 */
export function hittingProduction(stats: readonly SharedGameStat[]): HittingProduction | null {
  const rows = stats.filter(r => r.source === "qpa_fall_2026");
  if (!rows.length || new Set(rows.map(r => r.snapshot_id)).size !== 1 || new Set(rows.map(r => r.content_hash)).size !== 1
    || rows.some(r => r.scope !== "cumulative_fall" || r.event_id !== null || r.unit !== (r.metric === "qpa_pct" ? "%" : "count"))) return null;
  const counts = { singles: 0, xbh: 0, hr: 0, free: 0 }; let pa = 0;
  const ids = [...new Set(rows.map(r => r.athlete_id))];
  for (const id of ids) {
    const v = gameCountMap(rows.filter(r => r.athlete_id === id), "qpa_fall_2026");
    const p = v && productionParts(v); if (!v || !p) return null;
    const h = v.get("base_hit")!, xbh = v.get("hh_extra_base_hit")!, hr = v.get("pumps")!;
    // Optional outcomes can invalidate a complete-looking production line.
    if (v.has("punchies") && v.get("punchies")! + h > v.get("ab")!) return null;
    if (v.has("sac_bunt") && v.get("ab")! + v.get("bb")! + v.get("hbp")! + v.get("sac_fly")! + v.get("sac_bunt")! > p.bottom) return null;
    counts.singles += h - xbh - hr; counts.xbh += xbh; counts.hr += hr; counts.free += v.get("bb")! + v.get("hbp")!; pa += p.bottom;
  }
  const total = counts.singles + 2 * counts.xbh + 4 * counts.hr + counts.free;
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(pa)) return null;
  const definitions = [["singles", "Singles", 1], ["xbh", "Doubles / Triples", 2], ["hr", "Home Runs", 4], ["free", "Free Passes", 1]] as const;
  return { pa, total, rate: total / pa, players: ids.length, parts: definitions.map(([key, label, weight]) => ({key, label, weight, count: counts[key], points: counts[key] * weight, share: total > 0 ? 100 * counts[key] * weight / total : 0})) };
}
