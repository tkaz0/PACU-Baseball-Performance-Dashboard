import {
  PLAYER_METRICS, PLAYER_PERFORMANCE_PERIODS, validatePlayerMetricValue,
  type PlayerMetricCard, type PlayerMetricDefinition, type PlayerMetricReading, type PlayerPercentile,
} from "@/lib/player-performance";

export type PlayerRelativeInsight = {
  metric: PlayerMetricDefinition;
  latest: PlayerMetricReading;
  percentile: PlayerPercentile;
};

export type PlayerImprovementInsight = {
  metric: PlayerMetricDefinition;
  latest: PlayerMetricReading;
  previous: PlayerMetricReading;
  /** Signed change in the original unit: latest minus previous. */
  change: number;
  /** Positive change in the metric's favorable direction. */
  improvement: number;
  relativeImprovementPercent: number;
  changeUnit: string;
};

export type PlayerInsights = {
  strengths: PlayerRelativeInsight[];
  weaknesses: PlayerRelativeInsight[];
  biggestJumps: PlayerImprovementInsight[];
  comparableMetricCount: number;
};

const sourceKey = (source: string) => source.trim().toLowerCase().replace(/\s+/g, " ");
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const definitions = new Map(PLAYER_METRICS.map(metric => [metric.key, metric]));
const metricOrder = new Map(PLAYER_METRICS.map((metric, index) => [metric.key, index]));
const byMetric = (a: { metric: PlayerMetricDefinition }, b: { metric: PlayerMetricDefinition }) =>
  metricOrder.get(a.metric.key)! - metricOrder.get(b.metric.key)!;

// Use the same exact tie-breaks as the canonical profile model; a same-day
// reimport never becomes evidence of improvement between testing dates.
const newestFirst = (a: PlayerMetricReading, b: PlayerMetricReading) => compare(b.measuredAt, a.measuredAt)
  || compare(b.importedAt, a.importedAt)
  || compare(a.provenance[0]?.file_hash ?? "", b.provenance[0]?.file_hash ?? "")
  || compare(a.id, b.id);

function validReading(reading: PlayerMetricReading, metric: PlayerMetricDefinition): boolean {
  const window = PLAYER_PERFORMANCE_PERIODS[reading.period];
  return reading.metricKey === metric.key && !!reading.athleteCode && !!sourceKey(reading.source)
    && validatePlayerMetricValue(metric.key, reading.value, reading.unit)
    && !!window && (reading.period === "fall_2026" || metric.group === "body")
    && /^\d{4}-\d{2}-\d{2}$/.test(reading.measuredAt) && Number.isFinite(Date.parse(reading.measuredAt))
    && new Date(reading.measuredAt).toISOString().slice(0, 10) === reading.measuredAt
    && reading.measuredAt >= window.start && reading.measuredAt <= window.end;
}

function relativeInsight(card: PlayerMetricCard, metric: PlayerMetricDefinition, latest: PlayerMetricReading): PlayerRelativeInsight | null {
  const percentile = card.percentile;
  if (card.percentileStatus !== "available" || !percentile
    || !Number.isSafeInteger(percentile.sampleSize) || percentile.sampleSize < 5
    || !Number.isFinite(percentile.value) || percentile.value < 0 || percentile.value > 100
    || percentile.period !== latest.period || percentile.unit !== latest.unit || percentile.direction !== metric.direction) return null;
  return { metric, latest, percentile };
}

function improvementInsight(card: PlayerMetricCard, metric: PlayerMetricDefinition, latest: PlayerMetricReading): PlayerImprovementInsight | null {
  const previous = [...card.history].filter(reading => validReading(reading, metric)
    && reading.athleteCode === latest.athleteCode && reading.measuredAt < latest.measuredAt
    && reading.period === latest.period && reading.unit === latest.unit && sourceKey(reading.source) === sourceKey(latest.source))
    .sort(newestFirst)[0];
  // Keep the immediately preceding comparable date, even if it cannot support a
  // relative change. Skipping a zero or decline would cherry-pick an older test.
  if (!previous || previous.value <= 0) return null;
  const change = latest.value - previous.value;
  const improvement = metric.direction === "lower" ? -change : change;
  const relativeImprovementPercent = improvement / previous.value * 100;
  if (improvement <= 0 || !Number.isFinite(change) || !Number.isFinite(relativeImprovementPercent)) return null;
  return { metric, latest, previous, change, improvement, relativeImprovementPercent,
    changeUnit: latest.unit === "%" ? "pp" : latest.unit };
}

/**
 * Summarize only the caller's permitted, role-relevant profile cards. This is a
 * deterministic description of reviewed tests, not training or health advice.
 * Current percentiles already enforce the exact source/unit/period team cohort.
 */
export function getPlayerInsights(cards: readonly PlayerMetricCard[]): PlayerInsights {
  const strengths: PlayerRelativeInsight[] = [];
  const weaknesses: PlayerRelativeInsight[] = [];
  const biggestJumps: PlayerImprovementInsight[] = [];
  let comparableMetricCount = 0;
  const seen = new Set<string>();
  for (const card of cards) {
    const metric = definitions.get(card.metric.key);
    const latest = card.latest;
    if (!metric || metric.direction === "neutral" || seen.has(metric.key) || !latest || !validReading(latest, metric)) continue;
    seen.add(metric.key);
    const relative = relativeInsight(card, metric, latest);
    if (relative) comparableMetricCount += 1;
    if (relative && relative.percentile.value >= 75) strengths.push(relative);
    if (relative && relative.percentile.value <= 25) weaknesses.push(relative);
    const jump = improvementInsight(card, metric, latest);
    if (jump) biggestJumps.push(jump);
  }
  return {
    strengths: strengths.sort((a, b) => b.percentile.value - a.percentile.value || byMetric(a, b)).slice(0, 3),
    weaknesses: weaknesses.sort((a, b) => a.percentile.value - b.percentile.value || byMetric(a, b)).slice(0, 3),
    biggestJumps: biggestJumps.sort((a, b) => b.relativeImprovementPercent - a.relativeImprovementPercent || byMetric(a, b)).slice(0, 3),
    comparableMetricCount,
  };
}
