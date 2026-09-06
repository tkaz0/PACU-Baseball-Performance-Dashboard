import { PLAYER_METRICS, PLAYER_PERFORMANCE_PERIODS, validatePlayerMetricValue, type PlayerMetricDefinition, type PlayerMetricKey } from "@/lib/player-performance";

export type TestingCategory = "physicality" | "hitting" | "throwing";
export const TESTING_CATEGORIES: readonly { key: TestingCategory; label: string; metricKeys: readonly PlayerMetricKey[] }[] = [
  { key: "physicality", label: "Physicality", metricKeys: ["weight", "height", "grip_strength", "body_fat_pct", "muscle_mass_pct", "home_to_first", "home_to_second", "steal_break", "boxer_t"] },
  { key: "hitting", label: "Hitting", metricKeys: ["max_exit_velocity", "avg_exit_velocity", "max_bat_speed", "avg_bat_speed", "smash_factor", "max_distance", "bat_speed"] },
  { key: "throwing", label: "Throwing", metricKeys: ["infield_velocity", "outfield_velocity", "max_pitch_velocity", "avg_pitch_velocity", "avg_fastball_spin", "strike_pct", "k_pct", "bb_pct"] },
];

/** Only current 2026–27 roster fields needed for testing; no contact/account data. */
export type TestingAthlete = {
  id: string; athleteCode: string; name: string; jerseyNumber: number | null;
  primaryPosition: string | null; secondaryPosition: string | null; playerType: string | null; rosterStatus: string | null;
};
export type TestingReading = { value: number; unit: string; source: string; measuredAt: string };
/** Server-only comparison inputs. Observation IDs/hashes/import times never enter checklist rows. */
export type TestingObservation = TestingReading & { observationId: string; athleteId: string; metricKey: string; importedAt: string; fileHash: string; sourceSheet?: string };
export type TestingChecklistRow = { athlete: TestingAthlete; latest: TestingReading | null; status: "recorded" | "needs_testing" };
export type TestingChecklist = {
  metric: PlayerMetricDefinition; today: string; rows: TestingChecklistRow[];
  recordedCount: number; needsTestingCount: number; totalCount: number;
};

const definitions = new Map(PLAYER_METRICS.map(metric => [metric.key, metric]));
const infield = new Set(["1B", "2B", "3B", "SS", "IF"]), outfield = new Set(["LF", "CF", "RF", "OF"]);
export function testingMetrics(category: TestingCategory): PlayerMetricDefinition[] {
  return (TESTING_CATEGORIES.find(item => item.key === category)?.metricKeys ?? []).map(key => definitions.get(key)!);
}
export function testingMetric(key: string): PlayerMetricDefinition | null {
  return definitions.get(key as PlayerMetricKey) ?? null;
}
export function isTestingRosterActive(athlete: Pick<TestingAthlete, "rosterStatus">): boolean {
  return athlete.rosterStatus === null || athlete.rosterStatus === "active" || athlete.rosterStatus === "redshirt";
}
export function isTestingEligible(athlete: TestingAthlete, metricKey: string): boolean {
  const metric = testingMetric(metricKey);
  if (!metric || !isTestingRosterActive(athlete)) return false;
  const positions = [athlete.primaryPosition, athlete.secondaryPosition].filter((value): value is string => !!value).map(value => value.trim().toUpperCase());
  const type = athlete.playerType?.trim().toLowerCase();
  const pitches = type === "pitcher" || type === "two_way" || positions.includes("P");
  if (metric.group === "body") return true;
  if (metric.group === "hitting") return type === "two_way" || !pitches;
  if (metric.group === "pitching") return pitches;
  if (metricKey === "infield_velocity") return positions.some(position => infield.has(position));
  if (metricKey === "outfield_velocity") return positions.some(position => outfield.has(position));
  return false;
}

