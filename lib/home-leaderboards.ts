import { gameOpportunityLabel } from "@/lib/game-opportunities";
import { formatInnings } from "@/lib/pitching-stats";
import { gameValue, type GameLeaderboardRow } from "@/lib/game-metrics";
import type { LeaderboardComparison, LeaderboardRow } from "@/lib/leaderboards";
import { formatMetricNumber } from "@/lib/measurement-display";

export type HomeRank = { rank: number; code: string; name: string; profileId: string | null; value: string; numericValue?: number; sample?: string; isYou: boolean };
export type HomeLeaderboard = { key: string; metric?: string; source?: string; unit?: string; period?: "fall_2026" | "summer_2026"; eventId?: string; category: string; title: string; href: string; rows: HomeRank[]; total: number; yourRank: number | null };

export function homeMeasurementBoard(key: string, category: string, title: string, href: string, rows: readonly LeaderboardRow[], comparison: LeaderboardComparison, athleteId: string | null): HomeLeaderboard {
  const ranked = rows.map(row => ({ rank: row.rank, code: row.athleteCode, name: row.name, profileId: row.profileId,
    value: `${formatMetricNumber(row.value,comparison.metricKey,comparison.source,String(row.value))} ${comparison.unit}`,
    numericValue: row.value, ...(row.sampleCount != null && row.sampleUnit ? {sample: `${row.sampleCount} ${row.sampleUnit}`} : {}),
    isYou: !!athleteId && row.profileId === athleteId }));
  return { key, metric: comparison.metricKey, source: comparison.source, unit: comparison.unit, period: comparison.period, category, title, href, rows: ranked, total: ranked.length, yourRank: ranked.find(row => row.isYou)?.rank ?? null };
}

export function homeGameBoard(key: string, category: string, title: string, href: string, rows: readonly GameLeaderboardRow[], source: string, eventId: string, metric: string, athleteId: string | null): HomeLeaderboard {
  const matching = rows.filter(row => row.source === source && row.eventId === eventId && row.metric === metric);
  const unit=matching.length&&matching.every(row=>row.unit===matching[0].unit)?matching[0].unit:undefined;
  const ranked = matching
    .sort((a, b) => a.rank - b.rank || a.code.localeCompare(b.code))
    .map(row => ({ rank: row.rank, code: row.code, name: row.name, profileId: row.profileId, value: gameValue(row.value, row.unit), numericValue: row.value, ...(row.opportunities != null ? {sample: gameOpportunityLabel(source,metric) === "outs" ? `${formatInnings(row.opportunities)} IP` : `${row.opportunities} ${gameOpportunityLabel(source,metric) ?? "chances"}`} : {}), isYou: !!athleteId && row.profileId === athleteId }));
  return { key, metric, source, unit, period: "fall_2026", eventId, category, title, href, rows: ranked, total: ranked.length, yourRank: ranked.find(row => row.isYou)?.rank ?? null };
}
