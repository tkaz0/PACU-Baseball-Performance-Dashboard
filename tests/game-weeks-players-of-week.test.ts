import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { gameWeeks } from "@/lib/game-weeks";
import { playersOfTheWeek } from "@/lib/home-spotlight";
import { HomeSpotlight } from "@/components/home-spotlight";
import { WeeklyGameTrend } from "@/components/weekly-game-trend";
import type { GameSnapshotRow } from "@/lib/game-trends";
import type { CoachingPlayer } from "@/lib/coaching-tools";

// Fictional fixtures only; no production data.
const players: CoachingPlayer[] = Array.from({ length: 6 }, (_, i) => ({ id: `fictional-${i}`, code: `SYN-${i}`, name: `Fictional Player ${i + 1}`, position: "SS", secondaryPosition: "P", playerType: "two_way", academicClass: "Junior", bats: "R", throws: "R" }));
const hitting = (pa: number, h: number, bb: number, qpa: number, xbh = 0) => ({ pa, ab: pa - bb, base_hit: h, hh_extra_base_hit: xbh, pumps: 0, bb, hbp: 0, sac_fly: 0, sac_bunt: 0, punchies: 1, qpa, sb: 0, gdp: 0 });
const qpa = (id: string, at: string, lines: Record<string, Record<string, number>>): GameSnapshotRow => ({ id, source: "qpa_fall_2026", fetched_at: at,
  observations: Object.entries(lines).flatMap(([code, line]) => Object.entries(line).map(([metric, value]) => ({ athleteCode: code, metric, value, unit: "count", scope: "cumulative_fall" }))) });
const pitch = (id: string, at: string, weeks: Record<string, Record<string, Record<string, number>>>): GameSnapshotRow => ({ id, source: "pitching_fall_2026", fetched_at: at,
  observations: Object.entries(weeks).flatMap(([eventId, lines]) => Object.entries(lines).flatMap(([code, line]) => Object.entries(line).map(([metric, value]) => ({ athleteCode: code, metric, value, unit: metric === "strike_pct" ? "%" : "count", scope: "pitching_event", eventId })))) });
const pitchLine = (outs: number, h: number, bb: number, k: number, r: number) => ({ innings_outs: outs, h, bb_outcome: bb, k, r, hbp: 0, pitches: 60, strikes: 40, strike_pct: 66.7 });

const week1 = Object.fromEntries(players.map((p, i) => [p.code, hitting(10, 2 + i % 3, 1, 5 + i % 4)]));
const week2Totals = Object.fromEntries(players.map((p, i) => [p.code, Object.fromEntries(Object.entries(week1[p.code]).map(([k, v]) => [k, v + (k === "pa" ? 10 : k === "base_hit" ? (i === 3 ? 6 : 1) : k === "ab" ? 9 : k === "qpa" ? (i === 3 ? 9 : 4) : k === "bb" ? 1 : 0)]))]));
const snapshots = [
  qpa("q1", "2026-09-12T22:00:00Z", week1),
  qpa("q2", "2026-10-04T18:00:00Z", week1), // same batch as the next day; only the final version counts
  qpa("q3", "2026-10-05T16:00:00Z", week2Totals),
  pitch("p1", "2026-09-29T04:00:00Z", {
    "fall-2026-week-1": Object.fromEntries(players.map((p, i) => [p.code, pitchLine(9, 3 + i, 1 + (i % 2), 3 + i, i)])),
    "fall-2026-week-2": Object.fromEntries(players.map((p, i) => [p.code, pitchLine(9, 8 - i, 1, 2 + i, 5 - i)])),
  }),
];

describe("game weeks", () => {
  it("uses weekly pitching blocks and differences consecutive QPA update batches", () => {
    const weeks = gameWeeks(snapshots);
    expect(weeks.pitching.map(week => week.week)).toEqual([1, 2]);
    expect(weeks.hitting.map(week => [week.week, week.detail])).toEqual([[1, "Sheet changes saved Sep 12"], [2, "Sheet changes saved Oct 4–Oct 5"]]);
    const pa = weeks.hitting[1].rows.filter(row => row.metric === "pa").map(row => row.value);
    expect(new Set(pa)).toEqual(new Set([10]));
    const qpaPct = weeks.hitting[1].rows.find(row => row.athlete_id === "SYN-3" && row.metric === "qpa_pct")!.value;
    expect(qpaPct).toBe(90);
  });
  it("withholds a player whose count went down instead of clipping it", () => {
    const lowered = { ...week2Totals, "SYN-0": { ...week2Totals["SYN-0"], base_hit: 0 } };
    const weeks = gameWeeks([snapshots[0], qpa("q3", "2026-10-05T16:00:00Z", lowered)]);
    expect(weeks.hitting[1].withheld).toBe(1);
    expect(weeks.hitting[1].rows.some(row => row.athlete_id === "SYN-0")).toBe(false);
  });
});

describe("players of the week", () => {
  it("features the newest week's hitter and pitcher and keeps earlier weeks", () => {
    const weeks = playersOfTheWeek(players, gameWeeks(snapshots));
    expect(weeks.map(week => week.week)).toEqual([2, 1]);
    expect(weeks[0].hitting?.name).toBe("Fictional Player 4");
    expect(weeks[0].pitching?.name).toBe("Fictional Player 6");
    expect(weeks[1].pitching?.name).toBe("Fictional Player 1");
    const html = renderToStaticMarkup(createElement(HomeSpotlight, { weeks }));
    expect(html).toContain("Hitter of the Week");
    expect(html).toContain("Pitcher of the Week");
    expect(html).toContain("Earlier Weeks");
    expect(html).not.toContain("Practice Standout");
  });
  it("shows nothing without five complete weekly lines", () => {
    const few = players.slice(0, 4);
    expect(playersOfTheWeek(few, gameWeeks(snapshots))).toEqual([]);
  });
});

describe("weekly profile trend", () => {
  it("renders one column per week from that week's counts", () => {
    const weeks = gameWeeks(snapshots);
    const own = { hitting: weeks.hitting.map(w => ({ ...w, rows: w.rows.filter(r => r.athlete_id === "SYN-3") })), pitching: weeks.pitching.map(w => ({ ...w, rows: w.rows.filter(r => r.athlete_id === "SYN-3") })) };
    const html = renderToStaticMarkup(createElement(WeeklyGameTrend, { weeks: own, athleteId: "fictional-3" }));
    expect(html).toContain("Week by Week");
    expect(html).toContain('data-week-metric="qpa_pct"');
    expect(html).toContain('data-week-metric="pitching_whip"');
    expect(html).toContain("90.0%");
  });
});
