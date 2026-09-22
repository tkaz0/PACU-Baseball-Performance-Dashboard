import { gameValue, type GameLeaderboardRow } from "@/lib/game-metrics";
import type { LeaderboardComparison, LeaderboardRow } from "@/lib/leaderboards";
import { formatSourceNumber } from "@/lib/measurement-display";

export type HomeRank = { rank: number; code: string; name: string; profileId: string | null; value: string; isYou: boolean };
export type HomeLeaderboard = { key: string; category: string; title: string; href: string; rows: HomeRank[]; total: number; yourRank: number | null };

export function homeMeasurementBoard(key: string, category: string, title: string, href: string, rows: readonly LeaderboardRow[], comparison: LeaderboardComparison, athleteId: string | null): HomeLeaderboard {
  const ranked = rows.map(row => ({ rank: row.rank, code: row.athleteCode, name: row.name, profileId: row.profileId,
    value: `${formatSourceNumber(row.value, comparison.source, String(row.value))} ${comparison.unit}`,
    isYou: !!athleteId && row.profileId === athleteId }));
  return { key, category, title, href, rows: ranked, total: ranked.length, yourRank: ranked.find(row => row.isYou)?.rank ?? null };
}

export function homeGameBoard(key: string, category: string, title: string, href: string, rows: readonly GameLeaderboardRow[], source: string, eventId: string, metric: string, athleteId: string | null): HomeLeaderboard {
  const ranked = rows.filter(row => row.source === source && row.eventId === eventId && row.metric === metric)
    .sort((a, b) => a.rank - b.rank || a.code.localeCompare(b.code))
    .map(row => ({ rank: row.rank, code: row.code, name: row.name, profileId: row.profileId, value: gameValue(row.value, row.unit), isYou: !!athleteId && row.profileId === athleteId }));
  return { key, category, title, href, rows: ranked, total: ranked.length, yourRank: ranked.find(row => row.isYou)?.rank ?? null };
}
