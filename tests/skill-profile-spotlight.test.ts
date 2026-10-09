import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AwardBadges, SkillProfile } from "@/components/skill-profile";
import type { RankingRow } from "@/components/percentile-rankings";
import { homeSpotlight } from "@/lib/home-spotlight";
import type { HomeLeaderboard } from "@/lib/home-leaderboards";
import { fictionalRankingData } from "./top-performers.test";

// Fictional fixtures only; no production data.
const row = (metric: string, percentile: number, game = true, source = "qpa_fall_2026"): RankingRow => ({ key: `${metric}:${source}`, label: metric.toUpperCase(), value: "1", percentile, sampleSize: 8, metric, game, guide: { value: 1, unit: "avg", source } });

describe("skill profile radar", () => {
  it("draws a radar only with at least three verified axes and never a combined score", () => {
    expect(renderToStaticMarkup(createElement(SkillProfile, { rows: [row("qpa_pct", 60), row("batting_obp", 40)] }))).toBe("");
    const html = renderToStaticMarkup(createElement(SkillProfile, { rows: [row("qpa_pct", 60), row("batting_obp", 40), row("batting_est_iso", 90)] }));
    expect(html).toContain("Hitting skill profile");
    expect(html).not.toContain("Pitching skill profile");
    expect(html).toContain("not a combined score");
  });
  it("prefers the In-Game Full Swing reading over Practice for one axis", () => {
    const html = renderToStaticMarkup(createElement(SkillProfile, { rows: [row("qpa_pct", 60), row("batting_obp", 40),
      row("max_exit_velocity", 20, false, "Full Swing · Practice"), row("max_exit_velocity", 80, false, "Full Swing · Game")] }));
    expect(html).toContain("Max EV 80th percentile");
    expect(html).not.toContain("Max EV 20th");
  });
});

describe("award badges", () => {
  it("labels only the sole leader as Team best and 90th+ as Top 10%", () => {
    const html = renderToStaticMarkup(createElement(AwardBadges, { rows: [row("qpa_pct", 100), row("batting_obp", 92), row("batting_est_iso", 89.9)] }));
    expect(html).toContain("Team best · QPA_PCT");
    expect(html).toContain("Top 10% · BATTING_OBP");
    expect(html).not.toContain("BATTING_EST_ISO");
    expect(renderToStaticMarkup(createElement(AwardBadges, { rows: [row("qpa_pct", 50)] }))).toBe("");
  });
});

describe("home spotlight", () => {
  const board: HomeLeaderboard = { key: "bat", category: "Hitting · Practice", title: "Average Bat Speed", href: "/leaderboards", total: 2, yourRank: null,
    rows: [{ rank: 1, code: "SYN-9", name: "Fictional Slugger", profileId: "fictional-9", value: "70.1 mph", sample: "40 swings", isYou: false }, { rank: 2, code: "SYN-8", name: "Fictional Two", profileId: null, value: "65.0 mph", isYou: false }] };
  it("features the #1 hitter, #1 pitcher and practice bat-speed leader", () => {
    const hitting = fictionalRankingData("hitting", [[200,10,.1,.01],[150,80,.5,.4],[120,60,.4,.3],[100,40,.3,.2],[80,20,.2,.1]]);
    const pitching = fictionalRankingData("pitching", [[.8,5,1],[1,4,2],[1.2,3,3],[1.4,2,4],[1.6,1,5]]);
    pitching.players.forEach(p => { p.id = `p-${p.id}`; p.code = `P-${p.code}`; });
    pitching.games.forEach(g => { g.athleteId = `p-${g.athleteId}`; });
    const cards = homeSpotlight({ players: [...hitting.players, ...pitching.players], games: [...hitting.games, ...pitching.games] }, [board]);
    expect(cards.map(card => [card.title, card.name, card.headline.value])).toEqual([
      ["Top Hitter", "Fictional Player 2", "150"], ["Top Pitcher", "Fictional Player 1", "0.80"], ["Practice Standout", "Fictional Slugger", "70.1 mph"]]);
    expect(cards[2].sample).toBe("40 swings");
  });
  it("omits leaders without a complete ranking instead of inventing one", () => {
    expect(homeSpotlight(fictionalRankingData("hitting", [[1,1,1,1]]), [])).toEqual([]);
  });
});
