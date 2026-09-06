import { describe, expect, it } from "vitest";
import { getPlayerInsights } from "@/lib/player-insights";
import {
  PLAYER_METRICS, getPlayerPerformance,
  type PlayerMetricCard, type PlayerMetricKey, type PlayerMetricReading,
} from "@/lib/player-performance";
import type { Measurement } from "@/lib/imports/engine";

// Generated fictional observations only; no accounts, reports or live data.
const definition = (key: PlayerMetricKey) => PLAYER_METRICS.find(metric => metric.key === key)!;
function observation(key: PlayerMetricKey, value: number, measuredAt = "2026-09-19", extra: Partial<Measurement> = {}): Measurement {
  return {
    id: `fictional-${key}-${measuredAt}-${value}`, athlete_code: "SYN-001", metric: key, value,
    unit: definition(key).units[0], measured_at: measuredAt, source: "Fictional protocol", source_file: "fictional.csv",
    source_sheet: "Values", source_row: 2, file_hash: "a".repeat(64), ...extra,
  };
}
function fromObservations(key: PlayerMetricKey, observations: Measurement[], cohortAthleteCodes?: string[]): PlayerMetricCard {
  const model = getPlayerPerformance({ readings: observations, athleteCode: "SYN-001", cohortAthleteCodes });
  return Object.values(model).flat().find(card => card.metric.key === key)!;
}
function compared(key: PlayerMetricKey, values: number[]): PlayerMetricCard {
  const cohort = values.map((_, index) => `SYN-${String(index + 1).padStart(3, "0")}`);
  return fromObservations(key, values.map((value, index) => observation(key, value, "2026-09-19", {
    id: `fictional-peer-${key}-${index}`, athlete_code: cohort[index],
  })), cohort);
}
function changed(key: PlayerMetricKey, before: number, after: number): PlayerMetricCard {
  return fromObservations(key, [observation(key, before, "2026-09-12"), observation(key, after)]);
}
const metricKeys = (values: { metric: { key: PlayerMetricKey } }[]) => values.map(item => item.metric.key);

