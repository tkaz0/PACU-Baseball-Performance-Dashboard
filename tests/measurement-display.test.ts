import { describe, expect, it } from "vitest";
import { formatHeight } from "@/lib/measurement-display";

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
