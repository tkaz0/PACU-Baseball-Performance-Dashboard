import { describe, expect, it } from "vitest";
import { blastSource, type BlastSummaryKind } from "@/lib/blast-metrics";
import { compatibleBattingSide, hitterStudyMatches, HITTER_STUDY_WINDOWS, proBatSpeedPercentile } from "@/lib/hitter-study-matches";
import { HITTER_STUDY_REFERENCES, type HitterStudyReference } from "@/lib/hitter-study-references";
import { FEATURED_HITTER_STUDY_IDS } from "@/lib/hitter-study-featured";
import { attackPath, hitterSwingProfile } from "@/lib/hitter-swing-profile";
import type { Measurement } from "@/lib/imports/engine";
import { getPlayerPerformance } from "@/lib/player-performance";

const reference = (id: number, attackAngle = 12, heightInches = 72, weightLb = 190): HitterStudyReference =>
  ({ id, name: `Fictional Study Hitter ${id}`, bats: "R", attackAngle, averageBatSpeed: null, heightInches, weightLb, competitiveSwings: 600 });

function profile(angle = 12, size: { height?: number; weight?: number } = {}, kind: BlastSummaryKind = "average") {
  const source = blastSource(kind, "2026-09-01", "2026-09-07");
  const measurement = (metric: string, value: number, unit: string, device = source): Measurement => ({
    id: `fictional-${metric}`, athlete_code: "SYN-STUDY-001", measured_at: "2026-09-07", source: device,
    metric, value, unit, source_file: "fictional-study.csv", source_sheet: "CSV", source_row: 2, file_hash: "a".repeat(64),
  });
  const readings = [measurement("Blast Swing Count", 10, "count"), measurement("Attack Angle", angle, "deg")];
  const body = [
    ...(size.height === undefined ? [] : [measurement("Height", size.height, "in", "Fictional body testing")]),
    ...(size.weight === undefined ? [] : [measurement("Weight", size.weight, "lb", "Fictional body testing")]),
  ];
  return hitterSwingProfile(readings, getPlayerPerformance({ readings: body, athleteCode: "SYN-STUDY-001" }));
}
const ids = (result: ReturnType<typeof hitterStudyMatches>) => result.matches.map(match => match.id);

