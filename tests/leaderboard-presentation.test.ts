import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { leaderboardGroup, initialLeaderboardSelection, type LeaderboardComparison, type LeaderboardRow } from "@/lib/leaderboards";
import { PLAYER_METRICS } from "@/lib/player-performance";
import { LeaderboardResults } from "@/components/leaderboard-results";
const row: LeaderboardRow = { rank: 1, athleteCode: "SYN-001", name: "Fictional Player", jerseyNumber: 0, position: "P", profileId: null, value: 0.30000000000000004, measuredAt: "2026-09-12", source: "fictional source", derived: false };
const html = (key: string, rows: LeaderboardRow[] = [row]) => renderToStaticMarkup(createElement(LeaderboardResults, { metric: PLAYER_METRICS.find(metric => metric.key === key)!, rows, unit: "mph" }));
describe("leaderboard presentation and truthful comparisons", () => {
  it("puts timings in Physicality and field/throwing metrics in Throwing", () => {
    for (const key of ["grip_strength", "home_to_first", "boxer_t"]) expect(leaderboardGroup(PLAYER_METRICS.find(metric => metric.key === key)!)).toBe("physicality");
    for (const key of ["infield_velocity", "outfield_velocity", "max_pitch_velocity"]) expect(leaderboardGroup(PLAYER_METRICS.find(metric => metric.key === key)!)).toBe("throwing");
  });
  it("defaults to Fall and keeps the summer selection for eligible body metrics only", () => {
    const options: LeaderboardComparison[] = [{ metricKey: "weight", source: "renpho", unit: "lb", period: "summer_2026", athleteCount: 1 }];
    expect(initialLeaderboardSelection("physicality", options, {}).period).toBe("fall_2026");
    expect(initialLeaderboardSelection("physicality", options, { metric: "weight", period: "summer_2026" })).toMatchObject({ metricKey: "weight", period: "summer_2026", source: "renpho" });
    expect(initialLeaderboardSelection("physicality", options, { metric: "home_to_first", period: "summer_2026" }).period).toBe("fall_2026");
  });
  it.each(["weight", "body_fat_pct", "height", "muscle_mass_pct", "avg_fastball_spin"])("does not display competitive places for neutral %s", key => {
    expect(html(key)).not.toContain("<th>Place</th>"); expect(html(key)).toContain("numerical comparisons");
  });
  it("preserves precise direct values, human dates and real profile-link limits", () => {
    const output = html("max_exit_velocity"); expect(output).toContain("0.30000000000000004"); expect(output).toContain("Sep 12, 2026"); expect(output).toContain("#0"); expect(output).not.toContain('href="/athletes/'); expect(output).toContain("<th>Place</th>");
    expect(html("max_exit_velocity", [{ ...row, profileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }])).toContain('href="/athletes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"');
  });
  it("labels approximate derived display and retains the exact calculation", () => {
    const output = html("muscle_mass_pct", [{ ...row, value: 74.72388059701493, derived: true }]); expect(output).toContain("≈74.7"); expect(output).toContain("Exact calculated value: 74.72388059701493"); expect(output).toContain("same-report muscle and weight");
  });
  it("shows an empty state without invented results or zero-filled athletes", () => {
    const output = html("weight", []); expect(output).toContain("No Reviewed Results Yet"); expect(output).not.toContain("<table>"); expect(output).not.toContain("Fictional Player");
  });
});
