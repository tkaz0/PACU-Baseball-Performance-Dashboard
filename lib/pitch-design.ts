import { fallArsenalPitches, type FallArsenalPitch } from "@/lib/pitch-arsenal";
import type { Measurement } from "@/lib/imports/engine";
import type { PlayerMetricCard, PlayerMetricReading, PlayerPerformance } from "@/lib/player-performance";
import { FEATURED_PITCHER_STUDY_IDS, PITCHER_STUDY_REFERENCES, type PitcherStudyReference } from "@/lib/pitcher-study-references";

export type PitchBodyRank = { value: number; sampleSize: number };
export type PitchDesignBody = {
  height: { value: number; date: string } | null;
  weight: { value: number; date: string } | null;
  heightRank: PitchBodyRank | null;
  weightRank: PitchBodyRank | null;
};
export type PitcherStudyMatch = {
  reference: PitcherStudyReference;
  sharedPitches: string[];
  heightPercentile: number | null;
  weightPercentile: number | null;
  sizeUsed: boolean;
  speedGapsUsed: boolean;
  spinRelationshipsUsed: boolean;
};
export type PitchDesignContext = { category: FallArsenalPitch["category"]; pitches: FallArsenalPitch[]; studies: PitcherStudyMatch[] };
export type PitchDesignModel = { contexts: PitchDesignContext[]; body: PitchDesignBody; throws: "R" | "L" | null; mixedAthletes: boolean };
const emptyBody = (): PitchDesignBody => ({ height: null, weight: null, heightRank: null, weightRank: null });
const positive = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

function bodyRank(card: PlayerMetricCard | undefined): PitchBodyRank | null {
  const rank = card?.percentile, reading = card?.latest;
  return card?.percentileStatus === "available" && reading && positive(reading.value) && rank &&
    rank.unit === reading.unit && rank.period === reading.period && rank.direction === "neutral" &&
    Number.isSafeInteger(rank.sampleSize) && rank.sampleSize >= 5 && Number.isFinite(rank.value) && rank.value >= 0 && rank.value <= 100
    ? { value: rank.value, sampleSize: rank.sampleSize } : null;
}

function pitcherBody(performance: PlayerPerformance, today: string): PitchDesignBody {
  const h = performance.body.find(card => card.metric.key === "height"), w = performance.body.find(card => card.metric.key === "weight");
  const current = (reading: PlayerMetricReading | null | undefined) => reading && /^\d{4}-\d{2}-\d{2}$/.test(reading.measuredAt) && Number.isFinite(Date.parse(reading.measuredAt)) && new Date(reading.measuredAt).toISOString().slice(0, 10) === reading.measuredAt && reading.measuredAt <= today ? reading : null;
  const hr = current(h?.latest), wr = current(w?.latest);
  const height = hr?.unit === "in" ? hr.value : hr?.unit === "cm" ? hr.value / 2.54 : null;
  const weight = wr?.unit === "lb" ? wr.value : wr?.unit === "kg" ? wr.value * 2.20462262185 : wr?.unit === "st" ? wr.value * 14 : null;
  return {
    height: hr && positive(height) ? { value: height, date: hr.measuredAt } : null,
    weight: wr && positive(weight) ? { value: weight, date: wr.measuredAt } : null,
    heightRank: positive(height) ? bodyRank(h) : null, weightRank: positive(weight) ? bodyRank(w) : null,
  };
}

/** Midrank within the full verified MLB cohort, before hand and featured-name filters. */
export function pitcherSizePercentile(value: number, key: "heightInches" | "weightLb", references: readonly PitcherStudyReference[] = PITCHER_STUDY_REFERENCES): number | null {
  const values = references.map(reference => reference[key]).filter(positive);
  if (!positive(value) || values.length < 5) return null;
  return (values.filter(item => item < value).length + values.filter(item => item === value).length / 2) / values.length * 100;
}

function comparablePair(a: FallArsenalPitch, b: FallArsenalPitch, metric: "velocity" | "spin") {
  const count = metric === "velocity" ? "velocityReadings" : "spinReadings";
  const first = metric === "velocity" ? "velocityAverageFirstDate" : "spinAverageFirstDate";
  const last = metric === "velocity" ? "velocityAverageLastDate" : "spinAverageLastDate";
  const basis = metric === "velocity" ? "velocityBasis" : "spinBasis";
  const value = metric === "velocity" ? "averageVelocity" : "averageSpin";
  return a.category === b.category && positive(a[value]) && positive(b[value]) &&
    Number.isSafeInteger(a[count]) && positive(a[count]) && Number.isSafeInteger(b[count]) && positive(b[count]) &&
    a[basis] === "fall" && b[basis] === "fall" && !!a[first] && a[first] === b[first] && !!a[last] && a[last] === b[last];
}

/** Custom study ordering, never a player grade, mechanical diagnosis, or projection.
 * Exact shared types lead. Speed gaps and spin ratios avoid matching raw MLB speeds
 * to college readings. Comparable size means relative rank in each environment.
 */