describe("descriptive professional hitter study examples", () => {
  it("requires the same custom path and an inclusive five-degree angle window", () => {
    const result = hitterStudyMatches(profile(15), [reference(1, 10), reference(2, 19.999), reference(3, 9.999), reference(4, 20)]);
    expect(ids(result)).toEqual([2, 1]);
    expect(result).toMatchObject({ basis: "path_only", sizeFallback: false });
    expect(ids(hitterStudyMatches(profile(10), [reference(1, 15), reference(2, 15.00001), reference(3, 9.99999)]))).toEqual([1]);
    expect(HITTER_STUDY_WINDOWS).toEqual({ attackAngle: 5, heightInches: 3, weightLb: 30 });
  });

  it("requires both inclusive size windows when both measurements are available", () => {
    const result = hitterStudyMatches(profile(12, { height: 72, weight: 190 }), [
      reference(1, 12, 75, 220), reference(2, 12, 69, 160),
      reference(3, 12, 75.00001, 190), reference(4, 12, 72, 220.00001), reference(5, 12, 72, 159.99999),
    ]);
    expect(ids(result)).toEqual([1, 2]);
    expect(result).toMatchObject({ basis: "path_and_size", sizeFallback: false });
  });

  it("uses height alone when weight is missing", () => {
    const result = hitterStudyMatches(profile(12, { height: 72 }), [reference(1, 12, 73, 400), reference(2, 12, 76, 190)]);
    expect(ids(result)).toEqual([1]);
    expect(result).toMatchObject({ basis: "path_and_height", sizeFallback: false });
  });

  it("uses weight alone when height is missing", () => {
    const result = hitterStudyMatches(profile(12, { weight: 190 }), [reference(1, 12, 90, 200), reference(2, 12, 72, 221)]);
    expect(ids(result)).toEqual([1]);
    expect(result).toMatchObject({ basis: "path_and_weight", sizeFallback: false });
  });

  it("sorts size-qualified examples by normalized size distance before angle and numeric ID", () => {
    const references = [
      reference(12, 13, 72, 205), // .5 size distance, 1 degree
      reference(2, 13, 73.5, 190), // .5 size distance, 1 degree
      reference(4, 12, 72, 208), // .6 size distance, exact angle
      reference(8, 16, 72, 190), // exact size, 4 degrees
      reference(3, 13, 72, 205), // .5 size distance, 1 degree
    ];
    const result = hitterStudyMatches(profile(12, { height: 72, weight: 190 }), references);
    expect(ids(result)).toEqual([8, 2, 3]);
    expect(result.matches).toHaveLength(3);
    expect(Object.keys(result).sort()).toEqual(["basis", "matches", "sizeFallback"]);
    expect(result.matches[0]).toBe(references[3]);
  });

  it("uses the sum of both normalized size differences", () => {
    const result = hitterStudyMatches(profile(12, { height: 72, weight: 190 }), [
      reference(1, 12, 75, 220), // 2.0
      reference(2, 12, 72, 220), // 1.0
      reference(3, 12, 73.5, 199), // .8
    ]);
    expect(ids(result)).toEqual([3, 2, 1]);
  });

  it("falls back only to path candidates when the available size has no candidates", () => {
    const references = [reference(3, 12.5, 80, 260), reference(12, 13, 80, 260), reference(2, 13, 80, 260), reference(1, 7, 72, 190)];
    for (const size of [{ height: 72, weight: 190 }, { height: 72 }, { weight: 190 }]) {
      const result = hitterStudyMatches(profile(12, size), references);
      expect(ids(result)).toEqual([3, 2, 12]);
      expect(result).toMatchObject({ basis: "path_only", sizeFallback: true });
    }
  });

  it("does not pad a short size-qualified list with path-only candidates", () => {
    const result = hitterStudyMatches(profile(12, { height: 72, weight: 190 }), [reference(1), reference(2, 12, 80, 190), reference(3, 12, 72, 250)]);
    expect(ids(result)).toEqual([1]);
    expect(result).toMatchObject({ basis: "path_and_size", sizeFallback: false });
  });

  it("sorts missing-size matches by angle then numeric ID with a three-example limit", () => {
    const result = hitterStudyMatches(profile(), [reference(12, 13), reference(2, 13), reference(1, 14), reference(4, 12), reference(3, 13)]);
    expect(ids(result)).toEqual([4, 2, 3]);
    expect(result).toMatchObject({ basis: "path_only", sizeFallback: false });
  });

  it.each([-5, 25])("does not force a different-path fallback for an unsupported %s-degree path", angle => {
    expect(hitterStudyMatches(profile(angle, { height: 72 }), [reference(1, 2), reference(2, 18)])).toEqual({ matches: [], basis: "none", sizeFallback: false });
  });

  it("keeps signed and zero angle references when they are valid study candidates", () => {
    expect(ids(hitterStudyMatches(profile(-5), [reference(1, -6), reference(2, 1)]))).toEqual([1]);
    expect(ids(hitterStudyMatches(profile(0), [reference(1, 0), reference(2, -0.01)]))).toEqual([1]);
  });

  it.each([null, NaN, Infinity, -Infinity, 90.001, -90.001])("returns no examples for an unavailable display angle %s", angle => {
    const model = { ...profile(), attackAngle: angle, path: attackPath(angle) };
    expect(hitterStudyMatches(model, [reference(1)])).toEqual({ matches: [], basis: "none", sizeFallback: false });
  });

  it("rejects missing or mismatched paths and a summary requiring review", () => {
    const model = profile();
    expect(hitterStudyMatches({ ...model, path: null }, [reference(1)]).basis).toBe("none");
    expect(hitterStudyMatches({ ...model, path: attackPath(5) }, [reference(1)]).basis).toBe("none");
    expect(hitterStudyMatches({ ...model, summary: { ...model.summary!, issues: ["overlapping_periods"] } }, [reference(1)]).basis).toBe("none");
  });

  it("does not produce examples from P95-only data", () => {
    const model = profile(12, { height: 72, weight: 190 }, "p95");
    expect(model.summary?.metrics.find(metric => metric.key === "blast_attack_angle")?.peak).toBe(12);
    expect(hitterStudyMatches(model, [reference(1)])).toEqual({ matches: [], basis: "none", sizeFallback: false });
  });

  it("skips invalid corpus records instead of filling missing dimensions or sample counts", () => {
    const invalid: HitterStudyReference[] = [
      { ...reference(2), id: 0 }, { ...reference(3), id: NaN }, { ...reference(4), id: 1.5 },
      { ...reference(5), name: " " }, { ...reference(6), attackAngle: NaN }, { ...reference(7), attackAngle: 95 },
      { ...reference(8), heightInches: 0 }, { ...reference(9), heightInches: Infinity },
      { ...reference(10), weightLb: -1 }, { ...reference(11), weightLb: NaN },
      { ...reference(12), competitiveSwings: 0 }, { ...reference(13), competitiveSwings: Infinity }, { ...reference(14), competitiveSwings: 3.5 },
    ];
    expect(ids(hitterStudyMatches(profile(), [...invalid, reference(1)]))).toEqual([1]);
  });

  it("omits all duplicate IDs regardless of record order", () => {
    const references = [reference(1), reference(2), reference(1, 13), reference(3)];
    expect(ids(hitterStudyMatches(profile(), references))).toEqual([2, 3]);
    expect(ids(hitterStudyMatches(profile(), [...references].reverse()))).toEqual([2, 3]);
  });

  it("treats invalid body dimensions as missing instead of forcing a size fallback", () => {
    const model = profile(12, { height: 72, weight: 190 });
    for (const value of [0, -1, NaN, Infinity]) {
      const result = hitterStudyMatches({ ...model, height: { ...model.height!, value }, weight: { ...model.weight!, value } }, [reference(1)]);
      expect(result).toMatchObject({ basis: "path_only", sizeFallback: false });
      expect(ids(result)).toEqual([1]);
    }
  });

  it("is deterministic and does not mutate the profile or reference corpus", () => {
    const model = profile(12, { height: 72, weight: 190 });
    const references = [reference(12, 13, 73, 195), reference(2, 13, 73, 195), reference(4, 12, 74, 200), reference(8, 16, 72, 190)];
    const before = structuredClone({ model, references });
    const expected = ids(hitterStudyMatches(model, references));
    expect(ids(hitterStudyMatches(model, [...references].reverse()))).toEqual(expected);
    expect({ model, references }).toEqual(before);
    expect(hitterStudyMatches(model, []).basis).toBe("none");
  });

  it("can select from the source-backed default corpus without exposing a computed score", () => {
    const result = hitterStudyMatches(profile(12));
    expect(result.basis).toBe("path_only");
    expect(result.matches).toHaveLength(3);
    for (const match of result.matches) {
      expect(attackPath(match.attackAngle)?.key).toBe("rising");
      expect(Math.abs(match.attackAngle - 12)).toBeLessThanOrEqual(5);
      expect(Object.keys(match).sort()).toEqual(["attackAngle", "averageBatSpeed", "bats", "competitiveSwings", "heightInches", "id", "name", "weightLb"]);
    }
  });
});

