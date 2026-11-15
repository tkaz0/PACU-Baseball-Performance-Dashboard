import { describe, expect, it } from "vitest";
import { countUpFrame } from "@/components/count-up";

describe("countUpFrame", () => {
  it("keeps the original number format", () => {
    expect(countUpFrame(".812", 1)).toBe(".812");
    expect(countUpFrame(".812", 0)).toBe(".000");
    expect(countUpFrame("92.4 mph", 0.5)).toBe("46.2 mph");
    expect(countUpFrame("2,140 RPM", 1)).toBe("2,140 RPM");
    expect(countUpFrame("2,140 RPM", 0.5)).toBe("1,070 RPM");
    expect(countUpFrame("31.4%", 1)).toBe("31.4%");
    expect(countUpFrame("1.24", 0)).toBe("0.00");
  });
  it("leaves values without a number unchanged", () => {
    expect(countUpFrame("—", 0.5)).toBe("—");
    expect(countUpFrame("Not tested", 0)).toBe("Not tested");
  });
});
