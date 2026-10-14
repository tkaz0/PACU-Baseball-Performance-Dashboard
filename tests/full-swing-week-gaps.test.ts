import { expect, it } from "vitest";
import { missingFullSwingWeeks } from "@/lib/full-swing-week-gaps";
// Fictional dates only.
it("flags played weeks with no in-game session near the game date, allowing an export a few days early", () => {
  const weeks = { 1: "2026-09-12", 2: "2026-09-26", 3: "2026-10-10", 4: "2026-10-24" };
  expect(missingFullSwingWeeks(weeks, ["2026-09-11", "2026-09-26"], "2026-10-14")).toEqual([{ week: 3, date: "2026-10-10" }]);
  expect(missingFullSwingWeeks(weeks, ["2026-09-11", "2026-09-26", "2026-10-11"], "2026-10-14")).toEqual([]);
  expect(missingFullSwingWeeks(weeks, ["2026-09-08"], "2026-09-20")).toEqual([{ week: 1, date: "2026-09-12" }]);
});
