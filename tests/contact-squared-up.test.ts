import { describe, expect, it } from "vitest";
import { contactSessionTrends, squaredUpSummary } from "@/lib/contact-trends";
import { contactSquaredUpRows } from "@/lib/imports/contact-squared-up";
import type { SavedContact } from "@/lib/full-swing-contacts-server";
import type { FullSwingSession } from "@/lib/imports/full-swing-session";

// Fictional fixtures only; no production data.
const contact = (date: string, ev: number, sq: number | null, pot: number | null, row = 2): SavedContact => ({ fileHash: "a".repeat(64), sourceRow: row, pitchNumber: row, sourceFile: "fictional.csv", playedOn: date, category: "intrasquad", exitVelocity: ev, launchAngle: 12, direction: 0, distance: 200, squaredUp: sq, potentialExitVelocity: pot });

describe("squared up", () => {
  it("averages only contacts with saved values and reports the gap to potential", () => {
    const s = squaredUpSummary([contact("2026-09-11", 80, .8, 100), contact("2026-09-11", 90, .9, 100), contact("2026-09-11", 70, null, null)]);
    expect(s.count).toBe(2); expect(s.total).toBe(3);
    expect(s.avgSquaredUp).toBeCloseTo(85); expect(s.avgPotential).toBe(100); expect(s.avgGap).toBe(15);
  });
  it("reads SquaredUp and PotExitSpeed from the same CSV row and skips null cells", () => {
    const source = { headers: ["ExitSpeed", "SquaredUp", "PotExitSpeed"], rows: [["80", "0.8", "100"], ["70", "null", "null"]], rowNumbers: [2, 3] } as never;
    const session = { contacts: [{ sourceRow: 2, exitVelocity: 80 }, { sourceRow: 3, exitVelocity: 70 }] } as unknown as FullSwingSession;
    expect(contactSquaredUpRows(source, session)).toEqual([{ sourceRow: 2, exitVelocity: 80, squaredUp: .8, potentialExitVelocity: 100 }]);
  });
  it("draws session trends only with two or more dates", () => {
    expect(contactSessionTrends([contact("2026-09-11", 80, .8, 100)])).toEqual([]);
    const trends = contactSessionTrends([contact("2026-09-11", 80, .8, 100), contact("2026-09-26", 90, .9, 100)]);
    expect(trends.find(t => t.key === "avg_ev")?.points.map(p => p.value)).toEqual([80, 90]);
    expect(trends.find(t => t.key === "squared_up")?.points.map(p => Math.round(p.value))).toEqual([80, 90]);
  });
});
