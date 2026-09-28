import { describe, expect, it } from "vitest";
import { buildExitMeetingReport, exitMeetingFormat, type ExitMeetingReport, type ExitMeetingRow } from "@/lib/exit-meeting";
import { compactExitMeetingReport, compactExitMeetingArsenal } from "@/lib/exit-meeting-compact";
import type { Measurement } from "@/lib/imports/engine";
import type { RosterAthlete } from "@/lib/types";

const athlete={id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",athlete_code:"PAC-9999",first_name:"Fictional",last_name:"Boxer",preferred_name:null,athlete_seasons:[{season:"2026-27",primary_position:"P",player_type:"pitcher"}]} as RosterAthlete;
const input={athlete,measurements:[],batches:[],percentileOverrides:[],games:[],comparisons:[],movement:null,generatedAt:"2026-09-27T12:00:00Z"};
const base=()=>buildExitMeetingReport(input,"detailed");
const row=(metricKey:string,date="2026-09-16"):ExitMeetingRow=>({metricKey,label:metricKey,value:"12.3 mph",date,source:"Fictional source",basis:"Latest profile result",percentile:null,peers:null,sample:null});
const source="Full Swing · Intrasquad · Fastball";
const reading=(metric:string,value:number,unit:string,hash="a".repeat(64),context=source,date="2026-09-16"):Measurement=>({id:`${hash}-${metric}-${context}`,athlete_code:"PAC-9999",metric,value,unit,source:context,measured_at:date,file_hash:hash,source_file:"PRIVATE.csv",source_sheet:"Private source",source_row:99});
const session=(average:number,max:number,count:number,hash="a".repeat(64),context=source)=>[reading("Pitch Type Average Velocity",average,"mph",hash,context),reading("Pitch Type Max Velocity",max,"mph",hash,context),reading("Pitch Type Velocity Readings",count,"count",hash,context)];

describe("meeting-first report",()=>{
 it("defaults to Meeting Summary and only accepts the two explicit formats",()=>{
  expect(buildExitMeetingReport(input).format).toBe("meeting");expect(base().format).toBe("detailed");expect(exitMeetingFormat(undefined)).toBe("meeting");expect(exitMeetingFormat("detailed")).toBe("detailed");for(const value of ["all",null,{},true])expect(()=>exitMeetingFormat(value)).toThrow("Meeting Summary");
 });
 it("selects coaching metrics by semantic key and keeps every original detail available",()=>{
  const full:ExitMeetingReport={...base(),lastTested:"2026-09-25",sections:[
   {id:"physicality",title:"Physicality",subtitle:"Test",rows:[row("height"),row("body_fat_pct"),row("muscle_mass"),row("body_score"),row("grip_dominant"),row("grip_non_dominant"),row("weight"),row("bmr")]},
   {id:"game-qpa_fall_2026",title:"Game Hitting",subtitle:"Fall",rows:[row("gdp"),row("batting_avg"),row("batting_obp"),row("sb"),row("pumps")]},
   {id:"game-pitching_fall_2026",title:"Game Pitching",subtitle:"Fall",rows:[row("pitching_k9"),row("pitching_r9"),row("weak_contact_pct"),row("k")]},
   {id:"blast-fall",title:"Blast",subtitle:"Fall",rows:[row("avg_bat_speed"),row("blast_peak_hand_speed"),row("blast_attack_angle"),row("blast_early_connection"),row("blast_vertical_bat_angle")]},
   {id:"testing",title:"Testing",subtitle:"Trials",rows:[row("home_to_first"),row("home_to_second"),row("boxer_t"),row("infield_velocity"),row("outfield_velocity"),row("steal_break")]},
   {id:"hitting-in_game",title:"Hitting",subtitle:"In-Game",rows:[row("max_exit_velocity"),row("avg_exit_velocity"),row("max_bat_speed"),row("avg_bat_speed"),row("max_distance"),row("smash_factor")]},
   ...["renpho-detail","movement","counts-qpa_fall_2026","blast-0-p95","blast-0-average","throwing-in_game","hitting-practice","contact-in_game"].map(id=>({id,title:id,subtitle:"Detail",rows:[row("detail","2026-09-25")]})),
  ]};
  const before=JSON.stringify(full),summary=compactExitMeetingReport(full,[]);
  expect(summary.sections.map(s=>s.id)).toEqual(["physicality","game-qpa_fall_2026","game-pitching_fall_2026","hitting-in_game","blast-fall","testing"]);expect(summary.sections[0].rows).toHaveLength(7);expect(summary.sections.find(s=>s.id==="blast-fall")!.rows).toHaveLength(5);expect(summary.sections.flatMap(s=>s.rows).map(r=>r.metricKey)).not.toEqual(expect.arrayContaining(["bmr","gdp","k","steal_break","smash_factor","detail"]));expect(summary.lastTested).toBe("2026-09-16");expect(JSON.stringify(full)).toBe(before);
 });
 it("keeps at most two verified highlights per group and does not create missing highlights",()=>{
  const highlights=Array.from({length:5},(_,index)=>({label:`Measured strength ${index}`,detail:"Source and sample",percentile:90-index}));const summary=compactExitMeetingReport({...base(),strengths:highlights,development:highlights,jumps:highlights},[]);expect(summary.strengths).toEqual(highlights.slice(0,2));expect(summary.development).toHaveLength(2);expect(summary.jumps).toHaveLength(2);expect(compactExitMeetingReport(base(),[]).strengths).toEqual([]);
 });
 it("preserves default pitcher visibility instead of adding hidden hitting results",()=>{
  const report=buildExitMeetingReport({...input,measurements:[reading("Average Bat Speed",70,"mph","a".repeat(64),"Full Swing · Intrasquad"),...session(80,85,10)]});expect(report.sections.map(s=>s.id)).toEqual(["arsenal-summary-intrasquad"]);
 });
});

describe("compact classified arsenal",()=>{
 it("weights averages by the matching reading counts and preserves same-day files and exact contexts",()=>{
  const rows=[...session(80,85,10),...session(84,87,30,"b".repeat(64)),...session(90,92,5,"c".repeat(64),"Full Swing · Game · Fastball"),...session(75,79,8,"d".repeat(64),"Full Swing · Practice · Fastball"),reading("Pitch Type Average Spin",2000,"rpm"),reading("Pitch Type Max Spin",2200,"rpm"),reading("Pitch Type Spin Readings",7,"count")];
  const result=compactExitMeetingArsenal(rows);expect(result).toHaveLength(3);expect(result.find(s=>s.id==="arsenal-summary-intrasquad")!.rows).toEqual(expect.arrayContaining([expect.objectContaining({value:"83.0 avg / 87.0 max mph",sample:"40 velocity readings · 2 sessions",percentile:null}),expect.objectContaining({value:"2000.0 avg / 2200.0 max rpm",sample:"7 spin readings · 1 session"})]));expect(result.find(s=>s.id==="arsenal-summary-practice")!.rows[0].value).toBe("75.0 avg / 79.0 max mph");expect(JSON.stringify(result)).not.toMatch(/PRIVATE|source_row|file_hash/);
 });
 it("keeps each pitch family date tied to its own contributing readings",()=>{
  const oldSpin=[reading("Pitch Type Average Spin",2000,"rpm","a".repeat(64),source,"2026-09-11"),reading("Pitch Type Max Spin",2200,"rpm","a".repeat(64),source,"2026-09-11"),reading("Pitch Type Spin Readings",7,"count","a".repeat(64),source,"2026-09-11")];
  const oldVelocity=session(80,85,10).map(row=>({...row,measured_at:"2026-09-11"}));
  const newVelocity=session(84,87,30,"b".repeat(64)).map(row=>({...row,measured_at:"2026-09-23"}));
  const rows=compactExitMeetingArsenal([...oldSpin,...oldVelocity,...newVelocity])[0].rows;
  expect(rows.find(row=>row.label.endsWith("Spin"))).toMatchObject({date:"2026-09-11",sample:"7 spin readings · 1 session"});
  expect(rows.find(row=>row.label.endsWith("Velocity"))).toMatchObject({date:"2026-09-11 to 2026-09-23",sample:"40 velocity readings · 2 sessions"});
 });
 it("does not invent means, maxima, counts, or comparisons when required evidence is missing",()=>{
  const incomplete=[...session(80,85,10),reading("Pitch Type Max Velocity",87,"mph","b".repeat(64))];expect(compactExitMeetingArsenal(incomplete)[0].rows[0]).toMatchObject({value:"— avg / 87.0 max mph",sample:"Reading count unavailable · 2 sessions",percentile:null,peers:null});
  const onlyAverage=[reading("Pitch Type Average Velocity",80,"mph"),reading("Pitch Type Velocity Readings",10,"count")];expect(compactExitMeetingArsenal(onlyAverage)[0].rows[0].value).toBe("80.0 avg / — max mph");
  expect(compactExitMeetingArsenal([...session(80,85,10),reading("Pitch Type Average Velocity",81,"mph")])).toEqual([]);
  expect(compactExitMeetingArsenal(session(80,85,10).map(r=>({...r,measured_at:"2026-08-31"})))).toEqual([]);
 });
});
