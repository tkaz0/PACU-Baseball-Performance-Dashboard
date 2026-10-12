import { describe, expect, it } from "vitest";
import { fallBallWeeksPlayed, hitterBadgeQualified, pitcherBadgeQualified } from "@/lib/game-qualification";

// Fictional fixtures only; no production data.
const pa = (n: number) => [{ source: "qpa_fall_2026", metric: "qpa_pct", opportunities: n }, { source: "qpa_fall_2026", metric: "batting_avg", opportunities: n - 1 }];

describe("badge qualification", () => {
  it("counts Fall Ball weeks with a confirmed date on or before today", () => {
    expect(fallBallWeeksPlayed("2026-09-01")).toBe(1);
    expect(fallBallWeeksPlayed("2026-09-30")).toBe(2);
    expect(fallBallWeeksPlayed("2026-10-12")).toBe(3);
  });
  it("requires 2 PA per week so far for hitting game badges", () => {
    expect(hitterBadgeQualified(pa(6), 3)).toBe(true);
    expect(hitterBadgeQualified(pa(5), 3)).toBe(false);
    expect(hitterBadgeQualified([], 3)).toBe(false);
    expect(hitterBadgeQualified([{ source: "pitching_fall_2026", metric: "pitching_whip", opportunities: 30 }], 1)).toBe(false);
  });
  it("requires 1 IP (3 outs) per week so far for pitching game badges", () => {
    const outs = (n: number) => [{ source: "pitching_fall_2026", metric: "pitching_whip", opportunities: n }];
    expect(pitcherBadgeQualified(outs(9), 3)).toBe(true);
    expect(pitcherBadgeQualified(outs(8), 3)).toBe(false);
    expect(pitcherBadgeQualified(pa(30), 1)).toBe(false);
  });
});
