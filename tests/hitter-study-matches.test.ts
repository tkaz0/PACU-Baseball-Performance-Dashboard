import { describe, expect, it } from "vitest";
import { blastSource, type BlastSummaryKind } from "@/lib/blast-metrics";
import { compatibleBattingSide, hitterStudyMatches, HITTER_STUDY_WINDOWS, proBatSpeedPercentile, proBodyPercentile } from "@/lib/hitter-study-matches";
import { HITTER_STUDY_REFERENCES, type HitterStudyReference } from "@/lib/hitter-study-references";
import { FEATURED_HITTER_STUDY_IDS } from "@/lib/hitter-study-featured";
import { attackPath, hitterSwingProfile } from "@/lib/hitter-swing-profile";
import type { Measurement } from "@/lib/imports/engine";
import { getPlayerPerformance } from "@/lib/player-performance";

const id = (index: number) => FEATURED_HITTER_STUDY_IDS[index - 1];
const reference = (index: number, attackAngle = 12, heightInches = 72, weightLb = 190): HitterStudyReference =>
  ({ id: id(index), name: `Fictional Study Hitter ${index}`, bats: "R", attackAngle, averageBatSpeed: null, heightInches, weightLb, competitiveSwings: 600 });
const right = { bats: "R" };
function profile(angle = 12, size: { height?: number; weight?: number; heightRank?: number; weightRank?: number } = {}, kind: BlastSummaryKind = "average") {
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
  return { ...hitterSwingProfile(readings, getPlayerPerformance({ readings: body, athleteCode: "SYN-STUDY-001" })),
    heightRank: size.heightRank === undefined ? null : { value: size.heightRank, sampleSize: 10 },
    weightRank: size.weightRank === undefined ? null : { value: size.weightRank, sampleSize: 10 },
  };
}
const ids = (result: ReturnType<typeof hitterStudyMatches>) => result.matches.map(match => match.id);
const bodyCorpus = () => [68, 70, 72, 74, 76].map((height, index) => reference(index + 1, 12, height, 140 + index * 20));

