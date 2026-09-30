import { describe, expect, it } from "vitest";
import { isTrendAnnotationDate, isTrendAnnotationNote, profileTrendAnnotationScope, trendAnnotationsInRange, type TrendAnnotation } from "@/lib/trend-annotations";
const note = (id: string, date: string, archived = false): TrendAnnotation => ({ id, athleteId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", date, category: "stance", scope: "all", note: "Fictional stance cue", shared: true, archived, revision: 1, createdAt: "2026-09-30T01:00:00Z" });
describe("coaching context on recorded trends", () => {
  it("shows date markers inside the chart without needing a reading on that date", () => {
    const items = [note("b", "2026-09-16"), note("a", "2026-09-16"), note("start", "2026-09-10"), note("end", "2026-09-20"), note("before", "2026-09-09"), note("after", "2026-09-21"), note("archived", "2026-09-15", true)];
    const result = trendAnnotationsInRange(items, ["2026-09-20", "2026-09-10"]);
    expect(result.map(item => item.id)).toEqual(["start", "a", "b", "end"]);
    expect(result.every(item => !("value" in item))).toBe(true);
    expect(items.map(item => item.id)).toEqual(["b", "a", "start", "end", "before", "after", "archived"]);
  });
  it("never creates a visible trend window from missing, single-date or invalid records", () => {
    const items = [note("a", "2026-09-16")];
    for (const dates of [[], ["2026-09-16"], ["2026-09-16", "2026-09-16"], ["bad", "2026-09-20"], ["2026-09-31", "2026-10-02"]]) expect(trendAnnotationsInRange(items, dates)).toEqual([]);
  });
  it("rejects invented dates and unsafe text, preserving code-point SQL bounds", () => {
    expect(isTrendAnnotationDate("2026-09-31")).toBe(false);
    expect(isTrendAnnotationDate("2026-08-31")).toBe(false);
    expect(isTrendAnnotationDate("2026-09-01")).toBe(true);
    expect(isTrendAnnotationNote("🙂".repeat(400))).toBe(true);
    expect(isTrendAnnotationNote("🙂".repeat(401))).toBe(false);
    for (const value of ["", " note", "note ", "a\nb", "a\u0000b"]) expect(isTrendAnnotationNote(value)).toBe(false);
  });
});

it("scopes changes to their selected testing/game/practice chart, with explicit all-chart notes", () => {
  const general = note("all", "2026-09-15");
  const hitting = { ...note("hit", "2026-09-16"), scope: "hitting_practice" as const };
  const pitching = { ...note("pitch", "2026-09-17"), scope: "pitching_game" as const };
  const dates = ["2026-09-10", "2026-09-20"];
  expect(trendAnnotationsInRange([general, hitting, pitching], dates, "hitting_practice").map(item => item.id)).toEqual(["all", "hit"]);
  expect(trendAnnotationsInRange([general, hitting, pitching], dates, "pitching_game").map(item => item.id)).toEqual(["all", "pitch"]);
  expect(trendAnnotationsInRange([general, hitting, pitching], dates, "testing").map(item => item.id)).toEqual(["all"]);
});


it("uses source and metric to choose a chart scope without roster-role inference", () => {
  expect(profileTrendAnnotationScope("weight", "RENPHO")).toBe("testing");
  expect(profileTrendAnnotationScope("max_exit_velocity", "Full Swing · Intrasquad")).toBe("hitting_game");
  expect(profileTrendAnnotationScope("classified_avg_spin", "Full Swing · Practice · 4-Seam Fastball")).toBe("pitching_practice");
  expect(profileTrendAnnotationScope("max_pitch_velocity", "Full Swing · Game")).toBe("pitching_game");
  expect(profileTrendAnnotationScope("bat_speed", "Blast Motion")).toBe("hitting_practice");
});


it("keeps legacy Full Swing Hitting and Pitching notes in practice, never game charts", () => {
  expect(profileTrendAnnotationScope("max_exit_velocity", "Full Swing · Hitting")).toBe("hitting_practice");
  expect(profileTrendAnnotationScope("avg_bat_speed", "Full Swing · Hitting")).toBe("hitting_practice");
  expect(profileTrendAnnotationScope("max_pitch_velocity", "Full Swing · Pitching")).toBe("pitching_practice");
  expect(profileTrendAnnotationScope("strike_pct", "Full Swing · Pitching")).toBe("pitching_practice");
  expect(profileTrendAnnotationScope("classified_avg_spin", "Full Swing · Intrasquad · 4-Seam Fastball")).toBe("pitching_game");
  expect(profileTrendAnnotationScope("max_exit_velocity", "Full Swing · Unknown Session")).toBe("testing");
});