export function pacificTestingDate(now = new Date()): string {
  if (!Number.isFinite(now.getTime())) throw new Error("The current testing date could not be verified.");
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validTestingDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function newestFirst(a: TestingObservation, b: TestingObservation): number {
  return compare(b.measuredAt, a.measuredAt) || Date.parse(b.importedAt) - Date.parse(a.importedAt)
    || compare(a.fileHash, b.fileHash) || compare(a.observationId, b.observationId);
}

/** Match the profile's reviewed RENPHO derivation. A report pair never combines
 * athletes, files, dates, pages or mass units. Ambiguous or explicit values are never replaced. */
function musclePercentageObservations(observations: readonly TestingObservation[]): TestingObservation[] {
  const reports = new Map<string, TestingObservation[]>();
  for (const reading of observations) {
    if (reading.source !== "RENPHO" || !/^RENPHO report · Page [1-9][0-9]*$/.test(reading.sourceSheet ?? "") || !/^[a-f0-9]{64}$/.test(reading.fileHash)) continue;
    const key = JSON.stringify([reading.athleteId, reading.fileHash, reading.measuredAt]);
    const group = reports.get(key) ?? []; group.push(reading); reports.set(key, group);
  }
  const derived: TestingObservation[] = [];
  for (const report of reports.values()) {
    const weights = report.filter(reading => reading.metricKey === "weight");
    const muscles = report.filter(reading => reading.metricKey === "muscle_mass");
    // Count candidates before value checks, matching the canonical profile rule.
    if (weights.length !== 1 || muscles.length !== 1 || report.some(reading => reading.metricKey === "muscle_mass_pct")) continue;
    const [weight] = weights, [muscle] = muscles;
    if (weight.sourceSheet !== muscle.sourceSheet || weight.unit !== muscle.unit || !["lb", "kg"].includes(weight.unit)
      || !Number.isFinite(weight.value) || weight.value <= 0 || !Number.isFinite(muscle.value) || muscle.value < 0 || muscle.value > weight.value
      || !Number.isFinite(Date.parse(weight.importedAt)) || !Number.isFinite(Date.parse(muscle.importedAt))
      || !weight.observationId || !muscle.observationId || weight.observationId === muscle.observationId) continue;
    const value = muscle.value / weight.value * 100;
    if (!validatePlayerMetricValue("muscle_mass_pct", value, "%")) continue;
    derived.push({ ...muscle, observationId: JSON.stringify(["derived_muscle_mass_pct", weight.observationId, muscle.observationId]),
      metricKey: "muscle_mass_pct", value, unit: "%", importedAt: Date.parse(weight.importedAt) > Date.parse(muscle.importedAt) ? weight.importedAt : muscle.importedAt });
  }
  return [...observations, ...derived];
}

/** Completeness only. Preserve a single actual result, without ranking or averaging tests. */
export function getTestingChecklist({ roster, observations, metricKey, today = pacificTestingDate() }: {
  roster: readonly TestingAthlete[]; observations: readonly TestingObservation[]; metricKey: string; today?: string;
}): TestingChecklist {
  const metric = testingMetric(metricKey);
  if (!metric || !validTestingDate(today)) throw new Error("Choose a valid testing measurement and date.");
  const window = PLAYER_PERFORMANCE_PERIODS.fall_2026;
  const athletes = roster.filter(athlete => isTestingEligible(athlete, metricKey));
  if (new Set(roster.map(athlete => athlete.id)).size !== roster.length || new Set(roster.map(athlete => athlete.athleteCode)).size !== roster.length) throw new Error("The testing roster contains duplicate identities. Refresh before continuing.");
  const ids = new Set(athletes.map(athlete => athlete.id));
  const latest = new Map<string, TestingObservation>();
  const readings = metricKey === "muscle_mass_pct" ? musclePercentageObservations(observations) : observations;
  for (const observation of readings) {
    if (!ids.has(observation.athleteId) || observation.metricKey !== metricKey
      || !validTestingDate(observation.measuredAt) || observation.measuredAt < window.start || observation.measuredAt > window.end || observation.measuredAt > today
      || !validatePlayerMetricValue(metric.key, observation.value, observation.unit) || !observation.source.trim()
      || !Number.isFinite(Date.parse(observation.importedAt)) || !observation.observationId || !/^[a-f0-9]{64}$/.test(observation.fileHash)) continue;
    const previous = latest.get(observation.athleteId);
    if (!previous || newestFirst(observation, previous) < 0) latest.set(observation.athleteId, observation);
  }
  const rows = [...athletes].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || compare(a.athleteCode, b.athleteCode)).map(athlete => {
    const observation = latest.get(athlete.id);
    return { athlete, latest: observation ? { value: observation.value, unit: observation.unit, source: observation.source, measuredAt: observation.measuredAt } : null,
      status: observation ? "recorded" as const : "needs_testing" as const };
  });
  const recordedCount = rows.filter(row => row.status === "recorded").length;
  return { metric, today, rows, recordedCount, needsTestingCount: rows.length - recordedCount, totalCount: rows.length };
}
