import { describe, expect, it } from "vitest";
import { compareTests, comparisonLead, fallSummaryContext, withFallSummary, type CoachingData } from "@/lib/coaching-tools";
import { buildGroupComparison } from "@/lib/group-comparison";

// Fictional comparison data only.
const reading = { id: "fictional-1", athleteId: "a", metric: "max_exit_velocity", label: "Max EV", unit: "mph", source: "Full Swing · Intrasquad", date: "2026-09-26", value: 80, importedAt: "2026-09-27T00:00:00Z" };
const data = (fallSummaries: CoachingData["fallSummaries"]): CoachingData => ({ players: [], readings: [reading], games: [], fallSummaries });
const fall = { athleteId: "a", metric: "max_exit_velocity", source: "full swing · intrasquad", unit: "mph", value: 95.5, bestDate: "2026-09-11", basis: "best" as const, pooled: false, sampleCount: 7, sampleUnit: "swings" };

describe("staff comparison Fall summaries", () => {
  it("uses the leaderboard Fall best while keeping the newest session date", () => {
    const result = withFallSummary(data([fall]), { latest: reading, previous: null, conflict: false });
    expect(result.latest).toMatchObject({ value: 95.5, date: "2026-09-26" });
    expect(fallSummaryContext(result.fall!, "Sep 11")).toEqual({ context: "Fall best · Sep 11", sample: "7 swings" });
  });
  it("resolves differing same-day sessions with the Fall value instead of a review flag", () => {
    const key = JSON.stringify(["max_exit_velocity", "mph", "full swing · intrasquad"]);
    const result = withFallSummary(data([fall]), { latest: null, previous: null, conflict: true }, "a", key, "2026-10-04");
    expect(result).toMatchObject({ conflict: false, latest: { value: 95.5 } });
    expect(withFallSummary(data([]), { latest: null, previous: null, conflict: true }, "a", key).conflict).toBe(true);
  });
  it("keeps the session value without an exact summary", () => {
    expect(withFallSummary(data([{ ...fall, source: "full swing · practice" }]), { latest: reading, previous: null, conflict: false }).latest?.value).toBe(80);
    expect(fallSummaryContext({ ...fall, basis: "average", pooled: false, sampleCount: 1 }, "Sep 11")).toEqual({ context: "Latest session", sample: "1 swing" });
  });
});

describe("matching comparison periods", () => {
  const today = "2026-11-02";
  const comparisonData = (basis: "average" | "best", pooled = true): CoachingData => {
    const metric = basis === "best" ? "max_exit_velocity" : "avg_exit_velocity";
    return {
      players: ["a", "b"].map(id => ({ id, code: `SYN-${id}`, name: `Fictional ${id}`, academicClass: "Junior", position: "OF", playerType: "position", bats: "R", throws: "R" })),
      readings: ["a", "b"].map((athleteId, index) => ({ ...reading, id: `fictional-${athleteId}`, athleteId, metric, date: index ? "2026-10-25" : "2026-09-11", value: 80 + index })),
      games: [],
      fallSummaries: ["a", "b"].map((athleteId, index) => ({ ...fall, athleteId, metric, value: 85 + index, basis, pooled })),
    };
  };
  const pair = (d: CoachingData, gap = 7) => compareTests(d, "a", "b", "Hitting", today, gap)[0];
  const group = (d: CoachingData, gap = 7) => buildGroupComparison(d, ["a", "b"], "Hitting", today, gap).groups[0].columns[0];

  it.each(["best", "average"] as const)("compares two Fall %s values even when their latest session dates differ", basis => {
    const d = comparisonData(basis);
    const before = structuredClone(d);
    expect(pair(d)).toMatchObject({ comparable: true, basisMismatch: false, gap: 44 });
    expect(group(d).comparable).toBe(true);
    expect(comparisonLead(pair(d).first?.value, pair(d).second?.value, "higher", pair(d).comparable)).toBe("b");
    expect(d).toEqual(before);
  });

  it("never awards a lead between a weighted Fall average and a latest-session fallback", () => {
    const d = comparisonData("average");
    d.readings[1].date = d.readings[0].date;
    d.fallSummaries![1].pooled = false;
    expect(pair(d)).toMatchObject({ comparable: false, basisMismatch: true, gap: 0 });
    expect(group(d).comparable).toBe(false);
    expect(comparisonLead(pair(d).first?.value, pair(d).second?.value, "higher", pair(d).comparable)).toBeNull();
    // A missing Fall summary also must not masquerade as a full-season average.
    d.fallSummaries!.pop();
    expect(pair(d).comparable).toBe(false);
    expect(group(d).comparable).toBe(false);
  });

  it("keeps date-window checks for two latest-session fallbacks", () => {
    const d = comparisonData("average", false);
    expect(pair(d)).toMatchObject({ comparable: false, basisMismatch: false });
    expect(group(d).comparable).toBe(false);
    d.readings[1].date = "2026-09-12";
    expect(pair(d).comparable).toBe(true);
    expect(group(d).comparable).toBe(true);
  });

  it("does not compare an unmatched source or a missing result as a Fall best", () => {
    const d = comparisonData("best");
    d.readings[1].source = "Full Swing · Practice";
    expect(compareTests(d, "a", "b", "Hitting", today, 60).every(row => !row.comparable)).toBe(true);
    expect(buildGroupComparison(d, ["a", "b"], "Hitting", today, 60).groups.every(group => group.columns.every(column => !column.comparable))).toBe(true);
  });
});
