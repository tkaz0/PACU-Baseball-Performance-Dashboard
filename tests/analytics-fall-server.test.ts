import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({board:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/leaderboard-server",()=>({loadLeaderboard:mocks.board}));
vi.mock("@/lib/testing-checklist",()=>({pacificTestingDate:()=>"2026-10-05"}));
import { loadAnalyticsFallReadings } from "@/lib/analytics-fall-server";
import { analyticsVariables, pairAnalytics, variableKey, type AnalyticsPlayer, type AnalyticsReading } from "@/lib/analytics";
import type { LeaderboardSelection } from "@/lib/leaderboards";
const player:AnalyticsPlayer={id:"fictional-player",code:"SYN-001",name:"Fictional Player",academicClass:"freshman",position:"OF",playerType:"two_way",bats:"R",throws:"R"};
const access={} as Parameters<typeof loadAnalyticsFallReadings>[0];
const reading=(metric:string,overrides:Partial<AnalyticsReading>={}):AnalyticsReading=>({id:`fictional-${metric}`,athleteId:player.id,metric,label:metric,source:"Full Swing · Intrasquad",unit:"mph",date:"2026-09-26",value:100,importedAt:"2026-10-04T12:00:00Z",...overrides});
const boardRow=(s:LeaderboardSelection,value:number,derived=true)=>({rank:1,athleteCode:player.code,name:player.name,profileId:null,jerseyNumber:1,position:"OF",value,measuredAt:"2026-09-26",source:s.source,derived,sampleCount:20,sampleUnit:"swings"});
beforeEach(()=>{vi.resetAllMocks();mocks.board.mockResolvedValue([]);});

it("replaces latest one-swing EV equality with distinct verified Fall max and average, on both chart axes",async()=>{
 const raw=[reading("max_exit_velocity"),reading("avg_exit_velocity"),reading("avg_exit_velocity",{id:"older",date:"2026-09-11",value:72})];
 mocks.board.mockImplementation(async(_access,s:LeaderboardSelection)=>[boardRow(s,s.metricKey==="max_exit_velocity"?105:78.123456)]);
 const result=await loadAnalyticsFallReadings(access,[player],raw);
 expect(result).toHaveLength(2);expect(raw[1].value).toBe(100);
 const max=result.find(r=>r.metric==="max_exit_velocity")!,avg=result.find(r=>r.metric==="avg_exit_velocity")!;
 expect(max).toMatchObject({value:105,basis:"fall-best"});expect(avg).toMatchObject({value:78.123456,basis:"fall-average"});
 expect(analyticsVariables(result).map(v=>v.metric).sort()).toEqual(["avg_exit_velocity","max_exit_velocity"]);
 const points=pairAnalytics([player],result,variableKey(max),variableKey(avg),0).points;
 expect(points[0].x.value).toBe(105);expect(points[0].y.value).toBe(78.123456);
 expect(mocks.board).toHaveBeenCalledTimes(2);expect(JSON.stringify(result)).not.toContain("file_hash");
});
it("keeps every pitch, source context, unit and metric isolated, including bat-speed max versus average",async()=>{
 const sources=["Full Swing · Intrasquad","Full Swing · Practice","Full Swing · Game"];
 const data=sources.flatMap(source=>[reading("max_bat_speed",{source}),reading("avg_bat_speed",{source}),...(["Slider","Four-Seam Fastball"] as const).flatMap(pitch=>["classified_max_velocity","classified_avg_velocity","classified_max_spin","classified_avg_spin"].map(metric=>reading(metric,{source:`${source} · ${pitch}`,unit:metric.endsWith("spin")?"rpm":"mph"}))) ]);
 data.push(reading("avg_exit_velocity",{unit:"km/h"}),reading("avg_exit_velocity"));
 mocks.board.mockImplementation(async(_access,s:LeaderboardSelection)=>[boardRow(s,s.unit==="rpm"?2100:s.unit==="km/h"?120:s.metricKey.includes("max")?90:75)]);
 const result=await loadAnalyticsFallReadings(access,[player],data);
 expect(result).toHaveLength(data.length);expect(new Set(result.map(variableKey)).size).toBe(data.length);
 for(const row of result)expect(row.value).toBe(row.unit==="rpm"?2100:row.unit==="km/h"?120:row.metric.includes("max")?90:75);
 expect(mocks.board.mock.calls.every(([,s])=>s.period==="fall_2026")).toBe(true);
});
it("preserves RENPHO, game-sheet and weekly Blast readings exactly, without merging practice vendors",async()=>{
 const untouched=[reading("weight",{source:"RENPHO",unit:"lb",value:190}),reading("batting_avg",{source:"QPA · Fall cumulative (snapshot date)",unit:"ratio",value:.3}),reading("avg_bat_speed",{source:"Blast Motion · Average · 2026-09-13:2026-09-20",value:65}),reading("classified_avg_velocity",{date:"2026-08-20",source:"Full Swing · Practice · Slider"})];
 expect(await loadAnalyticsFallReadings(access,[player],untouched)).toEqual(untouched);expect(mocks.board).not.toHaveBeenCalled();
});
it("labels a count-incomplete latest average and does not resurrect a withheld EV or roster-excluded result",async()=>{
 mocks.board.mockImplementation(async(_access,s:LeaderboardSelection)=>s.metricKey==="avg_bat_speed"?[boardRow(s,67,false)]:[]);
 const result=await loadAnalyticsFallReadings(access,[player],[reading("avg_exit_velocity"),reading("avg_bat_speed")]);
 expect(result).toHaveLength(1);expect(result[0]).toMatchObject({metric:"avg_bat_speed",value:67,basis:"latest-session"});
 mocks.board.mockImplementation(async(_access,s:LeaderboardSelection)=>[{...boardRow(s,80),athleteCode:"SYN-OTHER"}]);
 expect(await loadAnalyticsFallReadings(access,[player],[reading("avg_exit_velocity")])).toEqual([]);
});
it("does not hide a failed numerical verification behind old latest-session values",async()=>{
 mocks.board.mockRejectedValue(new Error("The leaderboard could not be loaded."));
 await expect(loadAnalyticsFallReadings(access,[player],[reading("avg_exit_velocity")])).rejects.toThrow("could not be loaded");
});
it("uses the verified metric result date for pairing and keeps raw identity/source data off the result",async()=>{
 mocks.board.mockImplementation(async(_access,s:LeaderboardSelection)=>[{...boardRow(s,99),measuredAt:s.metricKey==="max_exit_velocity"?"2026-09-11":"2026-09-26"}]);
 const result=await loadAnalyticsFallReadings(access,[player],[reading("max_exit_velocity"),reading("avg_exit_velocity")]);
 const [max,avg]=result;expect(pairAnalytics([player],result,variableKey(max),variableKey(avg),7).points).toHaveLength(0);
 expect(pairAnalytics([player],result,variableKey(max),variableKey(avg),30).points).toHaveLength(1);
 expect(Object.keys(max).sort()).toEqual(["id","athleteId","metric","label","unit","source","date","value","importedAt","basis"].sort());
});
