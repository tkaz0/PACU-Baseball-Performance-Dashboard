import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { leaderboardGroup, initialLeaderboardSelection, visibleLeaderboardComparisons, type LeaderboardComparison, type LeaderboardRow } from "@/lib/leaderboards";
import { PLAYER_METRICS } from "@/lib/player-performance";
import { LeaderboardResults } from "@/components/leaderboard-results";
import { LeaderboardBoard } from "@/components/leaderboard-board";
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
    expect(html(key)).not.toContain('scope="col">Place</th>'); expect(html(key)).toContain("Numerical comparisons");
  });
  it("preserves precise direct values, human dates and real profile-link limits", () => {
    const output = html("max_exit_velocity"); expect(output).toContain("0.30000000000000004"); expect(output).toContain("Sep 12, 2026"); expect(output).toContain("#0"); expect(output).not.toContain('href="/athletes/'); expect(output).toContain('scope="col">Place</th>');
    expect(html("max_exit_velocity", [{ ...row, profileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }])).toContain('href="/athletes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"');
  });
  it("labels approximate derived display and retains the exact calculation", () => {
    const output = html("muscle_mass_pct", [{ ...row, value: 74.72388059701493, derived: true }]); expect(output).toContain("≈74.7"); expect(output).toContain("Exact calculated value: 74.72388059701493"); expect(output).toContain("same-report muscle and weight");
  });
  it("shows an empty state without invented results or zero-filled athletes", () => {
    const output = html("weight", []); expect(output).toContain("Results will appear after testing data is added."); expect(output).not.toContain("<table>"); expect(output).not.toContain("Fictional Player");
  });
});


describe("automatic ranking boards", () => {
  const weight: LeaderboardComparison = { metricKey: "weight", source: "renpho", unit: "lb", period: "summer_2026", athleteCount: 20 };
  it("prioritizes Fall without blending earlier readings or source/unit cohorts", () => {
    const options: LeaderboardComparison[] = [weight,
      { ...weight, period: "fall_2026", athleteCount: 2 },
      { ...weight, period: "fall_2026", unit: "kg", source: "protocol b", athleteCount: 3 },
      { ...weight, metricKey: "max_exit_velocity", period: "fall_2026", unit: "mph", athleteCount: 9 },
    ];
    expect(visibleLeaderboardComparisons("physicality", options)).toEqual([options[2]]);
    expect(visibleLeaderboardComparisons("hitting", options)).toEqual([options[3]]);
    expect(options[0]).toEqual(weight);
  });
  it("breaks ties consistently and keeps earlier body data visible when Fall is absent", () => {
    const options = [{ ...weight, source: "z source" }, { ...weight, unit: "kg", source: "a source" }, weight];
    expect(visibleLeaderboardComparisons("physicality", options)).toEqual([weight]);
    expect(visibleLeaderboardComparisons("physicality", options.toReversed())).toEqual([weight]);
  });
  it("never shows earlier baseball tests, empty options or unsupported units", () => {
    expect(visibleLeaderboardComparisons("hitting", [{ ...weight, metricKey: "max_exit_velocity", unit: "mph" }])).toEqual([]);
    expect(visibleLeaderboardComparisons("physicality", [{ ...weight, athleteCount: 0 }, { ...weight, unit: "mph" }])).toEqual([]);
  });
  it("renders rankings and category navigation without filtering controls", () => {
    const output = renderToStaticMarkup(createElement(LeaderboardBoard, { group: "physicality", panels: [{ comparison: weight, rows: [{ ...row, source: "renpho", value: 180, measuredAt: "2026-08-09" }] }] }));
    expect(output).toContain('aria-label="Leaderboard group"');
    expect(output).toContain('href="/leaderboards?group=hitting"');
    expect(output).toContain("Last Tested Aug 9, 2026");
    expect(output).toContain("RENPHO");
    expect(output).toContain("Awaiting Testing");
    for (const unwanted of ["<form", "<select", "Show Results", "summer baseline"]) expect(output).not.toContain(unwanted);
    expect(output).toContain("<details");
  });
  it("keeps an empty category clear without ranks or zero-filled player results", () => {
    const output = renderToStaticMarkup(createElement(LeaderboardBoard, { group: "hitting", panels: [] }));
    expect(output).toContain("No Hitting Results Yet");
    expect(output).toContain("Max Exit Velocity");
    expect(output).not.toContain("<table");
    expect(output).not.toContain("Fictional Player");
  });
  it.each([[71, "in"], [180.34, "cm"]])("displays height in feet and inches while retaining the source value", (value, unit) => {
    const output = renderToStaticMarkup(createElement(LeaderboardResults, { metric: PLAYER_METRICS.find(metric => metric.key === "height")!, rows: [{ ...row, value }], unit }));
    expect(output).toContain("5′ 11″");
    expect(output).toContain(`Recorded: ${value} ${unit}`);
    expect(output).not.toContain('scope="col">Place</th>');
  });
  it("keeps every measured athlete available after the first ten", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({ ...row, athleteCode: `SYN-${String(index + 1).padStart(3, "0")}`, name: `Fictional Player ${index + 1}`, rank: index + 1, value: 100 - index }));
    const output = html("max_exit_velocity", rows);
    expect(output).toContain("Show 2 More");
    expect(output).toContain("Fictional Player 12");
    expect(output.match(/<table>/g)).toHaveLength(2);
  });
});
