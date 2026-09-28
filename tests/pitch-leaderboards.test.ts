import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { LeaderboardBoard } from "@/components/leaderboard-board";
import { ALL_PITCHES, PITCH_LEADERBOARD_KEYS, loadLeaderboardPanels, selectPitchLeaderboards, leaderboardMetrics, visibleLeaderboardComparisons, type LeaderboardComparison, type LeaderboardRow } from "@/lib/leaderboards";
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
it("defaults to all recorded pitches and supports a single-pitch focus without merging source contexts",()=>{
 const slider={...base,source:"full swing · intrasquad · slider"};
 const game={...slider,source:"full swing · game · slider"};
 const unknown={...base,source:"full swing · intrasquad · unassigned"};
 const options=[slider,base,game,unknown];
 expect(selectPitchLeaderboards(options,"Slider")).toEqual({pitches:["Four-Seam Fastball","Slider"],selectedPitch:"Slider",comparisons:[slider,game]});
 expect(selectPitchLeaderboards(options).comparisons).toEqual([slider,base,game]);
 expect(selectPitchLeaderboards(options,ALL_PITCHES).comparisons).toEqual([slider,base,game]);
 expect(selectPitchLeaderboards(options,"not a pitch").comparisons).toEqual([slider,base,game]);
 expect(selectPitchLeaderboards(options.toReversed()).selectedPitch).toBe(ALL_PITCHES);
 expect(selectPitchLeaderboards([unknown]).comparisons).toEqual([]);
 expect(selectPitchLeaderboards([],"Slider")).toEqual({pitches:[],selectedPitch:ALL_PITCHES,comparisons:[]});
});
it("withholds other pitch panels and keeps the chosen pitch in session navigation",()=>{
 const row:LeaderboardRow={rank:1,athleteCode:"SYN-001",name:"Fictional Pitcher",jerseyNumber:1,position:"P",profileId:null,value:81.234,measuredAt:"2026-09-11",source:base.source,derived:false};
 const slider={...base,source:"full swing · intrasquad · slider"};
 const output=renderToStaticMarkup(createElement(LeaderboardBoard,{group:"pitching",session:"in_game",selectedPitch:"Slider",pitches:["Four-Seam Fastball","Slider"],panels:[{comparison:base,rows:[row]},{comparison:slider,rows:[{...row,source:slider.source,value:65.777}]}]}));
 expect(output).toContain("SL · Average Velocity");expect(output).not.toContain("FB (4-Seam) · Average Velocity");
 expect(output).toContain("65.8");expect(output).not.toContain("81.2");
 expect(output).toContain("session=practice&amp;pitch=Slider");
});

it("renders the entire arsenal in separate pitch and context sections with all four measurements",()=>{
 const row:LeaderboardRow={rank:1,athleteCode:"SYN-001",name:"Fictional Pitcher",jerseyNumber:1,position:"P",profileId:null,value:81.234,measuredAt:"2026-09-11",source:base.source,derived:true,sampleCount:12,sampleUnit:"pitches"};
 const sources=[base.source,"full swing · intrasquad · slider","full swing · game · slider"];
 const panels=sources.flatMap((source,index)=>PITCH_LEADERBOARD_KEYS.map(metricKey=>({comparison:{...base,source,metricKey,unit:metricKey.endsWith("spin")?"rpm":"mph"},rows:[{...row,source,value:metricKey.endsWith("spin")?1900.234+index*100:81.234-index*10}]})));
 const output=renderToStaticMarkup(createElement(LeaderboardBoard,{group:"pitching",session:"in_game",pitches:["Four-Seam Fastball","Slider"],panels}));
 expect(output).toContain('<option value="all" selected="">All Pitches</option>');
 expect(output).toContain('aria-label="Four-Seam Fastball · Full Swing · Intrasquad · Fall 2026 rankings"');
 expect(output).toContain('aria-label="Slider · Full Swing · Intrasquad · Fall 2026 rankings"');
 expect(output).toContain('aria-label="Slider · Full Swing · Game · Fall 2026 rankings"');
 expect(output.match(/Mean of 1 player /g)).toHaveLength(12);
 expect(output.match(/<table>/g)).toHaveLength(12);
 expect(output).toContain("FB (4-Seam) · Average Velocity");
 expect(output).toContain("FB (4-Seam) · Max Velocity");
 expect(output).toContain("FB (4-Seam) · Average Spin");
 expect(output).toContain("FB (4-Seam) · Max Spin");
 expect(output).toContain("SL · Average Spin");
 expect(output).toContain("81.2");expect(output).toContain("71.2");expect(output).toContain("61.2");
 expect(output).toContain("1900.2");expect(output).toContain("12 pitches");
 expect(output).not.toContain("81.234");expect(output).not.toContain('href="/athletes/');
 expect(output).toContain('href="/leaderboards?group=pitching&amp;session=practice"');
});

it("loads an entire arsenal with at most four concurrent reads and preserves comparison order",async()=>{
 vi.useFakeTimers();
 try {
  const options=Array.from({length:13},(_,index)=>({...base,athleteCount:index+1}));
  let active=0;let maximum=0;
  const reads=loadLeaderboardPanels(options,async comparison=>{
   active++;maximum=Math.max(maximum,active);
   await new Promise(resolve=>setTimeout(resolve,100-(comparison.athleteCount%4)*10));
   active--;
   return [];
  });
  expect(active).toBe(4);
  await vi.runAllTimersAsync();
  expect((await reads).map(panel=>panel.comparison)).toEqual(options);
  expect(maximum).toBe(4);expect(active).toBe(0);
 } finally {vi.useRealTimers();}
});

it("makes no read for an empty selection and propagates a failed read instead of returning partial rankings",async()=>{
 const emptyReader=vi.fn(async()=>[]);
 expect(await loadLeaderboardPanels([],emptyReader)).toEqual([]);
 expect(emptyReader).not.toHaveBeenCalled();
 await expect(loadLeaderboardPanels([base],async()=>{throw new Error("Unavailable");})).rejects.toThrow("Unavailable");
});
