import { gameOpportunityLabel } from "@/lib/game-opportunities";
import type { GameLeaderboardRow } from "@/lib/game-metrics";
import type { GameOverviewMetric } from "@/lib/game-overview";
import { fallBallWeekDates } from "@/lib/game-weeks";

/** Owner-chosen display filter: 2 PA or 1 IP for each Fall Ball week played so far. Ranks never change. */
export const QUALIFY_PER_WEEK = { hitting: 2, pitching: 3 } as const;

export function qualifiedGameCodes(rows: readonly GameLeaderboardRow[], discipline: "hitting" | "pitching", weeks: number) {
  const label = discipline === "hitting" ? "PA" : "outs";
  const minimum = QUALIFY_PER_WEEK[discipline] * Math.max(1, weeks);
  const chances = new Map<string, number>();
  for (const row of rows) {
    if (gameOpportunityLabel(row.source, row.metric) !== label || row.opportunities == null || !Number.isFinite(row.opportunities)) continue;
    chances.set(row.code, Math.max(chances.get(row.code) ?? 0, row.opportunities));
  }
  return { codes: new Set([...chances].filter(([, count]) => count >= minimum).map(([code]) => code)), minimum,
    label: discipline === "hitting" ? `${minimum} PA` : `${Math.floor(minimum / 3)}${minimum % 3 ? `.${minimum % 3}` : ""} IP` };
}

/** Fall Ball weeks with an owner-confirmed game date on or before today (at least one). */
export function fallBallWeeksPlayed(today: string): number {
  return Math.max(1, Object.values(fallBallWeekDates()).filter(date => date <= today).length);
}

/**
 * Award badges for hitting game stats require the same minimum as the Qualified leaderboard view:
 * 2 PA per Fall Ball week so far. Ranks and percentiles are unchanged; only the badge is withheld.
 */
export function hitterBadgeQualified(games: readonly Pick<GameOverviewMetric, "source" | "metric" | "opportunities">[], weeks: number): boolean {
  const pa = Math.max(0, ...games.flatMap(g => g.source === "qpa_fall_2026" && gameOpportunityLabel(g.source, g.metric) === "PA" && typeof g.opportunities === "number" && Number.isFinite(g.opportunities) ? [g.opportunities] : []));
  return pa >= QUALIFY_PER_WEEK.hitting * Math.max(1, weeks);
}

/** Pitching game-stat badges use the Qualified pitching minimum: 1 IP (3 outs) per Fall Ball week so far. */
export function pitcherBadgeQualified(games: readonly Pick<GameOverviewMetric, "source" | "metric" | "opportunities">[], weeks: number): boolean {
  const outs = Math.max(0, ...games.flatMap(g => g.source === "pitching_fall_2026" && gameOpportunityLabel(g.source, g.metric) === "outs" && typeof g.opportunities === "number" && Number.isFinite(g.opportunities) ? [g.opportunities] : []));
  return outs >= QUALIFY_PER_WEEK.pitching * Math.max(1, weeks);
}