describe("player Overview relative team insights", () => {
  it("keeps missing observations and unavailable comparisons empty", () => {
    expect(getPlayerInsights([])).toEqual({ strengths: [], weaknesses: [], biggestJumps: [], comparableMetricCount: 0 });
    const missing = fromObservations("max_exit_velocity", []);
    const oneReading = fromObservations("max_exit_velocity", [observation("max_exit_velocity", 90)]);
    expect(getPlayerInsights([missing, oneReading])).toEqual({ strengths: [], weaknesses: [], biggestJumps: [], comparableMetricCount: 0 });
  });

  it("uses favorable team percentiles for both higher and lower directions", () => {
    const result = getPlayerInsights([
      compared("max_exit_velocity", [90, 70, 75, 80, 85]),
      compared("home_to_first", [4, 4.1, 4.2, 4.3, 4.4]),
      compared("avg_exit_velocity", [60, 70, 75, 80, 85]),
      compared("bb_pct", [15, 5, 7, 8, 10]),
    ]);
    expect(metricKeys(result.strengths)).toEqual(["max_exit_velocity", "home_to_first"]);
    expect(metricKeys(result.weaknesses)).toEqual(["avg_exit_velocity", "bb_pct"]);
    expect(result.strengths.every(item => item.percentile.sampleSize === 5 && item.percentile.value === 100)).toBe(true);
    expect(result.weaknesses.every(item => item.percentile.value === 0)).toBe(true);
  });

  it("includes the 75th and 25th percentile boundaries and leaves middle results unclassified", () => {
    const result = getPlayerInsights([
      compared("max_exit_velocity", [85, 70, 75, 80, 90]),
      compared("avg_exit_velocity", [75, 70, 80, 85, 90]),
      compared("bat_speed", [80, 70, 75, 85, 90]),
    ]);
    expect(result.strengths[0].percentile.value).toBe(75);
    expect(result.weaknesses[0].percentile.value).toBe(25);
    expect(result.comparableMetricCount).toBe(3);
    expect([...metricKeys(result.strengths), ...metricKeys(result.weaknesses)]).not.toContain("bat_speed");
  });

  it("does not rate body composition, size or spin even at an extreme numerical percentile", () => {
    for (const key of ["height", "weight", "body_fat_pct", "muscle_mass_pct", "avg_fastball_spin"] as const) {
      const card = compared(key, [90, 70, 75, 80, 85]);
      card.history.unshift({ ...card.latest!, id: "fictional-older-neutral", value: 50, measuredAt: "2026-09-12" });
      expect(getPlayerInsights([card])).toEqual({ strengths: [], weaknesses: [], biggestJumps: [], comparableMetricCount: 0 });
    }
  });

  it("requires at least five actual comparable athletes and an available comparison", () => {
    expect(getPlayerInsights([compared("max_exit_velocity", [90, 70, 75, 80])]).strengths).toEqual([]);
    for (const percentileStatus of ["missing", "small_cohort", "not_in_cohort", "unavailable"] as const) {
      expect(getPlayerInsights([{ ...compared("max_exit_velocity", [90, 70, 75, 80, 85]), percentileStatus }]).strengths).toEqual([]);
    }
  });

  it.each([
    { value: NaN }, { value: Infinity }, { value: -1 }, { value: 101 },
    { sampleSize: 4 }, { sampleSize: 5.1 }, { sampleSize: Infinity },
    { period: "summer_2026" as const }, { unit: "km/h" }, { direction: "lower" as const },
  ])("does not use a malformed or mismatched percentile %j", override => {
    const card = compared("max_exit_velocity", [90, 70, 75, 80, 85]);
    card.percentile = { ...card.percentile!, ...override };
    expect(getPlayerInsights([card]).strengths).toEqual([]);
  });

  it("limits output to the caller's permitted cards and never fills another role's metrics", () => {
    const pitcherCards = [compared("max_pitch_velocity", [90, 70, 75, 80, 85]), changed("bb_pct", 10, 8)];
    const before = structuredClone(pitcherCards);
    const result = getPlayerInsights(pitcherCards);
    expect(metricKeys(result.strengths)).toEqual(["max_pitch_velocity"]);
    expect(metricKeys(result.biggestJumps)).toEqual(["bb_pct"]);
    expect(pitcherCards).toEqual(before);
  });

  it("uses stable metric order for ties, caps each list at three and never repeats a card", () => {
    const keys = ["max_pitch_velocity", "max_distance", "smash_factor", "max_exit_velocity", "grip_strength"] as const;
    const cards = keys.map(key => compared(key, key === "smash_factor" ? [1.5, 1, 1.1, 1.2, 1.3] : [90, 70, 75, 80, 85]));
    const expected = ["grip_strength", "max_exit_velocity", "smash_factor"];
    expect(metricKeys(getPlayerInsights([...cards, cards[0]]).strengths)).toEqual(expected);
    expect(getPlayerInsights([...cards, cards[0]]).comparableMetricCount).toBe(5);
    expect(metricKeys(getPlayerInsights([...cards].reverse()).strengths)).toEqual(expected);
    expect(getPlayerInsights(keys.map(key => compared(key, [1, 2, 3, 4, 5]))).weaknesses).toHaveLength(3);
  });
});

