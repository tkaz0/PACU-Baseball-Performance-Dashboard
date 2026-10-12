import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({useRouter: () => ({refresh: vi.fn()})}));
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { trendingPlayers } from "@/lib/home-trending";
import { HomeTrending } from "@/components/home-trending";
import type { WeekPlayer } from "@/lib/home-spotlight";
import type { GameWeek } from "@/lib/game-weeks";
import { DashboardHome } from "@/components/dashboard-home";

// Fictional fixtures only.
const players: WeekPlayer[] = Array.from({length: 5}, (_, i) => ({ id: `SYN-${i}`, code: `SYN-${i}`, name: `Fictional Player ${i}`,
  profileId: i ? null : "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", playerType: "two_way", position: "SS", secondaryPosition: "P", academicClass: "Junior", bats: "R", throws: "R" }));
function week(kind: "hitting" | "pitching", n: number, counts: Record<string, Record<string, number>>): GameWeek {
  const source = kind === "hitting" ? "qpa_fall_2026" : "pitching_fall_2026";
  return { week: n, label: `Week ${n}`, detail: `Fictional period ${n}`, source, withheld: 0,
    rows: Object.entries(counts).flatMap(([athlete_id, values]) => Object.entries(values).map(([metric, value]) => ({
      athlete_id, metric, value, source, unit: "count", scope: kind === "hitting" ? "cumulative_fall" : "pitching_event",
      event_id: kind === "hitting" ? null : `fall-2026-week-${n}`, played_on: null, snapshot_id: `fictional-${n}`, content_hash: `hash-${n}`,
      fetched_at: "2026-10-12T18:00:00Z", source_row: 2, source_column: 1, derived_from: [],
    }))) };
}
const hit = (h: number) => ({pa: 10, ab: 10, base_hit: h, hh_extra_base_hit: 0, pumps: 0, bb: 0, hbp: 0, sac_fly: 0});
const pitch = (h: number, outs = 9) => ({innings_outs: outs, h, bb_outcome: 1});
const weeks = () => ({ hitting: [week("hitting", 1, {"SYN-0": hit(2), "SYN-1": hit(2)}), week("hitting", 2, {"SYN-0": hit(4), "SYN-1": hit(3)})],
  pitching: [week("pitching", 1, {"SYN-0": pitch(5), "SYN-1": pitch(4)}), week("pitching", 2, {"SYN-0": pitch(2), "SYN-1": pitch(6)})] });

describe("staff Trending Up", () => {
  it("compares individual weekly OPS and WHIP, keeps exact samples and improvement direction", () => {
    const [hitting, pitching] = trendingPlayers(players, weeks());
    expect(hitting.comparable).toBe(2);
    expect(hitting.players[0]).toMatchObject({code: "SYN-0", before: .4, after: .8, change: .4, beforeSample: "10 PA", afterSample: "10 PA"});
    expect(pitching.players).toHaveLength(1);
    expect(pitching.players[0]).toMatchObject({code: "SYN-0", before: 2, after: 1, change: -1, beforeSample: "3.0 IP", afterSample: "3.0 IP"});
    const html = renderToStaticMarkup(createElement(HomeTrending, {groups: [hitting, pitching]}));
    expect(html).toContain("+0.400"); expect(html).toContain("−1.00"); expect(html).toContain("10 PA");
    expect(html).toContain("?tab=game-stats"); expect(html).toContain("not percent");
  });
  it("does not use a missing week, missing player, missing count, duplicate or wrong source/unit", () => {
    const missing = weeks(); missing.hitting[1].week = 3;
    expect(trendingPlayers(players, missing)[0].players).toEqual([]);
    for (const edit of [
      (w: GameWeek) => { w.rows = w.rows.filter(r => r.athlete_id !== "SYN-0"); },
      (w: GameWeek) => { w.rows = w.rows.filter(r => r.athlete_id !== "SYN-0" || r.metric !== "hh_extra_base_hit"); },
      (w: GameWeek) => { w.rows.push({...w.rows[0]}); },
      (w: GameWeek) => { w.rows[0].unit = "%"; },
      (w: GameWeek) => { w.rows[0].source = "pitching_fall_2026"; },
      (w: GameWeek) => { w.rows.find(r => r.athlete_id === "SYN-0" && r.metric === "base_hit")!.value = 100; },
    ]) {
      const changed = weeks(); edit(changed.hitting[1]);
      expect(trendingPlayers(players, changed)[0].players.some(p => p.code === "SYN-0")).toBe(false);
    }
  });
  it("respects roster roles, ambiguous codes, and does not replace an empty newest week", () => {
    const rolePlayers = players.map(p => ({...p, playerType: "pitcher"}));
    expect(trendingPlayers(rolePlayers, weeks())[0].comparable).toBe(0);
    expect(trendingPlayers([...players, {...players[0]}], weeks())[0].players.some(p => p.code === "SYN-0")).toBe(false);
    const empty = weeks(); empty.pitching.push(week("pitching", 3, {}));
    expect(trendingPlayers(players, empty)[1].comparable).toBe(0);
  });
  it("uses each week's denominator, discloses ties and limits each list to three", () => {
    const tied = {hitting: [1,2].map(n => week("hitting", n, Object.fromEntries(players.map(p => [p.code, hit(n)])))),
      pitching: [week("pitching", 1, {"SYN-0": pitch(5, 6)}), week("pitching", 2, {"SYN-0": pitch(5, 12)})]};
    const [hitting, pitching] = trendingPlayers(players, tied);
    expect(hitting.players).toHaveLength(3); expect(hitting.players.every(p => p.tied)).toBe(true);
    expect(pitching.players[0]).toMatchObject({before:3, after:1.5, beforeSample:"2.0 IP", afterSample:"4.0 IP"});
  });
  it("renders an honest empty/failure state and never mounts the staff slot in Player Home", () => {
    const html = renderToStaticMarkup(createElement(HomeTrending, {groups: trendingPlayers(players, {hitting:[],pitching:[]})}));
    expect(html).toContain("Needs two consecutive weeks");
    expect(renderToStaticMarkup(createElement(HomeTrending, {groups:null}))).toContain("temporarily unavailable");
    expect(renderToStaticMarkup(createElement(DashboardHome, {staff:false,athleteId:null,summary:null,trending:createElement("p",null,"private-trending-fixture")}))).not.toContain("private-trending-fixture");
  });
});
