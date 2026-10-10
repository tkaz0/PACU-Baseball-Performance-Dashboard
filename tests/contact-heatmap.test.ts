import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { contactHeatCell, contactHeatmap } from "@/lib/contact-heatmap";
import { contactQuality } from "@/lib/contact-quality";
import { ContactHeatmap } from "@/components/contact-heatmap";
import { HitterContactMap } from "@/components/hitter-contact-map";
import type { SavedContact } from "@/lib/full-swing-contacts-server";

// Fictional, row-paired readings only.
const row = (speed: number, angle: number, patch: Partial<SavedContact> = {}): SavedContact => ({ fileHash: "a".repeat(64), sourceRow: 2, sourceFile: "fictional.csv", playedOn: "2026-09-11", category: "intrasquad", pitchNumber: 1, exitVelocity: speed, launchAngle: angle, direction: 0, distance: 180, ...patch });
describe("contact heatmap", () => {
  it("assigns each boundary exactly once, keeping 90+ and 8–32 inclusive", () => {
    for (const [speed, band] of [[69.99, 0], [70, 1], [80, 2], [90, 3], [100, 4], [200, 4]]) {
      expect(contactHeatCell(row(speed, 8))).toBe(`2:${band}`);
    }
    for (const [angle, band] of [[-90, 4], [-0.01, 4], [0, 3], [7.99, 3], [8, 2], [32, 2], [32.01, 1], [49.99, 1], [50, 0], [90, 0]]) {
      expect(contactHeatCell(row(90, angle))).toBe(`${band}:3`);
    }
  });
  it("reconciles counts and percentages with contact quality and respects the foul switch", () => {
    const rows = [row(90, 8), row(95, 32), row(80, 0), row(65, 15, { direction: 55 }), row(60, 10, { direction: null }), row(NaN, 10), row(90, Infinity), row(201, 0)];
    for (const includeLikelyFouls of [false, true]) {
      const model = contactHeatmap(rows, { includeLikelyFouls });
      expect(model.count).toBe(contactQuality(rows, { includeLikelyFouls }).count);
      expect(model.cells.reduce((sum, cell) => sum + cell.count, 0)).toBe(model.count);
      expect(model.cells.reduce((sum, cell) => sum + cell.share, 0)).toBeCloseTo(100, 10);
      expect(model.cells.find(cell => cell.id === "2:3")).toMatchObject({ count: 2, intensity: 1 });
    }
    expect(contactHeatmap(rows).count).toBe(4);
    expect(contactHeatmap(rows, { includeLikelyFouls: true }).count).toBe(5);
  });
  it("does not synthesize contact from empty or invalid readings", () => {
    for (const rows of [[], [row(0, 10), row(-1, 10), row(90, 91)]]) {
      const model = contactHeatmap(rows);
      expect(model.count).toBe(0);
      expect(model.cells.every(cell => cell.count === 0 && cell.share === 0 && cell.intensity === 0)).toBe(true);
    }
  });
  it("renders cell counts, shares, accessible bands and an explicit empty state", () => {
    const html = renderToStaticMarkup(createElement(ContactHeatmap, { contacts: [row(90, 8), row(95, 20)] }));
    expect(html).toContain("90–&lt;100 mph, 8–32°: 2 balls, 100.0 percent");
    expect(html).toContain("not a better result");
    expect(html).toContain("About Contact Heatmap");
    expect(html).not.toContain("fictional.csv");
    expect(renderToStaticMarkup(createElement(ContactHeatmap, { contacts: [] }))).toContain("No paired exit speed");
  });
  it("offers heatmap in the existing context-filtered map without crossing practice and in-game", () => {
    const contacts = [row(90, 8), row(95, 20, { category: "practice", fileHash: "b".repeat(64) })];
    const html = renderToStaticMarkup(createElement(HitterContactMap, { contacts, context: "in_game" }));
    expect(html).toContain("Contact Heatmap");
    expect(html).toContain("1 recorded ball");
    expect(html).not.toContain("All Fall practice");
  });
});
