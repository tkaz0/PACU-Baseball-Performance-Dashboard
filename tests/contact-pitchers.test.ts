import { expect, it } from "vitest";
import { FULL_SWING_SESSION_HEADERS, summarizeFullSwingSession } from "@/lib/imports/full-swing-session";
import { contactPitcherRows } from "@/lib/imports/contact-pitchers";
import { pitcherHandSplits } from "@/components/pitcher-hand-splits";
import type { SavedContact } from "@/lib/full-swing-contacts-server";

// Fictional session: two pitchers, one batter.
const event = (values: Record<string, string>) => FULL_SWING_SESSION_HEADERS.map(header => values[header] ?? ({ Date: "09/11/26", Mode: "Live at Bat", Environment: "Field", PitcherTeam: "Fictional", BatterTeam: "Fictional", Level: "College" } as Record<string, string>)[header] ?? "null");
const rows = [
  event({ PitchNo: "1", Pitcher: "Fictional Righty", PitcherId: "p1", Batter: "Fictional Batter", BatterId: "b1", RelSpeed: "80.5", ExitSpeed: "91.2", Angle: "15", Direction: "-20", Distance: "250" }),
  event({ PitchNo: "2", Pitcher: "Fictional Lefty", PitcherId: "p2", Batter: "Fictional Batter", BatterId: "b1", RelSpeed: "77.25", ExitSpeed: "85", Angle: "5" }),
  event({ PitchNo: "3", Pitcher: "Fictional Lefty", PitcherId: "p2", Batter: "Fictional Batter", BatterId: "b1", RelSpeed: "78" }),
];
it("pairs each batted ball with its pitcher's summary row and exact max velocity, sending no names", () => {
  const source = { headers: [...FULL_SWING_SESSION_HEADERS], rows, rowNumbers: [2, 3, 4] };
  const session = summarizeFullSwingSession(source);
  const links = contactPitcherRows(source, session);
  expect(links.map(link => link.sourceRow)).toEqual([2, 3]);
  expect(links.map(link => link.pitcherMaxVelocity)).toEqual([80.5, 78]);
  expect(new Set(links.map(link => link.pitcherSummaryRow)).size).toBe(2);
  expect(JSON.stringify(links)).not.toContain("Fictional");
  expect(contactPitcherRows(source, { ...session, mode: "Machine BP" })).toEqual([]);
});
it("splits by linked pitcher hand and counts unknown contact instead of guessing", () => {
  const contact = (exitVelocity: number, launchAngle: number, pitcherThrows: "R" | "L" | null): SavedContact => ({ fileHash: "e".repeat(64), sourceRow: 2, pitchNumber: 1, sourceFile: "fictional.csv", playedOn: "2026-09-11", category: "intrasquad", exitVelocity, launchAngle, direction: null, distance: null, pitcherThrows });
  const result = pitcherHandSplits([contact(95, 15, "R"), contact(85, 30, "R"), contact(70, 5, "L"), contact(99, 20, null)]);
  expect(result.unknown).toBe(1);
  expect(result.sides[0]).toMatchObject({ hand: "R", count: 2, avgEv: 90, maxEv: 95, hardHitPct: 50, lineDrivePct: 50 });
  expect(result.sides[1]).toMatchObject({ hand: "L", count: 1, avgEv: 70, hardHitPct: 0 });
});
