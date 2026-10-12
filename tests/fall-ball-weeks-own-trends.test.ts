import { describe, expect, it } from "vitest";
import { DEFAULT_FALL_BALL_WEEK_DATES, fallBallWeekDate, fallBallWeekThrough, setFallBallWeekDates } from "@/lib/game-weeks";
import { fallBallWeeksPlayed } from "@/lib/game-qualification";
import { teamGameTrends, type GameSnapshotRow } from "@/lib/game-trends";

// Fictional fixtures only; no production data.
describe("staff-saved Fall Ball week dates", () => {
  it("apply to week names, game-week mapping and qualified week counts", () => {
    setFallBallWeekDates({ ...DEFAULT_FALL_BALL_WEEK_DATES, 4: "2026-10-24" });
    expect(fallBallWeekDate(4)).toBe("October 24th");
    expect(fallBallWeekThrough("2026-10-26")).toEqual({ week: 4, date: "2026-10-24" });
    expect(fallBallWeeksPlayed("2026-10-26")).toBe(4);
    setFallBallWeekDates({ 1: "not-a-date" });
    expect(fallBallWeekDate(4)).toBe("October 24th");
    setFallBallWeekDates(DEFAULT_FALL_BALL_WEEK_DATES);
    expect(fallBallWeekDate(4)).toBeNull();
  });
});

describe("own-player trends", () => {
  it("rebuild a single player's rates from their own saved sheet versions", () => {
    const snap = (id: string, at: string, pa: number, qpa: number): GameSnapshotRow => ({ id, source: "qpa_fall_2026", fetched_at: at,
      observations: [["pa", pa], ["qpa", qpa], ["qpa_pct", 100 * qpa / pa]].map(([metric, value]) => ({ athleteCode: "SYN-1", metric, value, unit: metric === "qpa_pct" ? "%" : "count", scope: "cumulative_fall" })) });
    const trends = teamGameTrends([snap("a", "2026-10-05T16:00:00Z", 10, 5), snap("b", "2026-10-12T16:00:00Z", 20, 14)]);
    expect(trends.snapshotDates?.qpa_fall_2026).toEqual(["2026-10-05", "2026-10-12"]);
    expect(trends.qpa_fall_2026?.qpa_pct?.map(p => p.value)).toEqual([50, 70]);
  });
});
