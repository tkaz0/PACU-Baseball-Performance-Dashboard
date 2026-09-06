import { describe, expect, it } from "vitest";
import { PLAYER_METRICS, getPlayerPerformance } from "@/lib/player-performance";
import { getTestingChecklist, isTestingEligible, pacificTestingDate, TESTING_CATEGORIES, testingMetrics, type TestingAthlete, type TestingObservation } from "@/lib/testing-checklist";

const athlete = (changes: Partial<TestingAthlete> = {}): TestingAthlete => ({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", athleteCode: "SYN-001", name: "Fictional Player", jerseyNumber: 0,
  primaryPosition: "OF", secondaryPosition: null, playerType: "position", rosterStatus: "active", ...changes });
const reading = (changes: Partial<TestingObservation> = {}): TestingObservation => ({ observationId: "fictional-observation", athleteId: athlete().id, metricKey: "max_exit_velocity",
  value: 80, unit: "mph", measuredAt: "2026-09-12", source: "Fictional protocol", importedAt: "2026-09-12T23:00:00.000Z", fileHash: "a".repeat(64), ...changes });
const checklist = (observations: TestingObservation[], metricKey = "max_exit_velocity", roster = [athlete()]) => getTestingChecklist({ roster, observations, metricKey, today: "2026-09-19" });

describe("testing categories and eligibility", () => {
  it("offers each canonical measurement once, keeping generic/max/average bat speed distinct", () => {
    const keys = TESTING_CATEGORIES.flatMap(category => testingMetrics(category.key).map(metric => metric.key));
    expect(new Set(keys).size).toBe(PLAYER_METRICS.length); expect([...keys].sort()).toEqual(PLAYER_METRICS.map(metric => metric.key).sort());
    expect(testingMetrics("physicality").some(metric => metric.key === "home_to_first")).toBe(true);
    expect(testingMetrics("hitting").filter(metric => metric.key.includes("bat_speed"))).toHaveLength(3);
  });
  it.each(["pitcher", null])("removes hitting and speed from pitcher-only testing (player type=%s)", playerType => {
    const pitcher = athlete({ primaryPosition: "P", playerType });
    for (const key of ["max_exit_velocity", "max_bat_speed", "home_to_first", "boxer_t"]) expect(isTestingEligible(pitcher, key)).toBe(false);
    for (const key of ["max_pitch_velocity", "strike_pct", "height", "body_fat_pct"]) expect(isTestingEligible(pitcher, key)).toBe(true);
  });
  it("requires explicit two-way status to retain hitting when a pitching position is present", () => {
    const twoWay = athlete({ primaryPosition: "P", secondaryPosition: "SS", playerType: "two_way" });
    for (const key of ["home_to_first", "max_exit_velocity", "infield_velocity", "max_pitch_velocity"]) expect(isTestingEligible(twoWay, key)).toBe(true);
    expect(isTestingEligible(twoWay, "outfield_velocity")).toBe(false);
    expect(isTestingEligible(athlete({ secondaryPosition: "P", playerType: "position" }), "max_exit_velocity")).toBe(false);
  });
  it.each(["C", "DH", "UT", null])("does not infer infield/outfield velocity for %s", primaryPosition => {
    expect(isTestingEligible(athlete({ primaryPosition }), "infield_velocity")).toBe(false);
    expect(isTestingEligible(athlete({ primaryPosition }), "outfield_velocity")).toBe(false);
  });
  it("recognizes explicit field positions and never assigns pitching tests to position-only players", () => {
    expect(isTestingEligible(athlete({ primaryPosition: " ss ", secondaryPosition: "CF" }), "infield_velocity")).toBe(true);
    expect(isTestingEligible(athlete({ primaryPosition: " ss ", secondaryPosition: "CF" }), "outfield_velocity")).toBe(true);
    expect(isTestingEligible(athlete(), "max_pitch_velocity")).toBe(false);
  });
  it.each([null, "active", "redshirt"])("includes the current eligible roster status %s", rosterStatus => {
    expect(isTestingEligible(athlete({ rosterStatus }), "weight")).toBe(true);
  });
  it.each(["inactive", "transferred", "injured", "", "unknown"])("excludes unsupported/non-current eligibility status %s from every metric", rosterStatus => {
    for (const metric of PLAYER_METRICS) expect(isTestingEligible(athlete({ rosterStatus }), metric.key)).toBe(false);
  });
});

