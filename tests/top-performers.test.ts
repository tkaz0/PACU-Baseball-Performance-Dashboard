import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TOP_PERFORMER_METRICS, topPerformers, type TopDiscipline } from "@/lib/top-performers";
import { TopPerformers } from "@/components/top-performers";
import type { CoachingGame, CoachingPlayer } from "@/lib/coaching-tools";

// Fictional fixtures only; no production data.
export const fictionalRankingData = (discipline: TopDiscipline, values: number[][]) => {
  const metrics = TOP_PERFORMER_METRICS[discipline];
  const players: CoachingPlayer[] = values.map((_, i) => ({id: `fictional-${i}`, code: `SYN-${i}`, name: `Fictional Player ${i + 1}`, position: discipline === "hitting" ? "SS" : "P", secondaryPosition: "", playerType: discipline === "hitting" ? "position" : "pitcher", academicClass: "Junior", bats: "R", throws: "R"}));
  const games: CoachingGame[] = values.flatMap((line, i) => line.map((value, j) => ({athleteId: players[i].id, snapshotId: "fictional-snapshot", source: discipline === "hitting" ? "qpa_fall_2026" : "pitching_fall_2026", eventId: discipline === "hitting" ? "" : "fall-2026-cumulative", metric: metrics[j].key, label: metrics[j].label, unit: metrics[j].unit, value, opportunities: 10, updatedAt: "2026-09-28T20:00:00Z", playedOn: null, direction: metrics[j].direction, insightEligible: true})));
  return {players, games};
};
describe("blended Top Performers ranking", () => {
  it("rewards a balanced complete line rather than only the highest production stat", () => {
    const data = fictionalRankingData("hitting", [[200,10,.1,.01],[150,80,.5,.4],[120,60,.4,.3],[100,40,.3,.2],[80,20,.2,.1]]);
    const rows = topPerformers(data,"hitting");
    expect(rows.map(r=>r.player.id)).toEqual(["fictional-1","fictional-2","fictional-3","fictional-0","fictional-4"]);
    expect(rows[0].score).toBe(93.75);
    expect(rows.at(-1)?.score).toBe(18.75);
    expect(rows.map(r=>r.rank)).toEqual([1,2,3,4,5]);
    expect(rows.every(r=>r.cohortSize===5)).toBe(true);
  });
  it("inverts WHIP and Runs/9, and gives each pitching component exactly one-third weight", () => {
    const rows = topPerformers(fictionalRankingData("pitching", [[.8,5,1],[1,4,2],[1.2,3,3],[1.4,2,4],[1.6,1,5]]),"pitching");
    expect(rows.map(r=>r.score)).toEqual([100,75,50,25,0]);
    expect(rows[0].percentiles).toEqual({pitching_whip:100,pitching_k_bb:100,pitching_r9:100});
  });
  it("shares competition ranks for equal blends, regardless of the order of component strengths", () => {
    const data = fictionalRankingData("hitting", [[200,20,.2,.2],[100,50,.5,.5],[150,30,.4,.1],[50,10,.1,.3],[180,40,.3,.4]]);
    const rows = topPerformers(data,"hitting");
    const tied = rows.filter(r=>["fictional-0","fictional-2"].includes(r.player.id));
    expect(tied.map(r=>[r.score,r.rank])).toEqual([[43.75,3],[43.75,3]]);
    expect(rows.at(-1)?.rank).toBe(5);
    expect(topPerformers({...data,players:[...data.players].reverse(),games:[...data.games].reverse()},"hitting")).toEqual(rows);
  });
  it("gives equal lines a neutral 50 and does not invent percentiles for fewer than five", () => {
    expect(topPerformers(fictionalRankingData("pitching",Array(5).fill([1,2,3])),"pitching").map(r=>[r.score,r.rank])).toEqual(Array(5).fill([50,1]));
    const small = topPerformers(fictionalRankingData("pitching",Array(4).fill([1,2,3])),"pitching");
    expect(small.every(r=>r.score===null&&r.rank===null&&r.pending==="small_cohort")).toBe(true);
  });
  it("keeps missing, duplicate, negative, nonfinite or wrong-unit components unranked without changing the complete cohort", () => {
    for (const replacement of [null,{value:-1},{value:Infinity},{unit:"wrong"},"duplicate"] as const) {
      const data=fictionalRankingData("hitting",Array(6).fill([100,50,.4,.2]));
      const original=data.games[0];data.games=data.games.filter(g=>g!==original);
      if(replacement==="duplicate")data.games.push(original,original);
      else if(replacement)data.games.push({...original,...replacement});
      const rows=topPerformers(data,"hitting"),missing=rows.find(r=>r.player.id===original.athleteId)!;
      expect(missing.score).toBeNull();expect(missing.rank).toBeNull();expect(missing.pending).toBe("missing_stats");
      expect(rows.filter(r=>r.score===50&&r.rank===1)).toHaveLength(5);
    }
  });
  it("does not mix raw weekly or unrelated sources, and refuses mixed source snapshots", () => {
    for(const patch of [{eventId:"fall-2026-week-1"},{source:"Full Swing · Practice"}]){
      const data=fictionalRankingData("pitching",Array(5).fill([1,2,3]));data.games=data.games.map(g=>({...g,...patch}));
      expect(topPerformers(data,"pitching")).toEqual([]);
    }
    const data=fictionalRankingData("pitching",Array(5).fill([1,2,3]));data.games[0].snapshotId="different-snapshot";
    expect(topPerformers(data,"pitching").every(r=>r.score===null&&r.pending==="mixed_snapshots")).toBe(true);
  });
  it("includes two-way players in both comparisons and retains early sample sizes", () => {
    const hitters=fictionalRankingData("hitting",Array(5).fill([100,50,.4,.2]));
    const pitchers=fictionalRankingData("pitching",Array(5).fill([1,2,3]));
    const data={players:hitters.players.map(p=>({...p,playerType:"two_way",secondaryPosition:"P"})),games:[...hitters.games,...pitchers.games]};
    for(const discipline of ["hitting","pitching"] as const){
      const rows=topPerformers(data,discipline);expect(rows).toHaveLength(5);expect(rows.every(r=>r.rank===1)).toBe(true);
      expect(Object.values(rows[0].stats).every(g=>g?.opportunities===10)).toBe(true);
    }
  });
  it("renders the overall score, exact contributing stats, sample sizes and method without an individual-stat sort", () => {
    const html=renderToStaticMarkup(createElement(TopPerformers,{data:fictionalRankingData("hitting",Array(5).fill([100,50,.4,.2]))}));
    expect(html).toContain("Overall Score");expect(html).toContain("50.0");expect(html).toContain("equal weight");expect(html).toContain("25%");
    expect(html).toContain("10 PA");expect(html).toContain("Early sample");expect(html).toContain('aria-sort="descending"');
    expect(html).not.toContain('Rank hitting by');
    for (const metric of TOP_PERFORMER_METRICS.hitting) expect(html).toContain(metric.label);
  });
});
