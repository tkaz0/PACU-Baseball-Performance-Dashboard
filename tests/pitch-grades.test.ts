import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ownPitchGrades, parsePitchGradeBaselines, pitchGrades, playerVisibleBaselines, PITCH_FAMILY } from "@/lib/pitch-grades";
import { PitchGradesTable } from "@/components/pitch-grades";
import type { CoachingPlayer } from "@/lib/coaching-tools";
import type { SharedGameStat } from "@/lib/game-server";
import type { AllowedContact } from "@/lib/contacts-allowed";
import type { FallArsenalPitch } from "@/lib/pitch-arsenal";
import type { PitchType } from "@/lib/imports/pitch-assignments";

// Fictional fixtures only; no production data.
const pitcher = (i: number): CoachingPlayer => ({ id: `fictional-${i}`, code: `SYN-${i}`, name: `Fictional Pitcher ${i}`, position: "P", secondaryPosition: "", playerType: "pitcher", academicClass: "Junior", bats: "R", throws: "R" });
const stat = (athlete: string, metric: string, value: number): SharedGameStat => ({ source: "pitching_fall_2026", athlete_id: athlete, metric, value, unit: "count", scope: "pitching_event", event_id: "fall-2026-week-1", played_on: null, source_row: 2, source_column: 1, derived_from: [], snapshot_id: "fictional-snapshot", fetched_at: "2026-10-01T00:00:00Z", content_hash: "fictional" });
const pitch = (pitchType: string, velocity: number, spin: number): FallArsenalPitch => ({ source: `Full Swing · Intrasquad · ${pitchType}`, pitchType, count: 20, averageVelocity: velocity, maxVelocity: velocity + 2, velocityReadings: 20, averageSpin: spin, maxSpin: spin + 100, spinReadings: 20, category: "Intrasquad", firstDate: "2026-09-11", lastDate: "2026-09-26", sessionCount: 2, velocityFirstDate: null, velocityLastDate: null, spinFirstDate: null, spinLastDate: null, velocityAverageFirstDate: null, velocityAverageLastDate: null, spinAverageFirstDate: null, spinAverageLastDate: null, maxVelocityDate: null, maxSpinDate: null } as FallArsenalPitch);
const ball = (ev: number, pitchType: PitchType = "Four-Seam Fastball", sq = .8): AllowedContact => ({ playedOn: "2026-09-26", category: "intrasquad", exitVelocity: ev, launchAngle: 15, direction: 0, distance: 200, squaredUp: sq, pitchType });

