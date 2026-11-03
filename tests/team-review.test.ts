import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GameWeek } from "@/lib/game-weeks";
import { teamGameSummary } from "@/lib/team-game-stats";
import { teamReviewThemes, teamReviewTrends, teamStatLeaders } from "@/lib/team-review";
import type { GameLeaderboardRow } from "@/lib/game-metrics";
import { TeamReviewSheet } from "@/components/team-review-sheet";
import type { ReportCardArea } from "@/lib/team-report-card";

// Fictional fixtures only.
function week(kind: "hitting" | "pitching", n: number, counts: Record<string, Record<string, number>>, eventId?: string): GameWeek {
  const source = kind === "hitting" ? "qpa_fall_2026" : "pitching_fall_2026";
  return { week: n, label: `Week ${n}`, detail: `Fictional period ${n}`, source, withheld: 0,
    rows: Object.entries(counts).flatMap(([athlete_id, values]) => Object.entries(values).map(([metric, value]) => ({
      athlete_id, metric, value, source, unit: "count", scope: kind === "hitting" ? "cumulative_fall" : "pitching_event",
      event_id: kind === "hitting" ? null : eventId ?? `fall-2026-week-${n}`, played_on: null, snapshot_id: `fictional-${n}`, content_hash: `hash-${n}`,
      fetched_at: "2026-10-12T18:00:00Z", source_row: 2, source_column: 1, derived_from: [],
    }))) } as GameWeek;
}
const hit = (h: number, bb = 0) => ({ pa: 10 + bb, ab: 10, base_hit: h, hh_extra_base_hit: 0, pumps: 0, bb, hbp: 0, sac_fly: 0, punchies: 2, qpa: 5 });
const pitch = (h: number) => ({ innings_outs: 9, h, bb_outcome: 1, k: 3, r: 1, pitches: 40, strikes: 25 });

describe("team review sheet", () => {
  const weeks = { hitting: [week("hitting", 1, { "SYN-1": hit(2), "SYN-2": hit(3) }), week("hitting", 2, { "SYN-1": hit(4), "SYN-2": hit(1, 2) })],
    pitching: [week("pitching", 1, { "SYN-1": pitch(4) })],
    bws: { hitting: week("hitting", 0, { "SYN-1": hit(5) }), pitching: week("pitching", 0, { "SYN-1": pitch(2) }, "fall-2026-bws") } };
  it("pools each week's counts into team rates, adds BWS as its own column and ends with the Fall line", () => {
    const fall = { batting: teamGameSummary(weeks.hitting[1].rows, "qpa_fall_2026"), pitching: teamGameSummary(weeks.pitching[0].rows, "pitching_fall_2026") };
    const t = teamReviewTrends(weeks, fall, { batting_obp: "OBP" });
    expect(t.columns.map(c => c.label)).toEqual(["Wk 1", "Wk 2", "BWS", "Fall"]);
    const obp = t.hitting.find(r => r.metric === "batting_obp")!;
    expect(obp.label).toBe("OBP");
    expect(obp.cells[0]?.value).toBe(".250"); // (2 + 3) / 20
    expect(obp.cells[2]?.value).toBe(".500"); // BWS only
    // Week 2 pitching was not recorded: an empty cell, never zero.
    expect(t.pitching.find(r => r.metric === "pitching_whip")!.cells[1]).toBeNull();
  });
  it("splits report-card areas into strengths (B+) and focus areas (D/F), leaving C out", () => {
    const area = (key: string, level: number) => ({ key, level, grade: "FDCBA"[level], label: key } as unknown as ReportCardArea);
    const { working, focus } = teamReviewThemes([area("a", 4), area("b", 2), area("c", 0), area("d", 1), area("e", 3)]);
    expect(working.map(a => a.key)).toEqual(["a", "e"]);
    expect(focus.map(a => a.key)).toEqual(["c", "d"]);
  });
  it("renders two light pages with honest empty states", () => {
    const html = renderToStaticMarkup(createElement(TeamReviewSheet, { data: { generated: "2026-11-03", batting: null, pitching: null, reportCard: [],
      trends: teamReviewTrends(null, { batting: null, pitching: null }, {}), races: null, hittingLeaders: [], pitchingLeaders: [], qualifiedLabel: null, hitters: [], pitchers: [], records: [], headshots: {} } }));
    expect(html).toContain("Fall 2026 in Review"); expect(html).toContain("Week by Week");
    expect(html).toContain("Needs five complete lines to rank."); expect(html).toContain("No testing records saved."); expect(html).not.toContain("Team Goals");
    expect(html.match(/aria-label="Team review, (front|back)"/g)).toHaveLength(2);
  });
  it("lists stat leaders: qualified players for rates (ties together), everyone for counts, lower-is-better reversed", () => {
    const row = (code: string, metric: string, value: number, unit: string, opportunities = 20): GameLeaderboardRow => ({ metric, source: "qpa_fall_2026", eventId: "", playedOn: null, value, unit, rank: 1, name: `Fictional ${code}`, code, profileId: null, updatedAt: "2026-11-01T00:00:00Z", opportunities, percentile: null, sampleSize: 3 });
    const rows = [row("PAC-0001", "batting_avg", .5, "avg", 2), row("PAC-0002", "batting_avg", .4, "avg"), row("PAC-0003", "batting_avg", .4, "avg"),
      row("PAC-0002", "batting_k_pct", 20, "%"), row("PAC-0003", "batting_k_pct", 10, "%"), row("PAC-0001", "pumps", 3, "count")];
    const leaders = teamStatLeaders(rows, "hitting", new Set(["PAC-0002", "PAC-0003"]), {});
    expect(leaders.find(l => l.metric === "batting_avg")).toMatchObject({ value: ".400", names: ["Fictional PAC-0002", "Fictional PAC-0003"], sample: null });
    
    expect(leaders.find(l => l.metric === "pumps")).toMatchObject({ label: "Home Runs", value: "3", names: ["Fictional PAC-0001"] });
  });
});
