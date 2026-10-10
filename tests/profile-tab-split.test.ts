import { describe, expect, it } from "vitest";
import { profileTab, profileTabForRole, profileTabHref } from "@/lib/profile-tab";

describe("split profile tabs", () => {
  it("maps the retired In-Game tab to Game Stats and keeps unknown values on Overview", () => {
    expect(profileTab("in-game")).toBe("game-stats");
    expect(profileTab("hitting")).toBe("hitting");
    expect(profileTab("unknown")).toBe("overview");
    expect(profileTabHref("/athletes/x", "in-game")).toBe("/athletes/x?tab=game-stats");
  });
  it("falls back to Game Stats when the role has no Hitting or Pitching tab", () => {
    expect(profileTabForRole("hitting", { hitting: false, pitching: true })).toBe("game-stats");
    expect(profileTabForRole("pitching", { hitting: true, pitching: false })).toBe("game-stats");
    expect(profileTabForRole("pitching", { hitting: true, pitching: true })).toBe("pitching");
    expect(profileTabForRole("practice", { hitting: false, pitching: false })).toBe("practice");
  });
});