describe("testing checklist completeness", () => {
  it("uses missing states, never fabricated zero readings or rankings", () => {
    const result = checklist([]);
    expect(result).toMatchObject({ recordedCount: 0, needsTestingCount: 1, totalCount: 1 });
    expect(result.rows[0]).toEqual({ athlete: athlete(), latest: null, status: "needs_testing" });
    expect(JSON.stringify(result)).not.toContain("rank");
  });
  it("requires a valid recorded date this Fall; earlier body testing does not complete a Fall item", () => {
    const body = [reading({ metricKey: "weight", value: 150, unit: "lb", measuredAt: "2026-08-09" })];
    expect(checklist(body, "weight").recordedCount).toBe(0);
    body.push(reading({ observationId: "fictional-fall", metricKey: "weight", value: 155, unit: "lb", measuredAt: "2026-09-01" }));
    expect(checklist(body, "weight").recordedCount).toBe(1);
  });
  it.each(["2026-09-20", "2026-12-31", "2027-09-12", "2026-08-31", "2026-09-31"])("ignores future/outside/invalid testing date %s", measuredAt => {
    expect(checklist([reading({ measuredAt })]).recordedCount).toBe(0);
  });
  it("selects one latest valid result and keeps its original unit, source and actual test date together", () => {
    const result = checklist([reading(), reading({ observationId: "fictional-new", value: 120, unit: "km/h", source: "Other fictional protocol", measuredAt: "2026-09-19" }),
      reading({ observationId: "fictional-invalid", value: -1, measuredAt: "2026-09-19", importedAt: "2026-09-20T00:00:00Z" })]);
    expect(result.rows[0].latest).toEqual({ value: 120, unit: "km/h", source: "Other fictional protocol", measuredAt: "2026-09-19" });
    expect(Object.keys(result.rows[0].latest!).sort()).toEqual(["measuredAt", "source", "unit", "value"]);
  });
  it("uses import milliseconds, hash and observation ID to resolve equal test dates deterministically", () => {
    const observations = [reading({ observationId: "c", value: 81, importedAt: "2026-09-12T23:00:00.001Z" }),
      reading({ observationId: "b", value: 82, importedAt: "2026-09-12T16:00:00.001-07:00" }),
      reading({ observationId: "a", value: 83, importedAt: "2026-09-12T23:00:00.001Z", fileHash: "b".repeat(64) }), reading({ value: 84 })];
    expect(checklist(observations).rows[0].latest?.value).toBe(82);
    expect(checklist([...observations].reverse()).rows[0].latest?.value).toBe(82);
  });
  it("keeps valid zero percentages and rejects zero height/time or mismatched units", () => {
    const pitcher = athlete({ playerType: "pitcher", primaryPosition: "P" });
    expect(checklist([reading({ metricKey: "bb_pct", value: 0, unit: "%" })], "bb_pct", [pitcher]).recordedCount).toBe(1);
    for (const [metricKey, unit] of [["height", "in"], ["home_to_first", "s"]]) expect(checklist([reading({ metricKey, unit, value: 0 })], metricKey).recordedCount).toBe(0);
    expect(checklist([reading({ unit: "rpm" })]).recordedCount).toBe(0);
  });
  it("counts only eligible identities and sorts alphabetically rather than by measured value", () => {
    const second = athlete({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", athleteCode: "SYN-002", name: "A Fictional Player" });
    const inactive = athlete({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", athleteCode: "SYN-003", rosterStatus: "inactive" });
    const result = checklist([reading(), reading({ athleteId: second.id, observationId: "fictional-second", value: 1 }), reading({ athleteId: inactive.id, observationId: "fictional-inactive" })], "max_exit_velocity", [athlete(), inactive, second]);
    expect(result).toMatchObject({ totalCount: 2, recordedCount: 2, needsTestingCount: 0 });
    expect(result.rows.map(row => row.athlete.id)).toEqual([second.id, athlete().id]);
    expect(result.rows[1].athlete.jerseyNumber).toBe(0);
  });
  it("does not mutate observations or roster and rejects ambiguous duplicate identities", () => {
    const roster = [athlete()], readings = [reading()]; const original = structuredClone({ roster, readings });
    checklist(readings, "max_exit_velocity", roster); expect({ roster, readings }).toEqual(original);
    expect(() => checklist(readings, "max_exit_velocity", [...roster, athlete()])).toThrow("duplicate identities");
    expect(() => checklist(readings, "unknown")).toThrow("valid testing measurement");
  });
});

describe("Pacific testing dates", () => {
  it("uses the team timezone at UTC midnight and daylight-saving boundaries", () => {
    expect(pacificTestingDate(new Date("2026-09-12T06:59:59Z"))).toBe("2026-09-11");
    expect(pacificTestingDate(new Date("2026-09-12T07:00:00Z"))).toBe("2026-09-12");
    expect(pacificTestingDate(new Date("2026-12-01T07:59:59Z"))).toBe("2026-11-30");
    expect(pacificTestingDate(new Date("2026-12-01T08:00:00Z"))).toBe("2026-12-01");
    expect(() => pacificTestingDate(new Date("invalid"))).toThrow("date could not be verified");
  });
});

describe("reviewed RENPHO muscle percentage checklist completion", () => {
  const pair = (weight: Partial<TestingObservation> = {}, muscle: Partial<TestingObservation> = {}) => [
    reading({ observationId: "fictional-weight", metricKey: "weight", value: 200, unit: "lb", source: "RENPHO", sourceSheet: "RENPHO report · Page 1", ...weight }),
    reading({ observationId: "fictional-muscle", metricKey: "muscle_mass", value: 130, unit: "lb", source: "RENPHO", sourceSheet: "RENPHO report · Page 1", ...muscle }),
  ];
  it.each(["lb", "kg"])("matches the existing canonical profile derivation for a reviewed report in %s", unit => {
    const observations = pair({ unit }, { unit });
    const readings = observations.map(item => ({ id: item.observationId, athlete_code: athlete().athleteCode, metric: item.metricKey === "weight" ? "Weight" : "Muscle Mass",
      value: item.value, unit: item.unit, measured_at: item.measuredAt, source: item.source, source_file: "fictional-report.png", source_sheet: item.sourceSheet!, source_row: 1, file_hash: item.fileHash }));
    const profile = getPlayerPerformance({ readings, athleteCode: athlete().athleteCode });
    const expected = profile.body.find(card => card.metric.key === "muscle_mass_pct")!.latest!;
    const result = checklist(observations, "muscle_mass_pct");
    expect(result.recordedCount).toBe(1);
    expect(result.rows[0].latest).toEqual({ value: expected.value, unit: expected.unit, source: expected.source, measuredAt: expected.measuredAt });
  });
  it.each([
    { athleteId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }, { fileHash: "b".repeat(64) }, { measuredAt: "2026-09-13" },
    { sourceSheet: "RENPHO report · Page 2" }, { sourceSheet: "Other report" }, { source: "Other source" },
    { unit: "kg" }, { value: 201 }, { value: -1 }, { value: Infinity }, { importedAt: "invalid" },
  ])("never combines mismatched or invalid report evidence %#", changes => {
    expect(checklist(pair({}, changes), "muscle_mass_pct").recordedCount).toBe(0);
  });
  it("rejects zero weight, unsupported mass units, missing inputs and duplicate candidates before validation", () => {
    for (const observations of [pair({ value: 0 }), pair({ unit: "st" }, { unit: "st" }), [pair()[0]], [pair()[1]],
      [...pair(), reading({ ...pair()[0], observationId: "fictional-invalid-duplicate", value: -1 })]]) {
      expect(checklist(observations, "muscle_mass_pct").recordedCount).toBe(0);
    }
  });
  it("uses an explicit percentage in the same report, without replacing an invalid explicit value", () => {
    const explicit = reading({ observationId: "fictional-explicit", metricKey: "muscle_mass_pct", value: 70, unit: "%", source: "RENPHO", sourceSheet: "RENPHO report · Page 1" });
    expect(checklist([...pair(), explicit], "muscle_mass_pct").rows[0].latest?.value).toBe(70);
    expect(checklist([...pair(), { ...explicit, value: 101 }], "muscle_mass_pct").recordedCount).toBe(0);
  });
  it("keeps earlier-body and future report pairs outside Fall completion", () => {
    for (const measuredAt of ["2026-08-09", "2026-09-20"]) {
      expect(checklist(pair({ measuredAt }, { measuredAt }), "muscle_mass_pct").recordedCount).toBe(0);
    }
  });
});
