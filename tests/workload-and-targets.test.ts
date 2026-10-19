import { describe, expect, it } from "vitest";
import { pitcherWorkload } from "@/lib/pitcher-workload";
import { teamReportCard } from "@/lib/team-report-card";
import { statBenchmark, benchmarkNumber } from "@/lib/stat-benchmarks";
import type { SharedGameStat } from "@/lib/game-server";
import type { TeamGameSummary } from "@/lib/team-game-stats";
import type { CoachingPlayer } from "@/lib/coaching-tools";

// Fictional fixtures only.
const player = (id: string): CoachingPlayer => ({ id, code: `PAC-9${id}`, name: `Example ${id}`, academicClass: "", position: "P", playerType: "pitcher", bats: "R", throws: "R" });
const week = (athlete: string, n: number, metric: string, value: number): SharedGameStat => ({ source: "pitching_fall_2026", athlete_id: athlete, metric, value, unit: "count", scope: "pitching_event", event_id: `fall-2026-week-${n}`, played_on: null, source_row: 2, source_column: 1, derived_from: [], snapshot_id: "s1", fetched_at: "2026-10-17T00:00:00Z", content_hash: "x" });

describe("pitcher workload", () => {
  it("flags a 50%+ jump to 30+ pitches in the latest week only", () => {
    const stats = [week("1", 1, "pitches", 20), week("1", 2, "pitches", 35), week("2", 1, "pitches", 40), week("2", 2, "pitches", 42), week("3", 1, "pitches", 10), week("3", 2, "pitches", 18)];
    const { weeks, rows } = pitcherWorkload([player("1"), player("2"), player("3")], stats);
    expect(weeks).toEqual([1, 2]);
    expect(rows.find(r => r.player.id === "1")).toMatchObject({ flagged: true, total: 55 });
    expect(rows.find(r => r.player.id === "2")?.flagged).toBe(false);
    expect(rows.find(r => r.player.id === "3")?.flagged).toBe(false); // jump but under 30 pitches
    expect(rows[0].player.id).toBe("1");
  });
  it("refuses mixed sheet versions instead of adding them", () => {
    const stats = [week("1", 1, "pitches", 20), { ...week("1", 2, "pitches", 35), snapshot_id: "s2" }];
    expect(pitcherWorkload([player("1")], stats).rows).toEqual([]);
  });
});

describe("report card next-letter targets", () => {
  const summary = (rates: TeamGameSummary["rates"]): TeamGameSummary => ({ players: 10, entries: 10, games: 0, updatedAt: null, counts: [], rates });
  it("names the NWC cutoff for the next letter in the right direction", () => {
    const bb9 = statBenchmark("pitching_bb9", { scope: "team", unit: "per9" })!;
    const [area] = teamReportCard(null, summary([{ metric: "pitching_bb9", label: "BB/9", value: 99, unit: "per9", pending: false }]));
    expect(area.grade).toBe("F");
    expect(area.next).toEqual({ grade: "D", target: benchmarkNumber(Math.max(...bb9.cuts), "pitching_bb9", "per9"), direction: "lower" });
    const [top] = teamReportCard(summary([{ metric: "batting_obp", label: "OBP", value: .9, unit: "avg", pending: false }]), null);
    expect(top.next).toBeNull();
  });
});
