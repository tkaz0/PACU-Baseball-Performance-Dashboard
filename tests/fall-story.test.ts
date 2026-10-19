import { describe, expect, it } from "vitest";
import { fallStory } from "@/lib/fall-story";
import type { Measurement } from "@/lib/imports/engine";

// Fictional readings only.
const m = (metric: string, unit: string, value: number, date: string, source = "Example Lab"): Measurement => ({ id: `${metric}-${date}`, athlete_code: "PAC-9001", metric, unit, value, measured_at: date, source, source_sheet: "Example", source_row: 1, source_column: 1, file_hash: "a".repeat(64), imported_at: `${date}T00:00:00Z` } as unknown as Measurement);

describe("fall story", () => {
  it("pins the best of repeat directional results and skips single tests and neutral body metrics", () => {
    const story = fallStory([
      m("max_exit_velocity", "mph", 92, "2026-09-11"), m("max_exit_velocity", "mph", 95, "2026-09-26"), m("max_exit_velocity", "mph", 94, "2026-10-10"),
      m("weight", "lb", 190, "2026-09-07"), m("weight", "lb", 194, "2026-10-07"),
      m("max_bat_speed", "mph", 70, "2026-09-11"),
    ], { 1: "2026-09-12", 2: "2026-09-26", 5: "2026-10-31" }, "2026-10-19");
    expect(story.bests.map(b => [b.metric, b.value, b.date])).toEqual([["max_exit_velocity", 95, "2026-09-26"]]);
    expect(story.weeks.map(w => w.week)).toEqual([1, 2]);
    expect(story.sessions.length).toBeGreaterThan(0);
  });
  it("uses the lowest time for timed tests", () => {
    const story = fallStory([m("home_to_first", "s", 4.4, "2026-09-15"), m("home_to_first", "s", 4.2, "2026-10-13")], {}, "2026-10-19");
    expect(story.bests[0]?.value).toBe(4.2);
  });
});
