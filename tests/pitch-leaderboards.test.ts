import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LeaderboardBoard } from "@/components/leaderboard-board";
import { visibleLeaderboardComparisons, type LeaderboardComparison, type LeaderboardRow } from "@/lib/leaderboards";
const base:LeaderboardComparison={metricKey:"classified_avg_velocity",source:"full swing · intrasquad · four-seam fastball",unit:"mph",period:"fall_2026",athleteCount:3};
it("keeps every recorded pitch type and all four metrics, separated from Practice",()=>{
 const options:LeaderboardComparison[]=[base,{...base,source:"full swing · intrasquad · slider"},{...base,source:"full swing · practice · four-seam fastball",athleteCount:20},{...base,metricKey:"classified_max_velocity"},{...base,metricKey:"classified_avg_spin",unit:"rpm"},{...base,metricKey:"classified_max_spin",unit:"rpm"}];
 expect(visibleLeaderboardComparisons("throwing",options,"in_game")).toHaveLength(5);
 expect(visibleLeaderboardComparisons("throwing",options,"practice")).toEqual([options[2]]);
});
it("splits ordinary hitting and pitching protocols before selecting the displayed comparison",()=>{
 const inGame={...base,metricKey:"avg_exit_velocity" as const,source:"full swing · intrasquad"};
 const practice={...inGame,source:"full swing · hitting",athleteCount:15};
 expect(visibleLeaderboardComparisons("hitting",[inGame,practice],"in_game")).toEqual([inGame]);
 expect(visibleLeaderboardComparisons("hitting",[inGame,practice],"practice")).toEqual([practice]);
});
it("groups pitch rankings with clear labels, one decimal and session links without mixing results",()=>{
 const row:LeaderboardRow={rank:1,athleteCode:"SYN-001",name:"Fictional Pitcher",jerseyNumber:1,position:"P",profileId:null,value:81.234,measuredAt:"2026-09-11",source:base.source,derived:false};
 const html=renderToStaticMarkup(createElement(LeaderboardBoard,{group:"throwing",session:"in_game",panels:[{comparison:base,rows:[row]}]}));
 expect(html).toContain("Four-Seam Fastball");expect(html).toContain("FB (4-Seam) · Average Velocity");expect(html).toContain("81.2");expect(html).not.toContain("81.234");
 expect(html).toContain('aria-label="Leaderboard session"');expect(html).toContain('session=practice');expect(html).not.toContain('<select');
 const empty=renderToStaticMarkup(createElement(LeaderboardBoard,{group:"hitting",session:"practice",panels:[]}));
 expect(empty).toContain("Practice rankings will appear");expect(empty).not.toContain("<table");
});
