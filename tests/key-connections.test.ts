import { describe, expect, it } from "vitest";
import { chanceCutoff, connectionHistory, connectionStrength, keyConnections, pacificWeekStart } from "@/lib/key-connections";
import type { AnalyticsDataset, AnalyticsReading } from "@/lib/analytics";

// Fictional players only.
const players = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, code: `PAC-90${i}`, name: `Example Pitcher ${i}`, academicClass: "", position: "P", playerType: "pitcher", bats: "R", throws: "R" }));
const reading = (athleteId: string, metric: string, value: number, opportunities: number): AnalyticsReading => ({ id: `${athleteId}-${metric}`, athleteId, metric, label: metric, unit: metric === "strike_pct" ? "%" : "decimal", source: "Pitching · Fall 2026 cumulative (snapshot date)", date: "2026-10-17", value, importedAt: "2026-10-17T00:00:00Z", opportunities });

describe("key connections", () => {
  it("pairs tracked stats and drops game lines under the minimum", () => {
    const readings = players.flatMap((p, i) => [reading(p.id, "strike_pct", 55 + i * 2, i === 7 ? 3 : 12), reading(p.id, "pitching_whip", 2.4 - i * 0.15, i === 7 ? 3 : 12)]);
    const result = keyConnections({ players, readings } as AnalyticsDataset).find(r => r.pair.key === "strike_whip")!;
    expect(result.n).toBe(7);
    expect(result.r).toBeCloseTo(-1, 5);
    expect(keyConnections({ players, readings } as AnalyticsDataset).find(r => r.pair.key === "fb_velo_k9")!.r).toBeNull();
  });
  it("labels strength and the chance range", () => {
    expect(connectionStrength(0.72)).toBe("Strong");
    expect(connectionStrength(-0.45)).toBe("Moderate");
    expect(connectionStrength(0.1)).toBe("Little");
    expect(chanceCutoff(20)).toBeCloseTo(0.45, 2);
  });
  it("starts weeks on Pacific Mondays and replaces this week's saved value with the live one", () => {
    expect(pacificWeekStart("2026-10-19")).toBe("2026-10-19");
    expect(pacificWeekStart("2026-10-25")).toBe("2026-10-19");
    const current = [{ pair: { key: "strike_whip" }, r: -0.8, n: 22 }] as unknown as Parameters<typeof connectionHistory>[1];
    const history = connectionHistory([{ weekStart: "2026-10-12", pair: "strike_whip", r: -0.7, n: 20 }, { weekStart: "2026-10-19", pair: "strike_whip", r: -0.1, n: 2 }], current, "2026-10-19");
    expect(history.strike_whip.map(p => p.r)).toEqual([-0.7, -0.8]);
  });
  it("tracks the November pairs and no longer tracks spin → Strike % or bat speed → OPS", () => {
    const hitters = players.map(p => ({ ...p, position: "OF", playerType: "position" }));
    const row = (athleteId: string, metric: string, unit: string, source: string, value: number, opportunities?: number): AnalyticsReading => ({ id: `${athleteId}-${metric}`, athleteId, metric, label: metric, unit, source, date: "2026-10-20", value, importedAt: "2026-10-20T00:00:00Z", ...(opportunities === undefined ? {} : { opportunities }) });
    const qpa = "QPA · Fall cumulative (snapshot date)";
    const readings = hitters.flatMap((p, i) => [row(p.id, "max_bat_speed", "mph", "Full Swing · Intrasquad", 60 + i), row(p.id, "qpa_game_gdp", "count", qpa, i, i === 0 ? 10 : 20), row(p.id, "blast_vertical_bat_angle", "deg", "Blast Motion · Fall Average", -40 + i), row(p.id, "qpa_game_qpa_pct", "%", qpa, 60 - i * 2, 20)]);
    const results = keyConnections({ players: hitters, readings } as AnalyticsDataset);
    expect(results.map(r => r.pair.key)).not.toContain("fb_spin_strike");
    expect(results.map(r => r.pair.key)).not.toContain("bat_speed_ops");
    const gdp = results.find(r => r.pair.key === "bat_speed_gdp")!;
    expect(gdp.n).toBe(7);
    expect(gdp.r).toBeCloseTo(1, 5);
    expect(results.find(r => r.pair.key === "vba_qpa")!.r).toBeCloseTo(-1, 5);
    expect(results.find(r => r.pair.key === "muscle_k_pct")!.r).toBeNull();
  });
});
