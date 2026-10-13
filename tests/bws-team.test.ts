import { expect, it } from "vitest";
import { emptyBwsPlan, formatOuts, lineupIssues, normalizeBwsPlan, parseInnings, pitcherUsage, validateBwsPlan, withoutPlayer, BWS_POSITIONS, type BwsTeamPlan } from "@/lib/bws-team";
// Fictional players only.
const id = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
function fixture(): BwsTeamPlan {
  const plan = emptyBwsPlan("Fictional Team");
  plan.players = [
    ...BWS_POSITIONS.slice(0, 8).map((_, i) => ({ id: id(i), name: `Fictional Fielder ${i}`, athleteId: null, role: "position" as const })),
    { id: id(20), name: "Fictional Two-Way", athleteId: null, role: "two_way" as const },
    { id: id(30), name: "Fictional Pitcher", athleteId: null, role: "pitcher" as const },
  ];
  BWS_POSITIONS.slice(0, 8).forEach((position, i) => { plan.depth[position] = [id(i)]; });
  plan.depth.DH = [id(20)];
  plan.lineups = [{ id: id(100), name: "Lineup 1", slots: [...BWS_POSITIONS.slice(0, 8).map((position, i) => ({ playerId: id(i), position })), { playerId: id(20), position: "DH" as const }] }];
  plan.games = [
    { id: id(201), date: "2026-10-20", opponent: "Fictional Opponent", lineupId: id(100), pitchers: [{ playerId: id(30), plannedOuts: 9, actualOuts: null, pitches: null }], notes: "" },
    { id: id(200), date: "2026-10-14", opponent: "", lineupId: null, pitchers: [{ playerId: id(30), plannedOuts: 6, actualOuts: 7, pitches: 41 }, { playerId: id(20), plannedOuts: 3, actualOuts: null, pitches: null }], notes: "" },
  ];
  plan.notes = [{ playerId: id(30), text: "Fictional reminder" }];
  return plan;
}
it("validates a complete plan, sorts games by date and rejects duplicates, bad links and position players on the mound", () => {
  const plan = validateBwsPlan(fixture());
  expect(plan.games.map(g => g.date)).toEqual(["2026-10-14", "2026-10-20"]);
  const bad = fixture(); bad.games[0].pitchers.push({ playerId: id(0), plannedOuts: 3, actualOuts: null, pitches: null });
  expect(() => validateBwsPlan(bad)).toThrow();
  const dupe = fixture(); dupe.lineups[0].slots[1] = { ...dupe.lineups[0].slots[1], position: "C" };
  expect(() => validateBwsPlan(dupe)).toThrow();
  const ghost = fixture(); ghost.depth.SS = [id(999)];
  expect(() => validateBwsPlan(ghost)).toThrow();
  expect(() => validateBwsPlan({ ...fixture(), extra: 1 })).toThrow();
});
it("removes a player everywhere at once", () => {
  const plan = withoutPlayer(fixture(), id(30));
  expect(plan.players.some(p => p.id === id(30))).toBe(false);
  expect(plan.games.every(g => g.pitchers.every(p => p.playerId !== id(30)))).toBe(true);
  expect(plan.notes).toEqual([]);
  expect(() => validateBwsPlan(plan)).not.toThrow();
});
it("uses baseball innings notation without rounding and flags open lineup positions", () => {
  expect(parseInnings("4.2")).toBe(14); expect(parseInnings("4.3")).toBeNull(); expect(parseInnings("4.33")).toBeNull(); expect(parseInnings("10")).toBeNull();
  expect(formatOuts(14)).toBe("4.2"); expect(formatOuts(9)).toBe("3");
  expect(lineupIssues(fixture().lineups[0])).toEqual([]);
  expect(lineupIssues({ ...fixture().lineups[0], slots: fixture().lineups[0].slots.slice(1) }).map(i => i.detail)).toEqual(["8 of 9 batters", "No C"]);
});
it("counts actual innings for played games, planned innings ahead, and days since the last outing", () => {
  const usage = pitcherUsage(validateBwsPlan(fixture()), "2026-10-16");
  const pitcher = usage.find(u => u.player.id === id(30))!;
  expect(pitcher).toMatchObject({ appearances: 1, totalOuts: 7, plannedUpcoming: 9, daysSinceLast: 2 });
  expect(usage.find(u => u.player.id === id(20))!.totalOuts).toBe(3);
  expect(usage.some(u => u.player.role === "position")).toBe(false);
});
it("trims free text and drops empty notes before saving", () => {
  const plan = fixture(); plan.name = " Fictional Team "; plan.notes = [{ playerId: id(30), text: "  " }]; plan.games[0].notes = "late ";
  const clean = normalizeBwsPlan(plan);
  expect(clean.name).toBe("Fictional Team"); expect(clean.notes).toEqual([]);
  expect(() => validateBwsPlan(clean)).not.toThrow();
});