describe("Pitch+ (Team)", () => {
  const players = [1, 2, 3].map(pitcher);
  const stats = players.flatMap((p, i) => [stat(p.id, "innings_outs", 9), stat(p.id, "fb", 40), stat(p.id, "fb_k", 20 + 5 * i)]);
  const arsenals = players.map((p, i) => ({ athleteId: p.id, pitches: [pitch("Four-Seam Fastball", 80 + 2 * i, 2100 + 100 * i)] }));
  const contacts = new Map(players.map((p, i) => [p.id, Array.from({ length: 8 }, () => ball(90 - 5 * i, "Four-Seam Fastball", .9 - .1 * i))]));

  it("grades strike rate, contact against and velocity/spin relative to the team, 40/40/20", () => {
    const { rows } = pitchGrades(players, stats, arsenals, contacts);
    const best = rows.find(r => r.player.code === "SYN-3")!, worst = rows.find(r => r.player.code === "SYN-1")!;
    expect(best.strike).toBeGreaterThan(100); expect(worst.strike).toBeLessThan(100);
    expect(best.contact).toBeGreaterThan(100); expect(worst.contact).toBeLessThan(100);
    expect(best.stuff).toBeGreaterThan(100);
    expect(best.grade).toBeCloseTo(.4 * best.strike! + .4 * best.contact! + .2 * best.stuff!);
    expect(rows[0].player.code).toBe("SYN-3");
  });
  it("falls back to the pitcher's balls in play across pitches until a pitch has 8 of its own", () => {
    const mixed = new Map([...contacts].map(([id, rows]) => [id, rows.map((row, i) => ({ ...row, pitchType: i < 4 ? "Four-Seam Fastball" as const : "Slider" as const }))]));
    const { rows } = pitchGrades(players, stats, arsenals, mixed);
    expect(rows.every(r => r.contactBasis === "pitcher" && r.contact !== null && r.ballsInPlay === 8)).toBe(true);
    expect(pitchGrades(players, stats, arsenals, contacts).rows.every(r => r.contactBasis === "pitch")).toBe(true);
  });
  it("withholds the blend when a part misses its minimum but keeps the parts", () => {
    const few = new Map([...contacts].map(([id, rows]) => [id, rows.slice(0, 3)]));
    const { rows } = pitchGrades(players, stats, arsenals, few);
    expect(rows.every(r => r.grade === null && r.contact === null && r.strike !== null)).toBe(true);
    expect(rows[0].missing).toContain("8+ balls in play against the pitcher");
    const html = renderToStaticMarkup(createElement(PitchGradesTable, { rows }));
    expect(html).toContain("Needs data");
  });
  it("maps staff pitch labels to the sheet's three strike families and leaves others unmapped", () => {
    expect(PITCH_FAMILY["Cutter"]).toBe("fb"); expect(PITCH_FAMILY["Sweeper"]).toBe("bb_pitch_family"); expect(PITCH_FAMILY["Splitter"]).toBe("ch");
    expect(PITCH_FAMILY["Knuckleball"]).toBeUndefined();
  });
  it("scores changeups by their speed gap off the main fastball, not by spin", () => {
    const withCh = players.map((p, i) => ({ athleteId: p.id, pitches: [pitch("Four-Seam Fastball", 82, 2200), pitch("Changeup", 74 - 2 * i, 1700 + 300 * i)] }));
    const { rows } = pitchGrades(players, stats, withCh, contacts);
    const ch = rows.filter(r => r.pitchType === "Changeup").sort((a, b) => a.player.code.localeCompare(b.player.code));
    expect(ch.map(r => r.velocityGap)).toEqual([8, 10, 12]);
    expect(ch[2].stuff!).toBeGreaterThan(ch[0].stuff!);
  });
  it("publishes only aggregate baselines, dropping pitch-type spreads with fewer than five pitchers", () => {
    const { baselines } = pitchGrades(players, stats, arsenals, contacts);
    const visible = playerVisibleBaselines(baselines);
    expect(visible.types).toEqual({});
    expect(JSON.stringify(visible)).not.toContain("SYN-");
    const five = [1, 2, 3, 4, 5].map(pitcher);
    const big = pitchGrades(five, five.flatMap((p, i) => [stat(p.id, "fb", 40), stat(p.id, "fb_k", 20 + 2 * i)]), five.map((p, i) => ({ athleteId: p.id, pitches: [pitch("Four-Seam Fastball", 80 + i, 2100 + 50 * i)] })), new Map(five.map((p, i) => [p.id, Array.from({ length: 8 }, () => ball(85 + i))])));
    const published = parsePitchGradeBaselines(JSON.parse(JSON.stringify(playerVisibleBaselines(big.baselines))))!;
    expect(published.types["Four-Seam Fastball"].velocity?.n).toBe(5);
    // A player's own grade from their own inputs matches the staff grade for that pitcher.
    const own = ownPitchGrades(five[4], five.flatMap((p, i) => [stat(p.id, "fb", 40), stat(p.id, "fb_k", 20 + 2 * i)]), [pitch("Four-Seam Fastball", 84, 2300)], Array.from({ length: 8 }, () => ball(89)), published)[0];
    const staff = big.rows.find(r => r.player.code === "SYN-5")!;
    expect(own.grade).toBeCloseTo(staff.grade!, 2);
    expect(parsePitchGradeBaselines({ teamStrike: {}, contact: {}, types: { Slider: { spin: { n: 3, mean: 2400, sd: 100 } } } })).toBeNull();
  });
});
