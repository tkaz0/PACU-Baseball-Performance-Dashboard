import { expect, it } from "vitest";
import { emptyBwsPlan, formatOuts, lineupIssues, normalizeBwsPlan, parseInnings, pitcherUsage, seriesRequirements, slotPlateAppearances, suggestedOrder, validateBwsPlan, withoutPlayer, BWS_POSITIONS, type BwsTeamPlan } from "@/lib/bws-team";
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
    { id: id(201), date: "2026-10-20", opponent: "Fictional Opponent", lineupId: id(100), pitchers: [{ playerId: id(30), plannedOuts: 9, actualOuts: null, pitches: null, battersFaced: null }], batters: [], notes: "" },
    { id: id(200), date: "2026-10-14", opponent: "", lineupId: null, pitchers: [{ playerId: id(30), plannedOuts: 6, actualOuts: 7, pitches: 41, battersFaced: null }, { playerId: id(20), plannedOuts: 3, actualOuts: null, pitches: null, battersFaced: null }], batters: [], notes: "" },
  ];
  plan.notes = [{ playerId: id(30), text: "Fictional reminder" }];
  return plan;
}
it("validates a complete plan, sorts games by date and rejects duplicates, bad links and position players on the mound", () => {
  const plan = validateBwsPlan(fixture());
  expect(plan.games.map(g => g.date)).toEqual(["2026-10-14", "2026-10-20"]);
  const bad = fixture(); bad.games[0].pitchers.push({ playerId: id(0), plannedOuts: 3, actualOuts: null, pitches: null, battersFaced: null });
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

it("keeps plans saved before series fields valid with the default minimums", () => {
  const legacy = fixture() as Partial<BwsTeamPlan>; delete legacy.series;
  const games = legacy.games!.map(g => { const { batters: _batters, ...rest } = g; void _batters; return { ...rest, pitchers: rest.pitchers.map(p => { const { battersFaced: _bf, ...r } = p; void _bf; return r; }) }; });
  const plan = validateBwsPlan({ ...legacy, games });
  expect(plan.series).toMatchObject({ minAtBats: 4, minBattersFaced: 8, minOuts: 6, inningsPerGame: 9, opponents: [] });
  expect(plan.games.every(g => g.batters.length === 0 && g.pitchers.every(p => p.battersFaced === null))).toBe(true);
});
it("rejects opponents who are on your own team and at-bats above plate appearances", () => {
  const own = fixture(); own.players[0].athleteId = id(500); own.series.opponents = [{ athleteId: id(500), role: "position" }];
  expect(() => validateBwsPlan(own)).toThrow();
  const bad = fixture(); bad.games[0].batters = [{ playerId: id(0), atBats: 4, plateAppearances: 3 }];
  expect(() => validateBwsPlan(bad)).toThrow();
});
it("spreads team plate appearances from the top of the order", () => {
  expect([0, 1, 2, 3, 8].map(slot => slotPlateAppearances(slot, 9))).toEqual([5, 5, 4, 4, 4]);
  expect([0, 2, 3, 8].map(slot => slotPlateAppearances(slot, 7))).toEqual([4, 4, 3, 3]);
});
it("tracks series minimums from recorded results first, then lineup and pitching projections", () => {
  const plan = validateBwsPlan(fixture());
  plan.series = { ...plan.series, minAtBats: 4, minBattersFaced: 8, minOuts: 6 };
  // Game on 10-14 has results: fielder 0 had 2 AB; pitcher 30 recorded 7 outs.
  plan.games[0].batters = [{ playerId: id(0), atBats: 2, plateAppearances: 3 }];
  const rows = seriesRequirements(plan, new Map());
  const fielder0 = rows.find(r => r.kind === "batter" && r.player.id === id(0))!;
  // 2 recorded + lineup slot 1 in the 10-20 game: 5 PA × 0.88.
  expect(fielder0.actual).toBe(2); expect(fielder0.projected).toBeCloseTo(2 + 5 * 0.88); expect(fielder0.status).toBe("on-track");
  const fielder1 = rows.find(r => r.kind === "batter" && r.player.id === id(1))!;
  expect(fielder1.actual).toBe(0); expect(fielder1.games).toBe(1);
  const pitcher = rows.find(r => r.kind === "pitcher" && r.player.id === id(30))!;
  expect(pitcher.status).toBe("met"); expect(pitcher.detail.actualOuts).toBe(7);
  const twoWay = rows.filter(r => r.player.id === id(20));
  expect(twoWay.map(r => r.kind).sort()).toEqual(["batter", "pitcher"]);
  expect(twoWay.find(r => r.kind === "pitcher")!.status).toBe("at-risk"); // 1 planned inning ≈ 4.4 BF is short of 8 BF or 2 IP
});
it("suggests leadoff by OBP and the rest by OPS without moving positions", () => {
  const slots = [{ playerId: "a", position: "C" as const }, { playerId: "b", position: "1B" as const }, { playerId: "c", position: "2B" as const }, { playerId: "d", position: "SS" as const }];
  const stats = new Map([["a", { obp: .300, ops: .700 }], ["b", { obp: .450, ops: .800 }], ["c", { obp: .380, ops: .950 }], ["d", { obp: null, ops: null }]]);
  expect(suggestedOrder(slots, stats)).toEqual([slots[1], slots[2], slots[0], slots[3]]);
});
