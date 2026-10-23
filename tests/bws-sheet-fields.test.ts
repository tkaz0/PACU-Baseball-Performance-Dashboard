import { describe, expect, it } from "vitest";
import { emptyBwsPlan, validateBwsPlan } from "@/lib/bws-team";

// Fictional ids and counts only.
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
const line = { athleteId: A, enteredOn: "2026-10-23", pitches: 60, strikes: 30, fb: 30, fbStrikes: 18, bb: 25, bbStrikes: 10, ch: 5, chStrikes: 2, outs: 12, hits: 3, runs: 2, walks: 3, hbp: 0, strikeouts: 4 };
const withSeries = (extra: Record<string, unknown>) => { const plan = emptyBwsPlan(); return { ...plan, series: { ...plan.series, ...extra } }; };

describe("BWS dugout sheet fields", () => {
  it("accepts pitcher-only hides and confirmed sheet lines, and keeps older plans valid", () => {
    expect(validateBwsPlan(withSeries({ hiddenPitchers: [B], sheetPitchers: [line] })).series).toMatchObject({ hiddenPitchers: [B], sheetPitchers: [line] });
    expect(validateBwsPlan(emptyBwsPlan()).series.sheetPitchers).toBeUndefined();
  });
  it("rejects inconsistent counts, extra keys and duplicates", () => {
    for (const bad of [{ ...line, strikes: 61 }, { ...line, fbStrikes: 31 }, { ...line, fb: 40 }, { ...line, outs: -1 }, { ...line, note: "x" }, { ...line, enteredOn: "10/23" }])
      expect(() => validateBwsPlan(withSeries({ sheetPitchers: [bad] }))).toThrow();
    expect(() => validateBwsPlan(withSeries({ sheetPitchers: [line, line] }))).toThrow();
    expect(() => validateBwsPlan(withSeries({ hiddenPitchers: ["not-a-uuid"] }))).toThrow();
  });
});
