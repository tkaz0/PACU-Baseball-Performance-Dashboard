import { describe, expect, it } from "vitest";
import { correlationColor, correlationMap, correlationScatterUrl, defaultMapVariables } from "@/lib/correlation-map";
import { analyticsVariables, readingsForPeriod, variableKey, type AnalyticsPlayer, type AnalyticsReading } from "@/lib/analytics";
const players: AnalyticsPlayer[] = Array.from({ length: 8 }, (_, i) => ({ id: `fiction-${i}`, code: `SYN-${i}`, name: `Fictional ${i}`, academicClass: "junior", position: "IF", playerType: "position", bats: "R", throws: "R" }));
const readings: AnalyticsReading[] = players.flatMap((p, i) => [{ id: `${p.id}:x`, athleteId: p.id, metric: "max_exit_velocity", label: "Max Exit Velocity", unit: "mph", source: "Full Swing · Intrasquad", date: "2026-09-11", value: 80 + i, importedAt: "2026-09-12T00:00:00Z" }, { id: `${p.id}:y`, athleteId: p.id, metric: "avg_bat_speed", label: "Average Bat Speed", unit: "mph", source: "Blast Motion", date: "2026-09-14", value: 60 + i * 2, importedAt: "2026-09-15T00:00:00Z" }]);
describe("staff correlation map", () => {
  it("uses paired players, produces symmetric correlations, and never scores the diagonal", () => {
    const keys = [variableKey(readings[0]), variableKey(readings[1])];
    const map = correlationMap(players, readings, keys, 7);
    expect(map[0][1].count).toBe(8);
    expect(map[0][1].r).toBeCloseTo(1);
    expect(map[1][0].r).toBeCloseTo(map[0][1].r!);
    expect(map[0][0]).toMatchObject({ same: true, r: null });
  });
  it("honors date windows, missing pairs, and the five-player minimum", () => {
    const keys = [variableKey(readings[0]), variableKey(readings[1])];
    expect(correlationMap(players, readings, keys, 0)[0][1]).toMatchObject({ count: 0, r: null });
    expect(correlationMap(players.slice(0, 4), readings, keys, 30)[0][1]).toMatchObject({ count: 4, r: null });
  });
  it("does not turn a constant column into a false perfect relationship", () => {
    const same = readings.map(r => r.metric === "avg_bat_speed" ? { ...r, value: 61 } : r);
    const map = correlationMap(players, same, [variableKey(readings[0]), variableKey(readings[1])], 30);
    expect(map[0][1].r).toBeNull();
    expect(map[1][0].r).toBeNull();
  });
  it("keeps source/unit partitions independent and deduplicates selected keys", () => {
    const other = { ...readings[0], id: "practice", source: "Full Swing · Practice" };
    const vars = analyticsVariables([...readings, other]);
    expect(vars.filter(v => v.metric === "max_exit_velocity")).toHaveLength(2);
    const keys = defaultMapVariables(vars);
    expect(new Set(keys).size).toBe(keys.length);
    expect(correlationMap(players, readings, [keys[0], keys[0], "unknown"], 30)).toHaveLength(1);
  });
  it("uses the existing P95/count exclusions before selecting map variables", () => {
    const extra = [{ ...readings[0], metric: "blast_bat_speed_p95", label: "Bat Speed P95", id: "p95" }, { ...readings[0], metric: "classified_pitch_count", id: "count" }];
    const vars = analyticsVariables(readingsForPeriod([...readings, ...extra], "fall"));
    expect(vars.some(v => /p95|count/.test(v.metric))).toBe(false);
  });
  it("opens the exact axes, period and date window without player identity in URLs", () => {
    const cell = correlationMap(players, readings, [variableKey(readings[0]), variableKey(readings[1])], 7)[0][1];
    const url = new URL(correlationScatterUrl(cell, "fall", 7), "https://example.com");
    expect(url.searchParams.get("x")).toBe(cell.x.key);
    expect(url.searchParams.get("y")).toBe(cell.y.key);
    expect(url.searchParams.get("window")).toBe("7");
    expect(url.href).not.toContain("fiction-");
    expect(correlationColor(null)).toBe("var(--surface-raised)");
  });
});