describe("same-side recognizable MLB study examples", () => {
  it("requires the same custom path and an inclusive five-degree angle window", () => {
    const result = hitterStudyMatches(profile(15), [reference(1, 10), reference(2, 19.999), reference(3, 9.999), reference(4, 20)], right);
    expect(ids(result)).toEqual([id(2), id(1)]);
    expect(result).toMatchObject({ basis: "path_only", sizeFallback: false });
    expect(ids(hitterStudyMatches(profile(10), [reference(1, 15), reference(2, 15.00001), reference(3, 9.99999)], right))).toEqual([id(1)]);
    expect(HITTER_STUDY_WINDOWS).toEqual({ attackAngle: 5, percentile: 25 });
  });

  it("limits candidates to the 75 curated verified names without limiting rank denominators", () => {
    expect(FEATURED_HITTER_STUDY_IDS).toHaveLength(75);
    expect(new Set(FEATURED_HITTER_STUDY_IDS).size).toBe(75);
    expect(FEATURED_HITTER_STUDY_IDS.every(featuredId => HITTER_STUDY_REFERENCES.some(item => item.id === featuredId))).toBe(true);
    const corpus = [{ ...reference(1), id: 1 }, reference(2, 13), reference(3, 14), reference(4, 15)];
    expect(ids(hitterStudyMatches(profile(), corpus, right))).toEqual([id(2), id(3), id(4)]);
  });

  it.each([
    ["R", "R", true], ["R", "L", false], ["R", "S", false],
    ["L", "L", true], ["L", "R", false], ["L", "S", false],
    ["S", "S", true], ["S", "R", false], ["S", "L", false],
    [" r ", "R", true], [null, "L", false], [undefined, "R", false], ["unknown", "L", false], ["R", null, false],
  ] as const)("keeps own %s and professional %s batting sides exact", (own, professional, compatible) => {
    expect(compatibleBattingSide(own, professional)).toBe(compatible);
  });

  it("never pads short lists with opposite-side or pooled switch-hitter references", () => {
    const corpus = [reference(1, 16), { ...reference(2), bats: "L" as const }, { ...reference(3), bats: "S" as const }];
    expect(ids(hitterStudyMatches(profile(12, { height: 72, weight: 190, heightRank: 50, weightRank: 50 }), corpus, { bats: "R", batSpeedPercentile: 50 }))).toEqual([id(1)]);
    expect(ids(hitterStudyMatches(profile(), corpus, { bats: "L" }))).toEqual([id(2)]);
    expect(ids(hitterStudyMatches(profile(), corpus, { bats: "S" }))).toEqual([id(3)]);
  });

  it.each([undefined, null, "", "unknown"])("withholds examples until the player's batting side is known: %s", bats => {
    expect(hitterStudyMatches(profile(), [reference(1)], { bats })).toEqual({ matches: [], basis: "none", sizeFallback: false });
  });
  it("does not silently infer a side when preferences are omitted", () => {
    expect(hitterStudyMatches(profile(), [reference(1)])).toEqual({ matches: [], basis: "none", sizeFallback: false });
  });

  it("uses relative height rank rather than an absolute inch window", () => {
    const corpus = bodyCorpus();
    const result = hitterStudyMatches(profile(12, { height: 65, heightRank: 100 }), corpus, right);
    expect(ids(result)).toEqual([id(5), id(4), id(3)]);
    expect(result.basis).toBe("path_and_height");
    expect(result.sizeFallback).toBe(false);
  });

  it("uses relative weight rank rather than an absolute pound window", () => {
    const result = hitterStudyMatches(profile(12, { weight: 135, weightRank: 100 }), bodyCorpus(), right);
    expect(ids(result)).toEqual([id(5), id(4), id(3)]);
    expect(result.basis).toBe("path_and_weight");
  });

  it("uses both available body ranks and the normalized angle gap", () => {
    const corpus = bodyCorpus().map((item, index) => index === 2 ? { ...item, attackAngle: 14 } : item);
    const result = hitterStudyMatches(profile(12, { height: 65, weight: 135, heightRank: 50, weightRank: 50 }), corpus, right);
    expect(result.matches[0]).toBe(corpus[2]);
    expect(result.basis).toBe("path_and_size");
    expect(result.matches).toHaveLength(3);
  });

  it("keeps relative bat-speed fit independent of raw practice mph", () => {
    const corpus = bodyCorpus().map((item, index) => ({ ...item, averageBatSpeed: 65 + index * 5 }));
    const model = { ...profile(), averageBatSpeed: 40 };
    const preferences = { bats: "R", batSpeedPercentile: 100 };
    expect(ids(hitterStudyMatches(model, corpus, preferences))).toEqual([id(5), id(4), id(3)]);
    expect(hitterStudyMatches({ ...model, averageBatSpeed: 100 }, corpus, preferences)).toEqual(hitterStudyMatches(model, corpus, preferences));
  });

  it("withholds missing ranks rather than falling back to absolute body matching", () => {
    const corpus = bodyCorpus();
    const expected = hitterStudyMatches(profile(), corpus, right);
    expect(hitterStudyMatches(profile(12, { height: 76, weight: 220 }), corpus, right)).toEqual(expected);
    expect(hitterStudyMatches(profile(12, { heightRank: 100, weightRank: 100 }), corpus, right)).toEqual(expected);
    expect(expected.basis).toBe("path_only");
  });

  it("does not use body ranks when the complete MLB cohort has fewer than five references", () => {
    const corpus = bodyCorpus().slice(0, 4);
    const result = hitterStudyMatches(profile(12, { height: 65, weight: 135, heightRank: 100, weightRank: 100 }), corpus, right);
    expect(result).toEqual(hitterStudyMatches(profile(), corpus, right));
    expect(result.basis).toBe("path_only");
  });

  it.each([null, { value: NaN, sampleSize: 10 }, { value: Infinity, sampleSize: 10 }, { value: -1, sampleSize: 10 }, { value: 101, sampleSize: 10 }, { value: 50, sampleSize: 4 }, { value: 50, sampleSize: 5.5 }])("ignores invalid or unavailable Pacific body ranks %j", rank => {
    const model = profile(12, { height: 70, weight: 160 });
    expect(hitterStudyMatches({ ...model, heightRank: rank, weightRank: rank }, bodyCorpus(), right)).toEqual(hitterStudyMatches(model, bodyCorpus(), right));
  });

  it.each([0, -1, NaN, Infinity])("does not attach a valid rank to an invalid own body measurement %s", value => {
    const model = profile(12, { height: 70, weight: 160, heightRank: 100, weightRank: 100 });
    const result = hitterStudyMatches({ ...model, height: { ...model.height!, value }, weight: { ...model.weight!, value } }, bodyCorpus(), right);
    expect(result).toEqual(hitterStudyMatches(profile(), bodyCorpus(), right));
  });

  it.each([NaN, Infinity, -1, 100.00001])("ignores invalid bat-speed percentile %s", batSpeedPercentile => {
    const corpus = bodyCorpus().map((item, index) => ({ ...item, averageBatSpeed: 65 + index * 5 }));
    expect(hitterStudyMatches(profile(), corpus, { bats: "R", batSpeedPercentile })).toEqual(hitterStudyMatches(profile(), corpus, right));
  });

  it("does not infer professional VBA or body tilt from attack angle", () => {
    const model = profile();
    expect(hitterStudyMatches({ ...model, verticalBatAngle: -20, bodyTiltAngle: 10 }, bodyCorpus(), right)).toEqual(
      hitterStudyMatches({ ...model, verticalBatAngle: -60, bodyTiltAngle: 50 }, bodyCorpus(), right));
  });

  it.each([-5, 25])("does not force a different-path fallback for unsupported %s-degree paths", angle => {
    expect(hitterStudyMatches(profile(angle), [reference(1, 2), reference(2, 18)], right)).toEqual({ matches: [], basis: "none", sizeFallback: false });
  });
  it("preserves signed and zero angle references", () => {
    expect(ids(hitterStudyMatches(profile(-5), [reference(1, -6), reference(2, 1)], right))).toEqual([id(1)]);
    expect(ids(hitterStudyMatches(profile(0), [reference(1, 0), reference(2, -0.01)], right))).toEqual([id(1)]);
  });
  it.each([null, NaN, Infinity, -Infinity, 90.001, -90.001])("returns no examples for unavailable angle %s", angle => {
    const model = { ...profile(), attackAngle: angle, path: attackPath(angle) };
    expect(hitterStudyMatches(model, [reference(1)], right)).toEqual({ matches: [], basis: "none", sizeFallback: false });
  });
  it("rejects mismatched paths, source-review issues and P95-only reports", () => {
    const model = profile();
    for (const invalid of [{ ...model, path: null }, { ...model, path: attackPath(5) }, { ...model, summary: { ...model.summary!, issues: ["overlapping_periods" as const] } }, profile(12, {}, "p95")]) {
      expect(hitterStudyMatches(invalid, [reference(1)], right).basis).toBe("none");
    }
  });

  it("skips invalid reference records and every occurrence of a duplicate ID", () => {
    const invalid: HitterStudyReference[] = [
      { ...reference(2), id: 0 }, { ...reference(3), id: NaN }, { ...reference(4), id: 1.5 },
      { ...reference(5), name: " " }, { ...reference(6), attackAngle: NaN }, { ...reference(7), attackAngle: 95 },
      { ...reference(8), heightInches: 0 }, { ...reference(9), heightInches: Infinity },
      { ...reference(10), weightLb: -1 }, { ...reference(11), weightLb: NaN },
      { ...reference(12), competitiveSwings: 0 }, { ...reference(13), competitiveSwings: Infinity }, { ...reference(14), competitiveSwings: 3.5 },
    ];
    expect(ids(hitterStudyMatches(profile(), [...invalid, reference(1)], right))).toEqual([id(1)]);
    const duplicated = [reference(1), reference(2), reference(1, 13), reference(3)];
    const expected = [id(2), id(3)].sort((a, b) => a - b);
    expect(ids(hitterStudyMatches(profile(), duplicated, right))).toEqual(expected);
    expect(ids(hitterStudyMatches(profile(), [...duplicated].reverse(), right))).toEqual(expected);
  });

  it("keeps deterministic ties, caps three examples, and never mutates or exposes a computed score", () => {
    const model = profile(12, { height: 70, weight: 160, heightRank: 50, weightRank: 50 });
    const corpus = bodyCorpus().map(item => ({ ...item, heightInches: 72, weightLb: 190 }));
    const preferences = { bats: "R", batSpeedPercentile: 50 };
    const before = structuredClone({ model, corpus, preferences });
    const result = hitterStudyMatches(model, corpus, preferences);
    expect(ids(result)).toEqual(corpus.map(item => item.id).sort((a, b) => a - b).slice(0, 3));
    expect(hitterStudyMatches(model, [...corpus].reverse(), preferences)).toEqual(result);
    expect({ model, corpus, preferences }).toEqual(before);
    expect(Object.keys(result).sort()).toEqual(["basis", "matches", "sizeFallback"]);
    expect(result.matches[0]).toBe(corpus.find(item => item.id === result.matches[0].id));
  });

  it.each(["R", "L", "S"])("selects only curated %s hitters from the source-backed default corpus", bats => {
    const result = hitterStudyMatches(profile(12), undefined, { bats });
    expect(result.basis).toBe("path_only");
    expect(result.matches).toHaveLength(3);
    for (const match of result.matches) {
      expect(match.bats).toBe(bats); expect(FEATURED_HITTER_STUDY_IDS).toContain(match.id);
      expect(attackPath(match.attackAngle)?.key).toBe("rising");
      expect(Math.abs(match.attackAngle - 12)).toBeLessThanOrEqual(5);
      expect(Object.keys(match).sort()).toEqual(["attackAngle", "averageBatSpeed", "bats", "competitiveSwings", "heightInches", "id", "name", "weightLb"]);
    }
  });
});

