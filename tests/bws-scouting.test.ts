import { expect, it } from "vitest";
import { handSplit, hitterAlignment, matchupNotes } from "@/lib/bws-scouting";
// Fictional batted balls only. Negative direction is the third-base side.
const ball = (direction: number, launchAngle: number, distance = 200, exitVelocity = 85, pitcherThrows: "R" | "L" | null = null) => ({ direction, launchAngle, distance, exitVelocity, pitcherThrows });
it("calls a pull-side shade for a right-handed pull hitter and leaves likely fouls out", () => {
  const rows = [...Array.from({ length: 6 }, () => ball(-30, 2, 90)), ball(-25, 15, 320), ball(-28, 30, 330), ball(-20, 20, 310), ball(-35, 25, 305), ball(5, 3, 80), ball(-60, 5, 60, 60)];
  const a = hitterAlignment(rows, "R");
  expect(a.count).toBe(11); // the 60 mph ball at -60° is a likely foul
  expect(a.calls).toEqual([{ area: "Infield", call: "Shade to the pull side" }, { area: "Outfield", call: "Shade to the pull side, play deep" }]);
  // The same balls for a lefty are opposite-field.
  expect(hitterAlignment(rows, "L").calls[0].call).toBe("Shade to the opposite side");
});
it("plays straight up with too few directed balls or no batting side", () => {
  expect(hitterAlignment([ball(-30, 2), ball(-30, 2)], "R").calls).toEqual([]);
  expect(hitterAlignment(Array.from({ length: 10 }, () => ball(-30, 2)), "S").calls).toEqual([]);
});
it("splits contact by the linked pitcher's hand", () => {
  const rows = [ball(0, 10, 200, 95, "R"), ball(0, 10, 200, 80, "R"), ball(0, 10, 200, 99, "L")];
  expect(handSplit(rows, "R")).toMatchObject({ count: 2, avgEv: 87.5, hardPct: 50 });
});
it("writes plain matchup notes from simple cutoffs", () => {
  const notes = matchupNotes({ kPct: 30, bbPct: 15, ops: .7, groundPct: 55, split: { count: 6, avgEv: 92, hardPct: 50 } }, { k9: 10, bb9: 6, groundPct: 52, hardPctAgainst: 30 }, "R");
  expect(notes.map(n => n.tone)).toEqual(["pitcher", "hitter", "hitter", "pitcher"]);
  expect(matchupNotes({ kPct: 10, bbPct: 5, ops: 1.2, groundPct: null, split: { count: 2, avgEv: 95, hardPct: 100 } }, { k9: 5, bb9: 2, groundPct: null, hardPctAgainst: null }, "L")).toEqual([{ tone: "hitter", text: "Dangerous bat (1.000+ OPS)" }]);
});
