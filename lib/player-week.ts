import type { SharedGameStat } from "@/lib/game-server";
import type { TeamGameTrends } from "@/lib/game-trends";
import type { TeamGameMetric, TeamGameSummary } from "@/lib/team-game-stats";
import { teamWeekChange, weekChangeSince, type TeamWeekChange } from "@/lib/team-week-change";

/** `percent` is null when the previous value was zero (a first recorded result), which ranks after any defined jump. */
export type PlayerWeekJump = { source: SharedGameStat["source"]; metric: TeamGameMetric; change: TeamWeekChange; since: string };

/** The player's own most-improved Fall-to-date rate since the previous game week; own saved snapshots only. */
export function biggestWeekJump(trends: TeamGameTrends, batting: TeamGameSummary, pitching: TeamGameSummary): PlayerWeekJump | null {
  const candidates = ([["qpa_fall_2026", batting], ["pitching_fall_2026", pitching]] as const).flatMap(([source, summary]) => summary.entries > 0 ? summary.rates.flatMap(metric => {
    const change = teamWeekChange(trends, source, metric, summary.updatedAt);
    // Only real improvements. A zero baseline has no relative change, so it is kept as a first result.
    return change && change.tone === "good" && change.percent !== 0 ? [{ source, metric, change, since: weekChangeSince(change).since }] : [];
  }) : []);
  const size = (jump: PlayerWeekJump) => jump.change.percent === null ? -1 : Math.abs(jump.change.percent);
  return candidates.sort((a, b) => size(b) - size(a) || a.metric.label.localeCompare(b.metric.label))[0] ?? null;
}
