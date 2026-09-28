import { expect, it } from "vitest";
import { qpaBattingCounts, qpaSheetAB } from "@/lib/qpa-at-bats";
import { battingRates, obpNeedsReview } from "@/lib/batting-stats";
import { battingPowerRates } from "@/lib/advanced-game-stats";
import { gameOpportunities } from "@/lib/game-opportunities";
import { qpaAtBatAdjustments, reviewGameData } from "@/lib/game-review";
import { teamGameSummary } from "@/lib/team-game-stats";
import type { SharedGameStat } from "@/lib/game-server";
const line = { pa: 5, ab: 5, base_hit: 2, pumps: 1, hh_extra_base_hit: 0, bb: 0, hbp: 0, sac_fly: 1, punchies: 0, sac_bunt: 0, hh_base_hit: 1, three_eight_hh: 0 };
const rows = (values: Record<string, number> = line): SharedGameStat[] => Object.entries(values).map(([metric, value]) => ({ source: "qpa_fall_2026", athlete_id: "fictional", metric, value, unit: "count", scope: "cumulative_fall", event_id: null, played_on: null, source_row: 2, source_column: 2, derived_from: [], snapshot_id: "fictional-snapshot", fetched_at: "2026-09-28T01:00:00Z", content_hash: "a".repeat(64) }));
it("uses four official AB for the confirmed five-PA/two-hit/one-SF legacy line everywhere", () => {
 const data = rows(), original = structuredClone(data);
 expect(reviewGameData(data, [])).toEqual([]);
 expect(obpNeedsReview(data)).toBe(false);
 expect(qpaAtBatAdjustments(data)).toEqual([{ athleteId: "fictional", hits: 2, sheetAB: 5, officialAB: 4, pa: 5, sf: 1, hr: 1, singles: 1 }]);
 expect(battingRates(data).find(r => r.metric === "batting_avg")?.value).toBe(.5);
 expect(battingRates(data).find(r => r.metric === "batting_obp")?.value).toBe(.4);
 expect(battingRates(data).find(r => r.metric === "batting_hh_pct")?.value).toBe(40);
 expect(battingPowerRates(data).find(r => r.metric === "batting_est_slg")?.value).toBe(1.25);
 for (const metric of ["batting_avg", "batting_est_slg", "batting_est_iso"]) expect(gameOpportunities(data, "qpa_fall_2026", metric)).toBe(4);
 expect(gameOpportunities(data, "qpa_fall_2026", "batting_obp")).toBe(5);
 expect(gameOpportunities(data, "qpa_fall_2026", "batting_hh_pct")).toBe(5);
 const team = teamGameSummary(data, "qpa_fall_2026");
 expect(team.counts.find(r => r.metric === "ab")?.value).toBe(4);
 expect(team.rates.find(r => r.metric === "batting_avg")?.value).toBe(.5);
 expect(team.rates.find(r => r.metric === "batting_obp")?.value).toBe(.4);
 expect(data).toEqual(original);
});
it("keeps already official AB unchanged and never subtracts SF twice", () => {
 const counts = qpaBattingCounts(new Map(Object.entries(line)));
 expect(counts.get("ab")).toBe(4); expect(qpaSheetAB(counts)).toBe(5);
 expect(qpaBattingCounts(counts)).toEqual(counts);
 const corrected = rows({ ...line, ab: 4 });
 expect(qpaAtBatAdjustments(corrected)).toEqual([]);
 expect(battingRates(corrected).find(r => r.metric === "batting_avg")?.value).toBe(.5);
 expect(reviewGameData(corrected, [])).toEqual([]);
});
it("requires the exact legacy accounting pattern and never fills missing counts", () => {
 for (const changes of [{pa:6},{bb:1},{sac_fly:0},{sac_fly:6},{ab:4}]) expect(qpaBattingCounts(new Map(Object.entries({...line,...changes}))).get("ab")).toBe(changes.ab ?? 5);
 for (const key of ["pa","bb","hbp","sac_fly"]) { const v = new Map(Object.entries(line)); v.delete(key); expect(qpaBattingCounts(v).get("ab")).toBe(5); }
 const mixed = [...rows(), { ...rows()[0], snapshot_id: "other" }];
 expect(qpaAtBatAdjustments(mixed)).toEqual([]);
 expect(battingRates(mixed)).toEqual([]);
});