export function pitcherStudyMatches(pitches: readonly FallArsenalPitch[], body: PitchDesignBody, throws: string | null | undefined,
  references: readonly PitcherStudyReference[] = PITCHER_STUDY_REFERENCES,
  featuredIds: readonly number[] = FEATURED_PITCHER_STUDY_IDS): PitcherStudyMatch[] {
  if (throws !== "R" && throws !== "L") return [];
  if (new Set(pitches.map(pitch => pitch.category)).size !== 1 || new Set(pitches.map(pitch => pitch.pitchType)).size !== pitches.length) return [];
  const own = pitches.filter(pitch => !["Fastball", "Breaking Ball", "Other"].includes(pitch.pitchType) &&
    [pitch.averageVelocity, pitch.maxVelocity, pitch.averageSpin, pitch.maxSpin].some(positive));
  if (!own.length) return [];
  const cohort = references.filter((reference, index) => references.findIndex(item => item.id === reference.id) === index);
  const candidates = cohort.filter(reference => reference.throws === throws && featuredIds.includes(reference.id));
  return candidates.flatMap(reference => {
    const shared = own.flatMap(pitch => {
      const pro = reference.pitches.find(item => item.pitchType === pitch.pitchType);
      return pro ? [{ own: pitch, pro }] : [];
    });
    if (shared.length < Math.min(2, own.length)) return [];
    const heightPercentile = pitcherSizePercentile(reference.heightInches, "heightInches", cohort);
    const weightPercentile = pitcherSizePercentile(reference.weightLb, "weightLb", cohort);
    const sizeDistances = [body.heightRank && heightPercentile !== null ? Math.abs(body.heightRank.value - heightPercentile) / 100 : null,
      body.weightRank && weightPercentile !== null ? Math.abs(body.weightRank.value - weightPercentile) / 100 : null].filter((value): value is number => value !== null);
    const speedDistances: number[] = [], spinDistances: number[] = [];
    for (let i = 0; i < shared.length; i++) for (let j = i + 1; j < shared.length; j++) {
      const a = shared[i], b = shared[j];
      if (comparablePair(a.own, b.own, "velocity") && positive(a.pro.averageVelocity) && positive(b.pro.averageVelocity))
        speedDistances.push(Math.min(1, Math.abs((a.own.averageVelocity! - b.own.averageVelocity!) - (a.pro.averageVelocity - b.pro.averageVelocity)) / 10));
      if (comparablePair(a.own, b.own, "spin") && positive(a.pro.averageSpin) && positive(b.pro.averageSpin))
        spinDistances.push(Math.min(1, Math.abs(Math.log(a.own.averageSpin! / b.own.averageSpin!) - Math.log(a.pro.averageSpin / b.pro.averageSpin))));
    }
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const relationships = [speedDistances, spinDistances].filter(values => values.length).map(mean);
    const tieDistance = relationships.length && sizeDistances.length ? mean(relationships) * .6 + mean(sizeDistances) * .4
      : relationships.length ? mean(relationships) : sizeDistances.length ? mean(sizeDistances) : 0;
    return [{ reference, sharedPitches: shared.map(pair => pair.own.pitchType), heightPercentile, weightPercentile,
      sizeUsed: sizeDistances.length > 0, speedGapsUsed: speedDistances.length > 0, spinRelationshipsUsed: spinDistances.length > 0, tieDistance }];
  }).sort((a, b) => b.sharedPitches.length - a.sharedPitches.length || a.tieDistance - b.tieDistance || a.reference.id - b.reference.id)
    .slice(0, 3).map(({ tieDistance: _distance, ...match }) => { void _distance; return match; });
}

/** All raw readings stay server-side; only one authorized athlete's summaries leave this boundary. */
export function buildPitchDesign(readings: readonly Measurement[], performance: PlayerPerformance, throws: string | null | undefined, today?: string): PitchDesignModel {
  const cardReadings = Object.values(performance).flatMap(cards => cards.flatMap(card => [card.latest, ...(card.sourceCards ?? []).map(source => source.latest)]))
    .filter((reading): reading is PlayerMetricReading => reading !== null);
  const identities = new Set([...readings.map(row => row.athlete_code), ...cardReadings.map(row => row.athleteCode)]);
  const mixedAthletes = identities.size > 1 || identities.has("");
  const hand = throws === "R" || throws === "L" ? throws : null;
  if (mixedAthletes) return { contexts: [], body: emptyBody(), throws: hand, mixedAthletes };
  const cutoff = today ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff) || !Number.isFinite(Date.parse(cutoff)) || new Date(cutoff).toISOString().slice(0, 10) !== cutoff) return { contexts: [], body: emptyBody(), throws: hand, mixedAthletes };
  const body = pitcherBody(performance, cutoff), pitches = fallArsenalPitches(readings, cutoff);
  const contexts = (["Game", "Intrasquad", "Practice"] as const).flatMap(category => {
    const scoped = pitches.filter(pitch => pitch.category === category);
    return scoped.length ? [{ category, pitches: scoped, studies: pitcherStudyMatches(scoped, body, hand) }] : [];
  });
  return { contexts, body, throws: hand, mixedAthletes };
}
