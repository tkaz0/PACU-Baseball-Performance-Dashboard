import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { gameWeeks } from "@/lib/game-weeks";
import { playersOfTheWeek } from "@/lib/home-spotlight";
import { HomeSpotlight } from "@/components/home-spotlight";
import { WeeklyGameTrend } from "@/components/weekly-game-trend";
import type { GameSnapshotRow } from "@/lib/game-trends";
import type { WeekPlayer } from "@/lib/home-spotlight";

// Fictional fixtures only; no production data.
const players: WeekPlayer[] = Array.from({ length: 6 }, (_, i) => ({ id: `SYN-${i}`, profileId: i === 3 ? `fictional-${i}` : null, code: `SYN-${i}`, name: `Fictional Player ${i + 1}`, position: "SS", secondaryPosition: "P", playerType: "two_way", academicClass: "Junior", bats: "R", throws: "R" }));
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
    expect(weeks.hitting.map(week => [week.week, week.detail])).toEqual([[1, "September 12th"], [2, "September 26th"]]);
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
    expect(html).toContain("Week 2 · September 26th");
    // Only the viewer's own profile is linked; peers render as plain names.
    expect(html).not.toMatch(/href="\/athletes\/(?!fictional-3)/);
    expect(html).not.toContain('href="/top-performers"');
    expect(html).toContain("which may not line up with exact calendar weeks");
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
    expect(html).toContain("added QPA counts between saved updates");
    expect(html).not.toContain("Each column uses only");
  });
});

describe("Boxer World Series races", () => {
  // Fictional BWS update: QPA saved after October 23 and a separate BWS pitching block.
  const bwsTotals = Object.fromEntries(players.map((p, i) => [p.code, Object.fromEntries(Object.entries(week2Totals[p.code]).map(([k, v]) => [k, v + (k === "pa" ? (i === 5 ? 3 : 8) : k === "base_hit" ? (i === 1 ? 6 : i === 5 ? 3 : 1) : k === "ab" ? (i === 5 ? 3 : 7) : k === "qpa" ? (i === 1 ? 8 : i === 5 ? 3 : 2) : k === "bb" ? (i === 5 ? 0 : 1) : 0)]))]));
  const withBws = [...snapshots, qpa("q4", "2026-10-26T18:00:00Z", bwsTotals), pitch("p2", "2026-10-27T22:00:00Z", {
    "fall-2026-week-1": Object.fromEntries(players.map((p, i) => [p.code, pitchLine(9, 3 + i, 1 + (i % 2), 3 + i, i)])),
    "fall-2026-bws": Object.fromEntries(players.map((p, i) => [p.code, pitchLine(i === 0 ? 3 : 9, i === 4 ? 1 : 6, i === 4 ? 1 : 2, i === 4 ? 8 : 3 + i, i === 4 ? 0 : 3)])),
  })];
  it("keeps BWS results out of Fall Ball weeks and ranks the races among qualified players", async () => {
    const weeks = gameWeeks(withBws);
    expect(weeks.hitting.map(w => w.week)).toEqual([1, 2]);
    expect(weeks.pitching.map(w => w.week)).toEqual([1]);
    const { bwsRaces } = await import("@/lib/home-spotlight");
    const races = bwsRaces(players, weeks.bws)!;
    // SYN-5 has only 3 PA and SYN-0 only 1 IP, so neither is in a race; five players remain in each.
    expect(races.mvp!.qualified).toBe(5); expect(races.cyYoung!.qualified).toBe(5);
    expect(races.mvp!.entries.map(e => e.code)).not.toContain("SYN-5");
    expect(races.cyYoung!.entries.map(e => e.code)).not.toContain("SYN-0");
    expect(races.mvp!.entries[0].code).toBe("SYN-1");
    expect(races.cyYoung!.entries[0].code).toBe("SYN-4");
    expect(races.mvp!.entries.length).toBeLessThanOrEqual(3);
    const html = renderToStaticMarkup(createElement(HomeSpotlight, { weeks: playersOfTheWeek(players, weeks), races }));
    expect(html).toContain("MVP Race"); expect(html).toContain("Cy Young Race"); expect(html).toContain("Leading");
    expect(html).not.toContain("BWS MVP<"); expect(html).toContain("Fall Ball Players of the Week");
    const trend = renderToStaticMarkup(createElement(WeeklyGameTrend, { weeks: gameWeeks(withBws.map(s => ({ ...s, observations: (s.observations as { athleteCode: string }[]).filter(o => o.athleteCode === "SYN-1") }))), athleteId: "fictional" }));
    expect(trend).toContain(">BWS<");
  });
  it("waits for five qualified players before naming a leader", async () => {
    const { bwsRaces } = await import("@/lib/home-spotlight");
    const few = gameWeeks([...snapshots, qpa("q4", "2026-10-26T18:00:00Z", Object.fromEntries(players.map((p, i) => [p.code, { ...week2Totals[p.code], pa: week2Totals[p.code].pa + (i < 2 ? 5 : 1), ab: week2Totals[p.code].ab + (i < 2 ? 5 : 1) }])))]);
    const races = bwsRaces(players, few.bws)!;
    expect(races.mvp!.entries).toEqual([]); expect(races.mvp!.qualified).toBe(2);
    expect(renderToStaticMarkup(createElement(HomeSpotlight, { weeks: [], races }))).toContain("five players reach 4 PA");
  });
});

