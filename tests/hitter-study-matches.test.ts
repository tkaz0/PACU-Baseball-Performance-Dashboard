import { describe, expect, it } from "vitest";
import { blastSource, type BlastSummaryKind } from "@/lib/blast-metrics";
import { hitterStudyMatches, HITTER_STUDY_WINDOWS } from "@/lib/hitter-study-matches";
import type { HitterStudyReference } from "@/lib/hitter-study-references";
import { attackPath, hitterSwingProfile } from "@/lib/hitter-swing-profile";
import type { Measurement } from "@/lib/imports/engine";
import { getPlayerPerformance } from "@/lib/player-performance";

const reference = (id: number, attackAngle = 12, heightInches = 72, weightLb = 190): HitterStudyReference =>
  ({ id, name: `Fictional Study Hitter ${id}`, attackAngle, averageBatSpeed: null, heightInches, weightLb, competitiveSwings: 600 });

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
      expect(Object.keys(match).sort()).toEqual(["attackAngle", "averageBatSpeed", "competitiveSwings", "heightInches", "id", "name", "weightLb"]);
    }
  });
});
