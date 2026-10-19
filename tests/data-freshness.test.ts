import { describe, expect, it } from "vitest";
import { missingWeeksLabel, weeksAfterUpdate } from "@/lib/data-freshness";

const weeks = { 1: "2026-09-12", 2: "2026-09-26", 3: "2026-10-10", 4: "2026-10-16", 5: "2026-10-31" };
describe("data freshness", () => {
  it("lists played weeks dated after the last sheet change, in Pacific time", () => {
    // 9:09 PM Pacific on Oct 12 is already Oct 13 in UTC; the change still counts as Oct 12.
    expect(weeksAfterUpdate("2026-10-13T04:09:00Z", weeks, "2026-10-19")).toEqual([{ week: 4, date: "2026-10-16" }]);
    expect(weeksAfterUpdate("2026-10-08T12:00:00Z", weeks, "2026-10-19").map(w => w.week)).toEqual([3, 4]);
  });
  it("ignores future weeks, same-day updates and missing dates", () => {
    expect(weeksAfterUpdate("2026-10-16T23:00:00Z", weeks, "2026-10-19")).toEqual([]);
    expect(weeksAfterUpdate(null, weeks, "2026-10-19")).toEqual([]);
    expect(weeksAfterUpdate("not a date", weeks, "2026-10-19")).toEqual([]);
  });
  it("names one, consecutive and separate weeks", () => {
    expect(missingWeeksLabel([{ week: 4, date: "2026-10-16" }])).toBe("Week 4 (Oct 16)");
    expect(missingWeeksLabel([{ week: 3, date: "2026-10-10" }, { week: 4, date: "2026-10-16" }])).toBe("Weeks 3–4 (Oct 10, Oct 16)");
    expect(missingWeeksLabel([{ week: 1, date: "2026-09-12" }, { week: 3, date: "2026-10-10" }])).toBe("Weeks 1, 3 (Sep 12, Oct 10)");
    expect(missingWeeksLabel([])).toBe("");
  });
});
