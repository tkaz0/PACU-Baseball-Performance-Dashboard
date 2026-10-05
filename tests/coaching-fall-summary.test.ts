import { describe, expect, it } from "vitest";
import { fallSummaryContext, withFallSummary, type CoachingData } from "@/lib/coaching-tools";

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
