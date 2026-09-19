import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LeaderboardBoard } from "@/components/leaderboard-board";
import { selectPitchLeaderboards, leaderboardMetrics, visibleLeaderboardComparisons, type LeaderboardComparison, type LeaderboardRow } from "@/lib/leaderboards";
const base:LeaderboardComparison={metricKey:"classified_avg_velocity",source:"full swing · intrasquad · four-seam fastball",unit:"mph",period:"fall_2026",athleteCount:3};
it("keeps every recorded pitch type and all four metrics, separated from Practice",()=>{
 const options:LeaderboardComparison[]=[base,{...base,source:"full swing · intrasquad · slider"},{...base,source:"full swing · practice · four-seam fastball",athleteCount:20},{...base,metricKey:"classified_max_velocity"},{...base,metricKey:"classified_avg_spin",unit:"rpm"},{...base,metricKey:"classified_max_spin",unit:"rpm"}];
 expect(visibleLeaderboardComparisons("pitching",options,"in_game")).toHaveLength(5);
 expect(visibleLeaderboardComparisons("pitching",options,"practice")).toEqual([options[2]]);
});
it("splits ordinary hitting and pitching protocols before selecting the displayed comparison",()=>{
 const inGame={...base,metricKey:"avg_exit_velocity" as const,source:"full swing · intrasquad"};
 const practice={...inGame,source:"full swing · hitting",athleteCount:15};
 expect(visibleLeaderboardComparisons("hitting",[inGame,practice],"in_game")).toEqual([inGame]);
 expect(visibleLeaderboardComparisons("hitting",[inGame,practice],"practice")).toEqual([practice]);
});
it("groups pitch rankings with clear labels, one decimal and session links without mixing results",()=>{
 const row:LeaderboardRow={rank:1,athleteCode:"SYN-001",name:"Fictional Pitcher",jerseyNumber:1,position:"P",profileId:null,value:81.234,measuredAt:"2026-09-11",source:base.source,derived:false};
 const html=renderToStaticMarkup(createElement(LeaderboardBoard,{group:"pitching",session:"in_game",pitches:["Four-Seam Fastball", "Slider"], selectedPitch:"Four-Seam Fastball",panels:[{comparison:base,rows:[row]}]}));
 expect(html).toContain("Four-Seam Fastball");expect(html).toContain("FB (4-Seam) · Average Velocity");expect(html).toContain("81.2");expect(html).not.toContain("81.234");
 expect(html).toContain('aria-label="Leaderboard session"');expect(html).toContain('session=practice');expect(html).toContain('<select');expect(html).toContain('name="pitch"');expect(html).toContain('value="Four-Seam Fastball"');
 const empty=renderToStaticMarkup(createElement(LeaderboardBoard,{group:"hitting",session:"practice",panels:[]}));
 expect(empty).toContain("Practice rankings will appear");expect(empty).not.toContain("<table");
});

it("isolates position throws and removes unclassified overall pitching cards",()=>{
 expect(leaderboardMetrics("throwing").map(m=>m.key)).toEqual(["infield_velocity","outfield_velocity"]);
 expect(leaderboardMetrics("pitching").map(m=>m.key)).toEqual(["classified_avg_velocity","classified_max_velocity","classified_avg_spin","classified_max_spin"]);
 const overall:LeaderboardComparison={...base,metricKey:"max_pitch_velocity",source:"full swing · intrasquad"};
 const field:LeaderboardComparison={...overall,metricKey:"infield_velocity"};
 expect(visibleLeaderboardComparisons("pitching",[base,overall,field])).toEqual([base]);
 expect(visibleLeaderboardComparisons("throwing",[base,overall,field])).toEqual([field]);
});
it("selects only one recorded pitch before loading rows, without merging source contexts",()=>{
 const slider={...base,source:"full swing · intrasquad · slider"};
 const game={...slider,source:"full swing · game · slider"};
 const unknown={...base,source:"full swing · intrasquad · unassigned"};
 const options=[slider,base,game,unknown];
 expect(selectPitchLeaderboards(options,"Slider")).toEqual({pitches:["Four-Seam Fastball","Slider"],selectedPitch:"Slider",comparisons:[slider,game]});
 expect(selectPitchLeaderboards(options,"not a pitch").comparisons).toEqual([base]);
 expect(selectPitchLeaderboards(options.toReversed()).selectedPitch).toBe("Four-Seam Fastball");
 expect(selectPitchLeaderboards([unknown]).comparisons).toEqual([]);
 expect(selectPitchLeaderboards([],"Slider")).toEqual({pitches:[],selectedPitch:undefined,comparisons:[]});
});
it("withholds other pitch panels and keeps the chosen pitch in session navigation",()=>{
 const row:LeaderboardRow={rank:1,athleteCode:"SYN-001",name:"Fictional Pitcher",jerseyNumber:1,position:"P",profileId:null,value:81.234,measuredAt:"2026-09-11",source:base.source,derived:false};
 const slider={...base,source:"full swing · intrasquad · slider"};
 const output=renderToStaticMarkup(createElement(LeaderboardBoard,{group:"pitching",session:"in_game",selectedPitch:"Slider",pitches:["Four-Seam Fastball","Slider"],panels:[{comparison:base,rows:[row]},{comparison:slider,rows:[{...row,source:slider.source,value:65.777}]}]}));
 expect(output).toContain("SL · Average Velocity");expect(output).not.toContain("FB (4-Seam) · Average Velocity");
 expect(output).toContain("65.8");expect(output).not.toContain("81.2");
 expect(output).toContain("session=practice&amp;pitch=Slider");
});
