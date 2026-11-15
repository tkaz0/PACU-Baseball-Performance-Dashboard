import { describe, expect, it } from "vitest";
import { rosterPositionGroup } from "@/components/roster-cards";

describe("rosterPositionGroup", () => {
  it("colors cards by primary position", () => {
    expect(rosterPositionGroup("RHP")).toBe("pitcher");
    expect(rosterPositionGroup("LHP")).toBe("pitcher");
    expect(rosterPositionGroup("P")).toBe("pitcher");
    expect(rosterPositionGroup("C")).toBe("catcher");
    expect(rosterPositionGroup("SS")).toBe("infield");
    expect(rosterPositionGroup("1B/OF")).toBe("infield");
    expect(rosterPositionGroup("CF")).toBe("outfield");
    expect(rosterPositionGroup("UTIL")).toBe("utility");
    expect(rosterPositionGroup(null)).toBe("utility");
  });
});