describe("BWS series value", () => {
  it("ranks MVP by bases above the team rate and Cy Young by baserunners prevented", async () => {
    const { bwsRaces } = await import("@/lib/home-spotlight");
    const hitter = (code: string, pa: number, h: number, hr: number, bb: number, qpa: number) => ["pa", "base_hit", "pumps", "bb", "hh_extra_base_hit", "hbp", "ab", "qpa", "punchies", "sac_fly"].map((metric, i) => ({ athlete_id: code, metric, value: [pa, h, hr, bb, 0, 0, pa - bb, qpa, 1, 0][i], unit: "count", source: "qpa_fall_2026" }));
    const pitcher = (code: string, outs: number, h: number, bb: number) => ["innings_outs", "h", "bb_outcome", "k", "r", "pitches", "strikes"].map((metric, i) => ({ athlete_id: code, metric, value: [outs, h, bb, 3, 1, 40, 25][i], unit: "count", source: "pitching_fall_2026" }));
    const roster = Array.from({ length: 6 }, (_, i) => ({ id: `SYN-${i}`, code: `SYN-${i}`, name: `Fictional ${i}`, profileId: null, position: "SS", secondaryPosition: "P", playerType: "two_way", academicClass: "", bats: "R", throws: "R" }));
    // SYN-0: 3 HR in 10 PA but low QPA; SYN-1: steady singles and high QPA. Team: 60 PA, 60 bases + walks.
    const hitting = [hitter("SYN-0", 10, 5, 3, 1, 5), hitter("SYN-1", 10, 6, 0, 2, 9), ...[2, 3, 4, 5].map(i => hitter(`SYN-${i}`, 10, 3, 0, 1, 5))].flat();
    const pitching = [pitcher("SYN-0", 15, 2, 1), pitcher("SYN-1", 6, 0, 0), ...[2, 3, 4, 5].map(i => pitcher(`SYN-${i}`, 9, 4, 2))].flat();
    const week = (source: string, rows: object[]) => ({ week: 0, source, label: "Boxer World Series", detail: "BWS", rows, withheld: 0 }) as never;
    const races = bwsRaces(roster, { hitting: week("qpa_fall_2026", hitting), pitching: week("pitching_fall_2026", pitching) })!;
    // Team production 15 + 8 + 4×4 = 39 over 60 PA = .65; SYN-0 produced 15 → 15 − 6.5 = +8.5.
    expect(races.mvp!.entries.map(e => [e.code, e.score])).toEqual([["SYN-0", 8.5], ["SYN-1", 1.5], ["SYN-2", -2.5]]);
    // Team (H + BB) 3 + 0 + 4×6 = 27 over 57 outs; SYN-0 prevents 27/57 × 15 − 3 ≈ +4.1 over five innings.
    expect(races.cyYoung!.entries[0]).toMatchObject({ code: "SYN-0", score: 4.1, headline: { label: "baserunners prevented", value: "+4.1" } });
    expect(races.cyYoung!.entries[1].code).toBe("SYN-1");
  });
});
