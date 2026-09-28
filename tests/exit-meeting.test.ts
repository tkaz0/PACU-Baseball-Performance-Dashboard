import { describe, expect, it } from "vitest";
import { buildExitMeetingReport, parseExitMeetingOptions, type ExitMeetingReport } from "@/lib/exit-meeting";
import type { Measurement } from "@/lib/imports/engine";
import type { PlayerPercentileOverride } from "@/lib/player-performance";
import type { RosterAthlete } from "@/lib/types";
import type { SharedGameStat } from "@/lib/game-server";
import type { GameComparison } from "@/lib/game-metrics";
import type { SavedContact } from "@/lib/full-swing-contacts-server";
import type { MovementReport } from "@/lib/movement-screening";

// All identities and readings in this file are fictional.
export const fictionalExitAthlete: RosterAthlete = { id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",athlete_code:"PAC-9999",first_name:"Fictional",preferred_name:null,last_name:"Boxer",pacific_email:"fictional@example.com",profile_photo_url:null,created_at:"2026-09-01",updated_at:"2026-09-01",athlete_seasons:[{athlete_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",season:"2026-27",jersey_number:0,primary_position:"SS",secondary_position:"P",player_type:"two_way",bats:"R",throws:"R",academic_class:"Senior",eligibility_year:4,graduation_year:2027,roster_status:"active"}] };
const reading = (metric:string,value:number,unit:string,source="RENPHO",date="2026-09-16",hash="a".repeat(64)):Measurement => ({id:`fictional-${metric}-${source}-${date}-${hash}`,athlete_code:"PAC-9999",metric,value,unit,source,measured_at:date,file_hash:hash,source_file:"PRIVATE-SOURCE-NAME.csv",source_sheet:source==="RENPHO"?"RENPHO report · Page 1":"Private CSV",source_row:9});
const comparison = (metricKey:PlayerPercentileOverride["metricKey"],observedValue:number,value:number,source:string,unit:string,sampleSize=8):PlayerPercentileOverride=>({athleteCode:"PAC-9999",metricKey,observedValue,value,source,unit,sampleSize,direction:["height","body_score","body_fat_pct","muscle_mass"].includes(metricKey)?"neutral":"higher",measuredAt:"2026-09-16",period:"fall_2026"});
const game=(metric:string,value:number):SharedGameStat=>({source:"qpa_fall_2026",athlete_id:fictionalExitAthlete.id,metric,value,unit:"count",scope:"cumulative_fall",event_id:null,played_on:null,source_row:9,source_column:2,derived_from:[],snapshot_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",fetched_at:"2026-09-20T04:00:00Z",content_hash:"c".repeat(64)});
const contact:SavedContact={fileHash:"a".repeat(64),sourceRow:2,pitchNumber:1,sourceFile:"PRIVATE-SOURCE-NAME.csv",playedOn:"2026-09-16",category:"intrasquad",exitVelocity:95,launchAngle:15,direction:10,distance:280};
const build = (partial: Partial<Parameters<typeof buildExitMeetingReport>[0]> = {}) => buildExitMeetingReport({athlete:fictionalExitAthlete,measurements:[],batches:[],percentileOverrides:[],games:[],comparisons:[],movement:null,generatedAt:"2026-09-27T12:00:00Z",...partial}, "detailed");

describe("exit meeting report",()=>{
 it("strips email and raw provenance, preserves jersey zero and never invents empty results",()=>{
  const report=build();expect(report.jersey).toBe("#0");expect(report.sections).toEqual([]);expect(report.strengths).toEqual([]);expect(report.development).toEqual([]);expect(report.lastTested).toBeNull();expect(JSON.stringify(report)).not.toContain("example.com");
  const saved=build({measurements:[reading("Weight",190,"lb")]});expect(saved.sections[0].rows[0].value).toBe("190 lb");expect(JSON.stringify(saved)).not.toMatch(/PRIVATE-SOURCE|source_row|file_hash|pacific_email|renpho_id/);
 });
 it("reverses only body-fat percentile and never calls neutral body measurements strengths",()=>{
  const report=build({measurements:[reading("Body Fat Percentage",12,"%"),reading("Height",73,"in"),reading("Muscle Mass",160,"lb")],percentileOverrides:[comparison("body_fat_pct",12,10,"RENPHO","%"),comparison("height",73,90,"RENPHO","in"),comparison("muscle_mass",160,95,"RENPHO","lb")]});
  const rows=report.sections.find(s=>s.id==="physicality")!.rows;expect(rows.find(r=>r.label==="Body Fat %")?.percentile).toBe(90);expect(rows.find(r=>r.label==="Height")?.value).toBe("6′ 1″");expect(report.strengths).toEqual([]);expect(report.development).toEqual([]);
 });
 it("withholds unsupported ranks and keeps in-game/practice separate with one-decimal bat speed",()=>{
  const rows=[reading("Average Bat Speed",66.666,"mph","Full Swing · Intrasquad"),reading("Average Bat Speed",70.444,"mph","Full Swing · Practice")];
  const report=build({measurements:rows,percentileOverrides:[{...comparison("avg_bat_speed",66.666,20,"Full Swing · Intrasquad","mph",3),value:null},comparison("avg_bat_speed",70.444,80,"Full Swing · Practice","mph")]});
  expect(report.sections.find(s=>s.id==="hitting-in_game")!.rows[0]).toMatchObject({value:"66.7 mph",percentile:null,peers:3});expect(report.sections.find(s=>s.id==="hitting-practice")!.rows[0]).toMatchObject({value:"70.4 mph",percentile:80});expect(report.strengths.every(i=>i.detail.includes("Practice"))).toBe(true);
 });
 it("includes full-swing contact quality without requiring Blast data",()=>{
  const report=build({contacts:[contact,{...contact,sourceRow:3,pitchNumber:2,exitVelocity:80,launchAngle:40},{...contact,category:"practice",exitVelocity:70}]});
  expect(report.sections.find(s=>s.id==="contact-in_game")!.rows[0]).toMatchObject({value:"50.0%",sample:"2 paired contacts"});expect(report.sections.find(s=>s.id==="contact-practice")!.rows[0].value).toBe("0.0%");
 });
 it("binds game ranks to current counts and snapshot, computes OBP and uses Pacific update dates",()=>{
  const games=[game("pa",5),game("ab",4),game("base_hit",2),game("pumps",1),game("sac_fly",1),game("bb",0),game("hbp",0),game("punchies",0)];
  const comparisons:GameComparison[]=[{metric:"batting_avg",source:"qpa_fall_2026",eventId:"",value:.5,percentile:90,sampleSize:8,snapshotId:games[0].snapshot_id},{metric:"batting_obp",source:"qpa_fall_2026",eventId:"",value:.4,percentile:90,sampleSize:8,snapshotId:"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}];
  const report=build({games,comparisons}),rows=report.sections.find(s=>s.id==="game-qpa_fall_2026")!.rows;
  expect(rows.find(r=>r.label==="AVG")).toMatchObject({value:".500",percentile:90,sample:"4 AB",date:"2026-09-19"});expect(rows.find(r=>r.label==="OBP")).toMatchObject({value:".400",percentile:null,sample:"5 OBP opportunities"});expect(report.strengths.find(i=>i.label==="AVG · Hitting")).toBeDefined();
 });
 it("keeps each classified pitch session intact and never labels spin as favorable",()=>{
  const source="Full Swing · Intrasquad · Fastball",measurements=[reading("Pitch Type Max Velocity",85.123,"mph",source),reading("Pitch Type Average Spin",2010.777,"rpm",source),reading("Pitch Type Velocity Readings",5,"count",source),reading("Pitch Type Spin Readings",4,"count",source),reading("Pitch Type Max Velocity",88,"mph",source,"2026-09-16","b".repeat(64))];
  const report=build({measurements}),sections=report.sections.filter(s=>s.id.startsWith("arsenal-"));expect(sections).toHaveLength(2);expect(sections[0].rows.find(r=>r.label.includes("Max Velocity"))).toMatchObject({value:"85.1 mph",sample:"5 readings"});expect(sections[0].rows.find(r=>r.label.includes("Average Spin"))).toMatchObject({value:"2010.8 rpm",sample:"4 readings",percentile:null});expect(report.strengths).toEqual([]);
 });
 it("uses weighted Blast averages, leaves weekly P95 separate, and preserves signed angles",()=>{
  const measurements=[reading("Blast Swing Count",10,"count","Blast Motion · Average · 2026-09-13:2026-09-20","2026-09-20"),reading("Average Bat Speed",60,"mph","Blast Motion · Average · 2026-09-13:2026-09-20","2026-09-20"),reading("Blast Swing Count",30,"count","Blast Motion · Average · 2026-09-21:2026-09-26","2026-09-26"),reading("Average Bat Speed",80,"mph","Blast Motion · Average · 2026-09-21:2026-09-26","2026-09-26"),reading("Vertical Bat Angle",-15,"deg","Blast Motion · Average · 2026-09-21:2026-09-26","2026-09-26"),reading("Blast Swing Count",30,"count","Blast Motion · P95 · 2026-09-21:2026-09-26","2026-09-26"),reading("Peak Bat Speed (95th)",90,"mph","Blast Motion · P95 · 2026-09-21:2026-09-26","2026-09-26")];
  const report=build({measurements});expect(report.sections.find(s=>s.id==="blast-fall")!.rows[0]).toMatchObject({value:"75.0 mph",sample:"40 swings · 2 reports",percentile:null});expect(report.sections.find(s=>s.id==="blast-0-p95")!.rows[0]).toMatchObject({value:"90.0 mph",basis:"Weekly 95th percentile, not a maximum",sample:"30 swings"});expect(report.sections.flatMap(s=>s.rows).some(r=>r.value==="-15.0 °")).toBe(true);
 });
 it("withholds overlapping Blast rollups and still lists exact weekly reports",()=>{
  const measurements=["2026-09-13:2026-09-20","2026-09-20:2026-09-26"].flatMap(period=>[reading("Blast Swing Count",10,"count",`Blast Motion · Average · ${period}`,period.slice(-10)),reading("Average Bat Speed",60,"mph",`Blast Motion · Average · ${period}`,period.slice(-10))]);
  const report=build({measurements});expect(report.sections.some(s=>s.id==="blast-fall")).toBe(false);expect(report.notes.some(n=>n.includes("review"))).toBe(true);expect(report.sections.filter(s=>s.id.includes("average"))).toHaveLength(2);
 });
 it("applies pitcher role visibility and rejects another player's observations",()=>{
  const athlete={...fictionalExitAthlete,athlete_seasons:[{...fictionalExitAthlete.athlete_seasons[0],primary_position:"P",secondary_position:null,player_type:"pitcher"}]};
  const report=build({athlete,measurements:[reading("Home to 1st",4.1,"s","Player Metrics"),reading("Average Bat Speed",65,"mph","Full Swing · Practice")],contacts:[contact],games:[game("pa",2),game("ab",2),game("base_hit",1)]});expect(report.sections).toEqual([]);
  expect(()=>build({measurements:[{...reading("Weight",190,"lb"),athlete_code:"PAC-9998"}]})).toThrow("identity");
 });
 it("keeps ankle values as ratings, shoulder values as degrees, and source review colors",()=>{
  const movement:MovementReport={athleteCode:"PAC-9999",sheetId:7,screenedOn:"2026-09-15",sourceHash:"a".repeat(64),readings:Array.from({length:24},(_,i)=>({row:i+2,sourceRow:i+2,value:i+2===16?"3":i+2===4?"65":null,color:i+2===16?"red":"none",reference:null}))};
  const report=build({movement}),rows=report.sections.find(s=>s.id==="movement")!.rows;expect(rows.find(r=>r.label==="Right Ankle Flexion")).toMatchObject({value:"3 / 5",tone:"red"});expect(rows.find(r=>r.label==="Right Shoulder Internal Rotation")?.value).toBe("65°");expect(JSON.stringify(report)).not.toContain("sourceHash");
 });
 it("uses exact cumulative outs and classified-contact denominators, with Runs/9 and no ERA",()=>{
  const games=Object.entries({innings_outs:9,k:4,bb_outcome:2,r:1,weak_contact:3,hard_contact:1,pitches:50,strikes:30,fb:20,fb_k:15}).map(([metric,value])=>({...game(metric,value),source:"pitching_fall_2026" as const,scope:"pitching_event" as const,event_id:"fall-2026-week-1"}));
  const report=build({games}),rows=report.sections.find(s=>s.id==="game-pitching_fall_2026")!.rows;
  expect(rows.find(r=>r.label==="K/9")?.value).toBe("12.00");expect(rows.find(r=>r.label==="BB/9")?.value).toBe("6.00");expect(rows.find(r=>r.label==="Runs/9")?.value).toBe("3.00");expect(rows.find(r=>r.label==="Weak Contact %")).toMatchObject({value:"75.0%",sample:"4 classified contacts"});expect(report.sections.find(s=>s.id==="pitch-splits")!.rows[0]).toMatchObject({value:"75.0%",sample:"15 strikes / 20 pitches"});expect(report.sections.flatMap(s=>s.rows).some(r=>r.label==="ERA")).toBe(false);
 });
 it("matches profile highlight selection and does not use a hidden pitcher's reading as Last Tested",()=>{
  const measurements=[reading("Average Bat Speed",62,"mph","Full Swing · Intrasquad","2026-09-15"),reading("Average Bat Speed",70,"mph","Full Swing · Practice")],percentileOverrides=[{...comparison("avg_bat_speed",62,10,"Full Swing · Intrasquad","mph"),measuredAt:"2026-09-15"},comparison("avg_bat_speed",70,90,"Full Swing · Practice","mph")];
  const report=build({measurements,percentileOverrides});expect(report.strengths).toHaveLength(1);expect(report.strengths[0].detail).toContain("Practice");expect(report.development).toEqual([]);
  const athlete={...fictionalExitAthlete,athlete_seasons:[{...fictionalExitAthlete.athlete_seasons[0],primary_position:"P",secondary_position:null,player_type:"pitcher"}]};
  const pitcher=build({athlete,measurements:[reading("Weight",190,"lb"),reading("Home to 1st",4,"s","Player Metrics","2026-09-25")]});expect(pitcher.lastTested).toBe("2026-09-16");
 });
 it("validates meeting-only notes without silently accepting invalid dates",()=>{
  expect(parseExitMeetingOptions({meetingDate:"2026-10-01",talkingPoints:" Review plan "})).toEqual({meetingDate:"2026-10-01",talkingPoints:"Review plan",format:"meeting"});
  for(const value of [{meetingDate:"2026-02-30"},{meetingDate:"2026-09-27",talkingPoints:"x".repeat(1601)},{meetingDate:"2026-09-27",talkingPoints:"bad\u0000text"}])expect(()=>parseExitMeetingOptions(value)).toThrow();
 });
});

export function fictionalExitReport(): ExitMeetingReport {
  return build({measurements:[reading("Body Fat Percentage",12,"%"),reading("Height",73,"in"),reading("Weight",190,"lb"),reading("Muscle Mass",160,"lb"),reading("RENPHO Body Score",88,"points"),reading("Average Bat Speed",67.43,"mph","Full Swing · Intrasquad"),reading("Average Exit Velocity",89.43,"mph","Full Swing · Intrasquad"),reading("Max Exit Velocity",105.2,"mph","Full Swing · Intrasquad"),reading("Home to 1st",4.12,"s","Player Metrics"),reading("Home to 1st",4.34,"s","Player Metrics","2026-09-15")],percentileOverrides:[comparison("body_fat_pct",12,10,"RENPHO","%"),comparison("avg_bat_speed",67.43,85,"Full Swing · Intrasquad","mph"),comparison("avg_exit_velocity",89.43,20,"Full Swing · Intrasquad","mph"),comparison("max_exit_velocity",105.2,90,"Full Swing · Intrasquad","mph")],contacts:[contact]});
}
