import { gameOpportunityLabel } from "@/lib/game-opportunities";
import type { GameLeaderboardRow } from "@/lib/game-metrics";

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