describe("public MLB bat-speed percentiles", () => {
  const speeds = (values: (number | null)[]) => values.map((averageBatSpeed, index) => ({ ...reference(index + 1), averageBatSpeed }));

  it("uses one hitter per value, shared tied midranks, and inclusive endpoints", () => {
    const corpus = speeds([60, 70, 70, 80, 90, 100]);
    expect(proBatSpeedPercentile(corpus[0], corpus)).toEqual({ value: 0, sampleSize: 6 });
    expect(proBatSpeedPercentile(corpus[1], corpus)).toEqual({ value: 30, sampleSize: 6 });
    expect(proBatSpeedPercentile(corpus[2], corpus)).toEqual({ value: 30, sampleSize: 6 });
    expect(proBatSpeedPercentile(corpus[5], corpus)).toEqual({ value: 100, sampleSize: 6 });
  });

  it("requires at least five valid measured hitters and gives an all-tied cohort its midpoint", () => {
    const corpus = speeds([70, 70, 70, 70, 70]);
    expect(proBatSpeedPercentile(corpus[0], corpus.slice(0, 4))).toBeNull();
    expect(proBatSpeedPercentile(corpus[0], corpus)).toEqual({ value: 50, sampleSize: 5 });
  });

  it("uses the complete supplied cohort across path, size and side instead of the suggested three", () => {
    const corpus = speeds([50, 60, 70, 80, 90, 100]).map((item, index) => ({ ...item,
      attackAngle: index < 3 ? 5 : 12, heightInches: index < 3 ? 80 : 72, bats: index < 3 ? "L" as const : "R" as const,
    }));
    const selected = hitterStudyMatches(profile(), corpus, { bats: "R" }).matches;
    expect(selected).toHaveLength(3);
    expect(proBatSpeedPercentile(corpus[3], corpus)).toEqual({ value: 60, sampleSize: 6 });
    expect(proBatSpeedPercentile(corpus[3], selected)).toBeNull();
  });

  it("excludes all duplicate IDs and retains order-independent percentiles", () => {
    const corpus = speeds([60, 70, 80, 90, 100, 110]);
    const duplicated = [...corpus, { ...corpus[0], averageBatSpeed: 90 }];
    expect(proBatSpeedPercentile(corpus[0], duplicated)).toBeNull();
    expect(proBatSpeedPercentile(corpus[1], duplicated)).toEqual({ value: 0, sampleSize: 5 });
    expect(proBatSpeedPercentile(corpus[5], [...duplicated].reverse())).toEqual({ value: 100, sampleSize: 5 });
  });

  it("keeps recorded zero but excludes missing, invalid and non-member values", () => {
    const corpus = speeds([0, 60, 70, 80, 90, null, NaN, Infinity, -1]);
    expect(proBatSpeedPercentile(corpus[0], corpus)).toEqual({ value: 0, sampleSize: 5 });
    for (const reference of corpus.slice(5)) expect(proBatSpeedPercentile(reference, corpus)).toBeNull();
    expect(proBatSpeedPercentile({ ...corpus[2], averageBatSpeed: 71 }, corpus)).toBeNull();
    expect(proBatSpeedPercentile({ ...corpus[2], id: 99999 }, corpus)).toBeNull();
  });

  it("uses the source-backed default cohort without changing the records", () => {
    const target = HITTER_STUDY_REFERENCES.find(item => item.averageBatSpeed !== null)!;
    const before = structuredClone(HITTER_STUDY_REFERENCES);
    const value = proBatSpeedPercentile(target);
    expect(value?.sampleSize).toBe(226);
    expect(value?.value).toBeGreaterThanOrEqual(0);
    expect(value?.value).toBeLessThanOrEqual(100);
    expect(HITTER_STUDY_REFERENCES).toEqual(before);
  });
});

