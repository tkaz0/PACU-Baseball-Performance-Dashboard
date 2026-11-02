import { describe, expect, it } from "vitest";
import { activeSectionAt, sectionFromHash } from "@/lib/section-navigation";

describe("section navigation", () => {
  it("accepts only declared, well-formed section fragments", () => {
    const ids = ["team-batting", "player-breakdown"];
    expect(sectionFromHash("#player-breakdown", ids)).toBe("player-breakdown");
    expect(sectionFromHash("#player%2Dbreakdown", ids)).toBe("player-breakdown");
    for (const hash of ["", "#unknown", "#%E0%A4%A"]) expect(sectionFromHash(hash, ids)).toBeNull();
  });

  it("keeps the section containing the reading line when an adjacent section enters view", () => {
    expect(activeSectionAt([
      { id: "batting", top: -300, bottom: 400 },
      { id: "pitching", top: 424, bottom: 1200 },
    ], 150)).toBe("batting");
  });

  it("follows current geometry when scrolling either direction", () => {
    expect(activeSectionAt([
      { id: "batting", top: -900, bottom: 60 },
      { id: "pitching", top: 84, bottom: 900 },
    ], 150)).toBe("pitching");
    expect(activeSectionAt([
      { id: "batting", top: -400, bottom: 300 },
      { id: "pitching", top: 324, bottom: 1100 },
    ], 150)).toBe("batting");
  });

  it("keeps the previous section in gaps and at the footer, and the first above the sections", () => {
    const sections = [{ id: "batting", top: 200, bottom: 500 }, { id: "pitching", top: 540, bottom: 900 }];
    expect(activeSectionAt(sections, 150)).toBe("batting");
    expect(activeSectionAt(sections, 520)).toBe("batting");
    expect(activeSectionAt(sections, 1000)).toBe("pitching");
    expect(activeSectionAt([], 150)).toBeNull();
  });
});
