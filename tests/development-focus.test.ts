import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { commandFocus, powerDevelopment, type PowerContact } from "@/lib/development-focus";
import { DevelopmentFocus } from "@/components/development-focus";
import type { CoachingPlayer } from "@/lib/coaching-tools";
import type { SharedGameStat } from "@/lib/game-server";

// Fictional fixtures only; no production data.
const player = (i: number, playerType: string): CoachingPlayer => ({ id: `fictional-${i}`, code: `SYN-${i}`, name: `Fictional Player ${i}`, position: playerType === "pitcher" ? "P" : "SS", secondaryPosition: "", playerType, academicClass: "Junior", bats: "R", throws: "R" });
const stat = (athlete: string, source: SharedGameStat["source"], metric: string, value: number, event: string | null): SharedGameStat => ({ source, athlete_id: athlete, metric, value, unit: "count", scope: source === "qpa_fall_2026" ? "cumulative_fall" : "pitching_event", event_id: event, played_on: null, source_row: 2, source_column: 1, derived_from: [], snapshot_id: "fictional-snapshot", fetched_at: "2026-10-01T00:00:00Z", content_hash: "fictional" });
const pitchLine = (id: string, outs: number, bb: number, k: number) => ["innings_outs", outs, "bb_outcome", bb, "k", k, "pitches", 50, "strikes", 30, "fb", 30, "fb_k", 20, "fps", 6, "hbp", 1].reduce<SharedGameStat[]>((rows, v, i, list) => i % 2 ? rows : [...rows, stat(id, "pitching_fall_2026", v as string, list[i + 1] as number, "fall-2026-week-1")], []);

describe("command focus", () => {
  it("sorts pitchers by BB/9 and flags those above the pooled team rate", () => {
    const players = [player(1, "pitcher"), player(2, "pitcher")];
    const { rows, teamBb9 } = commandFocus(players, [...pitchLine("fictional-1", 9, 1, 3), ...pitchLine("fictional-2", 9, 4, 2)]);
    expect(rows.map(r => r.player.code)).toEqual(["SYN-2", "SYN-1"]);
    expect(rows[0].bb9).toBe(12); expect(teamBb9).toBe(7.5); expect(rows[0].aboveTeam).toBe(true); expect(rows[1].aboveTeam).toBe(false);
    expect(rows[0].families[0].strikePct).toBeCloseTo(66.7, 1); expect(rows[0].fps).toBe(6); expect(rows[0].strikePct).toBe(60);
  });
});

describe("power development", () => {
  const ball = (athleteId: string, ev: number, angle: number, squaredUp: number | null = .8): PowerContact => ({ athleteId, category: "intrasquad", exitVelocity: ev, launchAngle: angle, direction: 0, squaredUp });
  it("describes contact against team medians and leaves small samples unprofiled", () => {
    const players = [player(1, "position"), player(2, "position"), player(3, "position")];
    const contacts = [...Array(5)].flatMap(() => [ball("fictional-1", 95, 20), ball("fictional-2", 70, 0, .5)]).concat([ball("fictional-3", 99, 15)]);
    const { rows } = powerDevelopment(players, [], contacts);
    const byCode = Object.fromEntries(rows.map(r => [r.player.code, r]));
    expect(byCode["SYN-1"].profile).toBe("Hard contact in the air");
    expect(byCode["SYN-2"].profile).toBe("Softer, lower contact");
    expect(byCode["SYN-3"].profile).toBeNull();
    expect(byCode["SYN-1"].squaredUp).toBeCloseTo(80);
  });
  it("renders both sections", () => {
    const html = renderToStaticMarkup(createElement(DevelopmentFocus, { players: [player(1, "pitcher")], stats: pitchLine("fictional-1", 9, 1, 3), contacts: [], squaredAvailable: true }));
    expect(html).toContain("Command Focus"); expect(html).toContain("Power Development"); expect(html).toContain("<strong>3.00</strong>");
  });
});