describe("handedness and recognizable study preferences", () => {
  const featuredIds = FEATURED_HITTER_STUDY_IDS.slice(0, 4);
  const sideReference = (id: number, bats: HitterStudyReference["bats"], angle = 12, height = 72, weight = 190) => ({ ...reference(id, angle, height, weight), bats });

  it.each([
    ["R", "R", true], ["R", "L", false], ["R", "S", true],
    ["L", "L", true], ["L", "R", false], ["L", "S", true],
    [" r ", "R", true], ["S", "L", true], ["S", "R", true],
    [null, "L", true], [undefined, "R", true], ["unknown", "L", true],
  ] as const)("handles own %s and professional %s side without inventing a missing side", (own, professional, compatible) => {
    expect(compatibleBattingSide(own, professional)).toBe(compatible);
  });

  it("prefers familiar eligible names while retaining the same path and angle window", () => {
    const corpus = [reference(1, 12), reference(featuredIds[0], 13), reference(featuredIds[1], 13.5), reference(featuredIds[2], 14), reference(featuredIds[3], 18)];
    expect(ids(hitterStudyMatches(profile(), corpus, { bats: "R" }))).toEqual(featuredIds.slice(0, 3));
    expect(ids(hitterStudyMatches(profile(), corpus))).toEqual([1, featuredIds[0], featuredIds[1]]);
  });

  it("uses same-side or switch hitters when three are available and opposite candidates lack an exceptional basis", () => {
    const corpus = [sideReference(featuredIds[0], "R", 14), sideReference(featuredIds[1], "R", 14.5), sideReference(featuredIds[2], "S", 15), sideReference(featuredIds[3], "L", 12)];
    const matches = hitterStudyMatches(profile(), corpus, { bats: "R" }).matches;
    expect(matches).toHaveLength(3);
    expect(matches.every(item => item.bats === "R" || item.bats === "S")).toBe(true);
  });

  it("allows opposite-side references to fill a short compatible list", () => {
    const corpus = [sideReference(featuredIds[0], "R"), sideReference(featuredIds[1], "L"), sideReference(featuredIds[2], "L")];
    const result = hitterStudyMatches(profile(), corpus, { bats: "R" });
    expect(result.matches).toHaveLength(3);
    expect(result.matches[0].bats).toBe("R");
    expect(result.matches.filter(item => item.bats === "L")).toHaveLength(2);
  });

  it("lets an exceptionally close opposite-side size example override the usual preference", () => {
    const corpus = [sideReference(featuredIds[0], "L"), ...[1, 2, 3].map(id => sideReference(id, "R", 17, 75, 220))];
    const result = hitterStudyMatches(profile(12, { height: 72, weight: 190 }), corpus, { bats: "R" });
    expect(result.matches[0].id).toBe(featuredIds[0]);
    expect(result.matches[0].bats).toBe("L");
    expect(result.matches).toHaveLength(3);
  });

  it.each([
    { angle: 14, height: 73, weight: 205, eligible: true },
    { angle: 14.00001, height: 73, weight: 205, eligible: false },
    { angle: 14, height: 73.00001, weight: 205, eligible: false },
    { angle: 14, height: 73, weight: 205.00001, eligible: false },
  ])("honors exceptional geometry boundaries $angle/$height/$weight", ({ angle, height, weight, eligible }) => {
    const corpus = [sideReference(featuredIds[0], "L", angle, height, weight), ...[1, 2, 3].map(id => sideReference(id, "R", 17, 75, 220))];
    const result = hitterStudyMatches(profile(12, { height: 72, weight: 190 }), corpus, { bats: "R" });
    expect(ids(result).includes(featuredIds[0])).toBe(eligible);
  });

  it("uses relative bat-speed rank rather than raw speed to admit an exceptional opposite-side example", () => {
    const corpus = [
      { ...sideReference(featuredIds[0], "L"), averageBatSpeed: 30 },
      { ...sideReference(1, "R", 17), averageBatSpeed: 0 },
      { ...sideReference(2, "R", 17), averageBatSpeed: 100 },
      { ...sideReference(3, "R", 17), averageBatSpeed: 40 },
      { ...sideReference(4, "L", 5), averageBatSpeed: 20 },
    ];
    expect(proBatSpeedPercentile(corpus[0], corpus)).toEqual({ value: 50, sampleSize: 5 });
    expect(hitterStudyMatches(profile(), corpus, { bats: "R", batSpeedPercentile: 50 }).matches[0].id).toBe(featuredIds[0]);
    expect(ids(hitterStudyMatches(profile(), corpus, { bats: "R" }))).not.toContain(featuredIds[0]);
  });

  it("preserves the inclusive 15-point exceptional percentile boundary", () => {
    const corpus = [
      { ...sideReference(featuredIds[0], "L"), averageBatSpeed: 30 },
      { ...sideReference(1, "R", 17, 75, 220), averageBatSpeed: 10 },
      { ...sideReference(2, "R", 17, 75, 220), averageBatSpeed: 50 },
      { ...sideReference(3, "R", 17, 75, 220), averageBatSpeed: 60 },
      { ...sideReference(4, "L", 5), averageBatSpeed: 20 },
      { ...sideReference(5, "L", 5), averageBatSpeed: 40 },
    ];
    const model = profile(12, { height: 72, weight: 190 });
    expect(proBatSpeedPercentile(corpus[0], corpus)).toEqual({ value: 40, sampleSize: 6 });
    expect(ids(hitterStudyMatches(model, corpus, { bats: "R", batSpeedPercentile: 55 }))).toContain(featuredIds[0]);
    expect(ids(hitterStudyMatches(model, corpus, { bats: "R", batSpeedPercentile: 55.00001 }))).not.toContain(featuredIds[0]);
  });

  it("lets an exceptionally close unfeatured player override recognizable names", () => {
    const corpus = [reference(1), ...featuredIds.slice(0, 3).map(id => reference(id, 15, 74, 210))];
    expect(hitterStudyMatches(profile(12, { height: 72, weight: 190 }), corpus, { bats: "R" }).matches[0].id).toBe(1);
  });

  it.each([NaN, Infinity, -1, 100.00001])("ignores invalid personal percentile preference %s", batSpeedPercentile => {
    const corpus = [reference(1), reference(featuredIds[0], 13), reference(featuredIds[1], 14)];
    expect(hitterStudyMatches(profile(), corpus, { bats: "R", batSpeedPercentile })).toEqual(hitterStudyMatches(profile(), corpus, { bats: "R", batSpeedPercentile: null }));
  });

  it("keeps preference results deterministic and input records unchanged", () => {
    const model = profile(12, { height: 72, weight: 190 });
    const corpus = [sideReference(featuredIds[0], "L"), sideReference(featuredIds[1], "R", 14), sideReference(featuredIds[2], "S", 13), sideReference(1, "R", 17, 75, 220), sideReference(2, "R", 17, 75, 220)];
    const preferences = { bats: "R", batSpeedPercentile: 50 };
    const before = structuredClone({ model, corpus, preferences });
    const result = hitterStudyMatches(model, corpus, preferences);
    expect(hitterStudyMatches(model, [...corpus].reverse(), preferences)).toEqual(result);
    expect({ model, corpus, preferences }).toEqual(before);
    expect(Object.keys(result).sort()).toEqual(["basis", "matches", "sizeFallback"]);
  });
});
