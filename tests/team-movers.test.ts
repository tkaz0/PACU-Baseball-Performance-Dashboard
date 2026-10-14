import { expect, it } from "vitest";
import { teamMovers } from "@/lib/team-movers";
import type { CoachingData, CoachingPlayer } from "@/lib/coaching-tools";
import type { AnalyticsReading } from "@/lib/analytics";
// Fictional players and readings only.
const player = (n: number): CoachingPlayer => ({ id: `fictional-${n}`, code: `SYN-${n}`, name: `Example Player ${n}`, academicClass: "Junior", position: "OF", playerType: "position", bats: "R", throws: "R" });
const reading = (athlete: number, metric: string, label: string, unit: string, source: string, value: number, date: string): AnalyticsReading => ({ id: `r-${athlete}-${metric}-${date}`, athleteId: `fictional-${athlete}`, metric, label, unit, value, date, source, importedAt: "2026-10-01T00:00:00Z" });
const ev = (a: number, v: number, d: string) => reading(a, "max_exit_velocity", "Max Exit Velocity", "mph", "Full Swing · Practice", v, d);
it("ranks only real improvements since the previous test, by raw change for single-best maximums, and skips body changes", () => {
  const data: CoachingData = { players: [1, 2, 3, 4].map(player), games: [], readings: [
    ev(1, 90, "2026-09-10"), ev(1, 96, "2026-10-08"),   // +6
    ev(2, 95, "2026-09-10"), ev(2, 98, "2026-10-08"),   // +3
    ev(3, 99, "2026-09-10"), ev(3, 95, "2026-10-08"),   // decline
    ev(4, 100, "2026-09-10"), ev(4, 100.5, "2026-10-08"), // steady (<1%)
    reading(1, "muscle_mass", "Muscle Mass", "lb", "RENPHO", 150, "2026-09-10"), reading(1, "muscle_mass", "Muscle Mass", "lb", "RENPHO", 160, "2026-10-08"),
  ] };
  const boards = teamMovers(data, "2026-10-14");
  expect(boards.map(b => b.metric)).toEqual(["max_exit_velocity"]);
  expect(boards[0].movers.map(m => [m.name, m.delta, m.raw])).toEqual([["Example Player 1", 6, true], ["Example Player 2", 3, true]]);
  expect(boards[0].compared).toBe(4);
});
