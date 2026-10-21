import { describe, expect, it } from "vitest";
import { qualifiedGameComparisons } from "@/lib/qualified-percentiles";
import type { GameComparison, GameLeaderboardRow } from "@/lib/game-metrics";

// Fictional fixtures only.
const row = (code: string, metric: string, value: number, opportunities: number | null, profileId: string | null = null, source = "qpa_fall_2026", eventId = ""): GameLeaderboardRow =>
  ({ code, name: `Example ${code}`, metric, source, eventId, playedOn: null, value, unit: metric === "qpa_pct" ? "%" : "avg", rank: 1, profileId, updatedAt: "2026-10-12T00:00:00Z", percentile: 50, sampleSize: 7, opportunities } as GameLeaderboardRow);
const comparison = (metric: string, value: number, source = "qpa_fall_2026", eventId = ""): GameComparison => ({ metric, source, eventId, value, percentile: 42, sampleSize: 7, snapshotId: "00000000-0000-4000-8000-000000000001" });
const ME = "11111111-1111-4111-8111-111111111111";
// Six qualified hitters (PA ≥ 8 for four weeks) and one with only 3 PA.
const board = [
  ...["A", "B", "C", "D", "E"].map((code, i) => row(code, "batting_ops", 0.6 + i * 0.1, 12)), row("ME", "batting_ops", 0.75, 10, ME),
  ...["A", "B", "C", "D", "E"].map(code => row(code, "qpa_pct", 50, 12)), row("ME", "qpa_pct", 50, 10, ME),
  row("LOW", "batting_ops", 2.5, 3), row("LOW", "qpa_pct", 90, 3),
];

describe("qualified-only game percentiles", () => {
  it("re-ranks among qualified players with the midrank convention, ignoring unqualified", () => {
    const [ops] = qualifiedGameComparisons([comparison("batting_ops", 0.75)], board, ME, 4);
    // Qualified OPS: .6 .7 .75 .8 .9 1.0 → two worse, no ties, n = 6 → 100 × 2 / 5.
    expect(ops).toMatchObject({ qualified: true, sampleSize: 6, percentile: 40, qualifiedMinimum: "8 PA" });
    const [qpa] = qualifiedGameComparisons([comparison("qpa_pct", 50)], board, ME, 4);
    expect(qpa.percentile).toBe(50); // six-way tie → midpoint
  });
  it("withholds an unqualified player's percentile and marks Not qualified", () => {
    const low = board.map(r => r.code === "LOW" ? { ...r, profileId: ME } : { ...r, profileId: null });
    const [ops] = qualifiedGameComparisons([comparison("batting_ops", 2.5)], low, ME, 4);
    expect(ops).toMatchObject({ qualified: false, percentile: null, qualifiedMinimum: "8 PA" });
  });
  it("needs five qualified players and the player's own matching board value", () => {
    expect(qualifiedGameComparisons([comparison("batting_ops", 0.75)], board.filter(r => !["A", "B"].includes(r.code)), ME, 4)[0].percentile).toBeNull();
    expect(qualifiedGameComparisons([comparison("batting_ops", 0.99)], board, ME, 4)[0].percentile).toBeNull();
    expect(qualifiedGameComparisons([comparison("batting_ops", 0.75)], board, "22222222-2222-4222-8222-222222222222", 4)[0].percentile).toBeNull();
  });
  it("reverses lower-is-better stats", () => {
    const whip = ["A", "B", "C", "D", "E"].map((code, i) => row(code, "pitching_whip", 1 + i * 0.2, 12, null, "pitching_fall_2026", "fall-2026-cumulative"));
    const mine = row("ME", "pitching_whip", 0.9, 12, ME, "pitching_fall_2026", "fall-2026-cumulative");
    const [c] = qualifiedGameComparisons([comparison("pitching_whip", 0.9, "pitching_fall_2026", "fall-2026-cumulative")], [...whip, mine], ME, 4);
    expect(c.percentile).toBe(100);
  });
});
