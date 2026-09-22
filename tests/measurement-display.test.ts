import { describe, expect, it } from "vitest";
import { formatHeight, formatMetricNumber, isBatSpeedMetric } from "@/lib/measurement-display";

describe("height presentation", () => {
  it.each([
    [71, "in", "5′ 11″"], [72, "in", "6′ 0″"],
    [70.5, "in", "5′ 10.5″"], [180.34, "cm", "5′ 11″"],
    [180, "cm", "5′ 10.9″"], [71.99, "in", "6′ 0″"],
  ])("formats %s %s as %s without changing the reading", (value, unit, expected) => {
    expect(formatHeight(Number(value), String(unit))).toBe(expected);
  });
  it.each([[0, "in"], [-1, "cm"], [NaN, "in"], [Infinity, "cm"], [Number.MAX_VALUE, "in"], [71, "lb"]])("rejects unsupported readings", (value, unit) => {
    expect(formatHeight(Number(value), String(unit))).toBeNull();
  });
});

describe("bat speed presentation", () => {
  it.each(["bat_speed", "avg_bat_speed", "max_bat_speed", "p95_bat_speed", "Average Bat Speed", "Peak Bat Speed (95th)", "BatSpeed"])("shows %s to one decimal from every source", metric => {
    expect(isBatSpeedMetric(metric)).toBe(true);
    expect(formatMetricNumber(71.246, metric, "Blast Motion · Average · 2026-09-13:2026-09-20")).toBe("71.2");
    expect(formatMetricNumber(71, metric, "Manual Testing")).toBe("71.0");
  });
  it("keeps other metric precision and source rules", () => {
    expect(isBatSpeedMetric("blast_peak_hand_speed")).toBe(false);
    expect(formatMetricNumber(71.246, "blast_peak_hand_speed", "Blast Motion", "71.246")).toBe("71.246");
    expect(formatMetricNumber(71.246, "avg_exit_velocity", "Full Swing · Game")).toBe("71.2");
  });
});
