import { expect, it } from "vitest";
import { parseWeeklySourceChecks } from "@/lib/weekly-source-contract";

it("accepts only bounded staff source-check receipts",()=>{
  const row={source:"qpa_fall_2026",outcome:"needs_review",checked_at:"2026-09-29T04:00:00Z"};
  expect(parseWeeklySourceChecks([row])).toEqual([{source:"qpa_fall_2026",outcome:"needs_review",checkedAt:row.checked_at}]);
  expect(()=>parseWeeklySourceChecks([row,row])).toThrow();
  expect(()=>parseWeeklySourceChecks([{...row,source:"roster"}])).toThrow();
  expect(()=>parseWeeklySourceChecks([{...row,outcome:"saved"}])).toThrow();
  expect(()=>parseWeeklySourceChecks([{...row,checked_at:"not-a-date"}])).toThrow();
});
