import type { SharedGameStat } from "@/lib/game-server";
import type { TeamGameTrends } from "@/lib/game-trends";
import type { TeamGameMetric, TeamGameSummary } from "@/lib/team-game-stats";
import { teamWeekChange, weekChangeSince, type TeamWeekChange } from "@/lib/team-week-change";

export type PlayerWeekJump = { source: SharedGameStat["source"]; metric: TeamGameMetric; change: TeamWeekChange & { percent: number }; since: string };

/** The player's own most-improved Fall-to-date rate since the previous game week; own saved snapshots only. */
export function biggestWeekJump(trends: TeamGameTrends, batting: TeamGameSummary, pitching: TeamGameSummary): PlayerWeekJump | null {
  const candidates = ([["qpa_fall_2026", batting], ["pitching_fall_2026", pitching]] as const).flatMap(([source, summary]) => summary.entries > 0 ? summary.rates.flatMap(metric => {
    const change = teamWeekChange(trends, source, metric, summary.updatedAt);
    // Only a real improvement with a defined percentage; a zero baseline has no relative change.
    return change && change.tone === "good" && change.percent !== null && change.percent !== 0 ? [{ source, metric, change: change as PlayerWeekJump["change"], since: weekChangeSince(change).since }] : [];
  }) : []);
  return candidates.sort((a, b) => Math.abs(b.change.percent) - Math.abs(a.change.percent) || a.metric.label.localeCompare(b.metric.label))[0] ?? null;
}