describe("player Overview biggest jumps", () => {
  it("preserves signed changes, favorable direction and percentage-point units", () => {
    const jumps = getPlayerInsights([
      changed("max_exit_velocity", 80, 88), changed("home_to_first", 5, 4.5), changed("strike_pct", 50, 60), changed("bb_pct", 10, 8),
    ]).biggestJumps;
    expect(metricKeys(jumps)).toEqual(["strike_pct", "bb_pct", "max_exit_velocity"]);
    expect(jumps[0]).toMatchObject({ change: 10, improvement: 10, relativeImprovementPercent: 20, changeUnit: "pp" });
    expect(jumps[1]).toMatchObject({ change: -2, improvement: 2, relativeImprovementPercent: 20, changeUnit: "pp" });
    const timed = getPlayerInsights([changed("home_to_first", 5, 4.5)]).biggestJumps[0];
    expect(timed).toMatchObject({ change: -0.5, improvement: 0.5, relativeImprovementPercent: 10, changeUnit: "s" });
    expect(timed.previous.measuredAt).toBe("2026-09-12");
    expect(timed.latest.measuredAt).toBe("2026-09-19");
  });

  it("orders unlike units by relative improvement, keeping raw changes for display", () => {
    const result = getPlayerInsights([
      changed("max_distance", 100, 105), changed("max_exit_velocity", 80, 88),
      changed("home_to_first", 5, 4), changed("smash_factor", 1, 1.3),
    ]);
    expect(metricKeys(result.biggestJumps)).toEqual(["smash_factor", "home_to_first", "max_exit_velocity"]);
    expect(result.biggestJumps[0].relativeImprovementPercent).toBeCloseTo(30);
  });

  it("does not cherry-pick an older gain when the immediately preceding comparable test declined", () => {
    const card = fromObservations("max_exit_velocity", [
      observation("max_exit_velocity", 70, "2026-09-01"), observation("max_exit_velocity", 90, "2026-09-12"), observation("max_exit_velocity", 80),
    ]);
    expect(getPlayerInsights([card, changed("home_to_first", 4, 4.1), changed("strike_pct", 50, 50)]).biggestJumps).toEqual([]);
  });

  it("never treats same-day readings as jumps, and keeps the model's latest chosen reading", () => {
    const card = changed("max_exit_velocity", 80, 90);
    card.history.push({ ...card.latest!, id: "fictional-other-same-day", value: 95 });
    const jump = getPlayerInsights([card]).biggestJumps[0];
    expect(jump.latest).toBe(card.latest);
    expect(jump.latest.value).toBe(90);
    expect(jump.previous.value).toBe(80);
    expect(getPlayerInsights([{ ...card, history: card.history.filter(item => item.measuredAt === "2026-09-19") }]).biggestJumps).toEqual([]);
  });

  it("chooses the most recent import on the previous date and uses hash then ID for exact ties", () => {
    const card = changed("max_exit_velocity", 70, 90);
    const previous = card.history[0];
    const dated = (id: string, value: number, importedAt: string, hash: string): PlayerMetricReading => ({
      ...previous, id, value, importedAt, provenance: [{ ...previous.provenance[0], file_hash: hash.repeat(64) }],
    });
    card.history = [
      dated("fictional-a", 82, "2026-09-13T00:00:00.001Z", "a"),
      dated("fictional-a", 70, "2026-09-13T00:00:00.000Z", "a"),
      dated("fictional-a", 83, "2026-09-13T00:00:00.001Z", "b"),
      dated("fictional-b", 84, "2026-09-13T00:00:00.001Z", "a"),
    ];
    expect(getPlayerInsights([card]).biggestJumps[0].previous.value).toBe(82);
    card.history.reverse();
    expect(getPlayerInsights([card]).biggestJumps[0].previous.value).toBe(82);
  });

  it.each([
    { athleteCode: "SYN-002" }, { metricKey: "avg_exit_velocity" as const },
    { source: "Fictional different protocol" }, { unit: "km/h" },
    { period: "summer_2026" as const, measuredAt: "2026-08-19" },
  ])("does not compare across athlete, metric, protocol, unit or period %j", override => {
    const card = changed("max_exit_velocity", 80, 90);
    card.history = [{ ...card.history[0], ...override }];
    expect(getPlayerInsights([card]).biggestJumps).toEqual([]);
  });

  it("keeps June–August body testing separate from Fall, including directional grip strength", () => {
    const card = fromObservations("grip_strength", [observation("grip_strength", 70, "2026-08-19"), observation("grip_strength", 90)]);
    expect(getPlayerInsights([card]).biggestJumps).toEqual([]);
  });

  it("uses the same whitespace/case source normalization as the percentile model", () => {
    const card = changed("max_exit_velocity", 80, 90);
    card.history[0] = { ...card.history[0], source: "  FICTIONAL   protocol  " };
    expect(getPlayerInsights([card]).biggestJumps[0].previous.value).toBe(80);
  });

  it("does not skip a zero baseline, divides only finite positive baselines, and permits a zero walk rate", () => {
    const card = fromObservations("max_exit_velocity", [observation("max_exit_velocity", 60, "2026-09-01"),
      observation("max_exit_velocity", 0, "2026-09-12"), observation("max_exit_velocity", 80)]);
    expect(getPlayerInsights([card, changed("max_exit_velocity", Number.MIN_VALUE, Number.MAX_VALUE)]).biggestJumps).toEqual([]);
    expect(getPlayerInsights([changed("bb_pct", 10, 0)]).biggestJumps[0]).toMatchObject({ change: -10, improvement: 10, relativeImprovementPercent: 100 });
  });

  it.each([NaN, Infinity, -1])("ignores invalid latest values %s", value => {
    const card = changed("max_exit_velocity", 80, 90);
    card.latest = { ...card.latest!, value };
    expect(getPlayerInsights([card])).toEqual({ strengths: [], weaknesses: [], biggestJumps: [], comparableMetricCount: 0 });
  });

  it("does not mutate source cards or their histories", () => {
    const card = changed("home_to_first", 5, 4);
    const before = structuredClone(card);
    Object.freeze(card.history);
    Object.freeze(card);
    getPlayerInsights([card]);
    expect(card).toEqual(before);
  });
});