describe("public MLB relative ranks", () => {
  it.each(["height", "weight"] as const)("gives tied %s neutral ranks, complete endpoints and a five-person minimum", dimension => {
    const corpus = [60, 70, 70, 80, 90, 100].map((value, index) => ({ ...reference(index + 1), [dimension === "height" ? "heightInches" : "weightLb"]: value }));
    expect(proBodyPercentile(corpus[0], dimension, corpus)).toEqual({ value: 0, sampleSize: 6 });
    expect(proBodyPercentile(corpus[1], dimension, corpus)).toEqual({ value: 30, sampleSize: 6 });
    expect(proBodyPercentile(corpus[2], dimension, corpus)).toEqual({ value: 30, sampleSize: 6 });
    expect(proBodyPercentile(corpus[5], dimension, corpus)).toEqual({ value: 100, sampleSize: 6 });
    expect(proBodyPercentile(corpus[0], dimension, corpus.slice(0, 4))).toBeNull();
    const tied = corpus.slice(0, 5).map(item => ({ ...item, heightInches: 72, weightLb: 190 }));
    expect(proBodyPercentile(tied[0], dimension, tied)).toEqual({ value: 50, sampleSize: 5 });
  });

  it("uses the full population across batting sides, paths and unfeatured names", () => {
    const corpus = bodyCorpus().map((item, index) => ({ ...item, averageBatSpeed: 50 + index * 10,
      ...(index < 2 ? { id: index + 1, attackAngle: 5, bats: "L" as const } : {}),
    }));
    const selected = hitterStudyMatches(profile(), corpus, right).matches;
    expect(selected).toHaveLength(3);
    expect(proBodyPercentile(corpus[2], "height", corpus)).toEqual({ value: 50, sampleSize: 5 });
    expect(proBodyPercentile(corpus[2], "weight", corpus)).toEqual({ value: 50, sampleSize: 5 });
    expect(proBatSpeedPercentile(corpus[2], corpus)).toEqual({ value: 50, sampleSize: 5 });
    expect(proBodyPercentile(corpus[2], "height", selected)).toBeNull();
  });

  it("omits duplicated IDs from all relative ranks and keeps order-independent results", () => {
    const corpus = [...bodyCorpus(), reference(6, 12, 78, 240)].map((item, index) => ({ ...item, averageBatSpeed: 60 + index * 10 }));
    const duplicated = [...corpus, { ...corpus[0], heightInches: 90, weightLb: 400, averageBatSpeed: 90 }];
    for (const dimension of ["height", "weight"] as const) {
      expect(proBodyPercentile(corpus[0], dimension, duplicated)).toBeNull();
      expect(proBodyPercentile(corpus[1], dimension, duplicated)).toEqual({ value: 0, sampleSize: 5 });
      expect(proBodyPercentile(corpus[5], dimension, [...duplicated].reverse())).toEqual({ value: 100, sampleSize: 5 });
    }
    expect(proBatSpeedPercentile(corpus[0], duplicated)).toBeNull();
    expect(proBatSpeedPercentile(corpus[1], duplicated)).toEqual({ value: 0, sampleSize: 5 });
  });

  it("rejects absent, changed or invalid reference values without inventing measurements", () => {
    const corpus = bodyCorpus();
    for (const dimension of ["height", "weight"] as const) {
      const key = dimension === "height" ? "heightInches" : "weightLb";
      for (const value of [0, -1, NaN, Infinity]) expect(proBodyPercentile({ ...corpus[0], [key]: value }, dimension, corpus)).toBeNull();
      expect(proBodyPercentile({ ...corpus[0], [key]: corpus[0][key] + 1 }, dimension, corpus)).toBeNull();
      expect(proBodyPercentile({ ...corpus[0], id: 999999 }, dimension, corpus)).toBeNull();
    }
  });

  it("preserves speed zero, tied midranks and incomplete speed cohorts", () => {
    const corpus = [0, 70, 70, 80, 90, 100, null, NaN, Infinity, -1].map((averageBatSpeed, index) => ({ ...reference(index + 1), averageBatSpeed }));
    expect(proBatSpeedPercentile(corpus[0], corpus)).toEqual({ value: 0, sampleSize: 6 });
    expect(proBatSpeedPercentile(corpus[1], corpus)).toEqual({ value: 30, sampleSize: 6 });
    expect(proBatSpeedPercentile(corpus[2], corpus)).toEqual({ value: 30, sampleSize: 6 });
    expect(proBatSpeedPercentile(corpus[5], corpus)).toEqual({ value: 100, sampleSize: 6 });
    expect(proBatSpeedPercentile(corpus[0], corpus.slice(0, 4))).toBeNull();
    for (const item of corpus.slice(6)) expect(proBatSpeedPercentile(item, corpus)).toBeNull();
    expect(proBatSpeedPercentile({ ...corpus[1], averageBatSpeed: 71 }, corpus)).toBeNull();
    const tied = corpus.slice(0, 5).map(item => ({ ...item, averageBatSpeed: 70 }));
    expect(proBatSpeedPercentile(tied[0], tied)).toEqual({ value: 50, sampleSize: 5 });
  });

  it("uses the complete 226-player official source corpus without changing records", () => {
    const target = HITTER_STUDY_REFERENCES.find(item => item.averageBatSpeed !== null)!;
    const before = structuredClone(HITTER_STUDY_REFERENCES);
    for (const result of [proBatSpeedPercentile(target), proBodyPercentile(target, "height"), proBodyPercentile(target, "weight")]) {
      expect(result?.sampleSize).toBe(226); expect(result?.value).toBeGreaterThanOrEqual(0); expect(result?.value).toBeLessThanOrEqual(100);
    }
    expect(HITTER_STUDY_REFERENCES).toEqual(before);
  });
});
