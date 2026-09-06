import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlayerPerformanceProfile } from "@/components/player-performance-profile";
import { getPlayerPerformance } from "@/lib/player-performance";
import { getPlayerProfileLayout } from "@/lib/player-profile-layout";
import type { RosterAthlete } from "@/lib/types";
import type { Measurement } from "@/lib/imports/engine";
function fictionalAthlete(playerType: string | null,primary: string|null="CF",secondary:string|null=null): RosterAthlete {
 return { id:"SYN-001",athlete_code:"SYN-001",first_name:"Fictional Avery",preferred_name:"Avery",last_name:"Northstar",pacific_email:"fictional.avery@example.com",profile_photo_url:null,created_at:"",updated_at:"",renpho_id:"FICTIONAL-RENPHO",
  athlete_seasons:[{athlete_id:"SYN-001",season:"2026-27",jersey_number:0,primary_position:primary,secondary_position:secondary,player_type:playerType,bats:"L",throws:"R",academic_class:"freshman",eligibility_year:1,graduation_year:2030,roster_status:"active"}]};
}
const measurement=(metric:string,value:number,unit:string,date="2026-09-03",code="SYN-001"):Measurement=>({id:`fictional-${code}-${metric}-${date}`,athlete_code:code,measured_at:date,source:"Fictional testing",metric,value,unit,source_file:`fictional-${code}.csv`,source_sheet:"CSV",source_row:2,file_hash:"a".repeat(64)});
const model=(readings:Measurement[]=[])=>getPlayerPerformance({readings,athleteCode:"SYN-001"});
describe("player profile tabs and presentation",()=>{
 it("renders three real accessible tabs with Physicality selected and other panels hidden",()=>{
  const athlete=fictionalAthlete("position"),html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete,performance:model()}));
  expect((html.match(/role="tab"/g)??[])).toHaveLength(3);expect((html.match(/role="tabpanel"/g)??[])).toHaveLength(3);expect((html.match(/aria-selected="true"/g)??[])).toHaveLength(1);expect((html.match(/hidden=""/g)??[])).toHaveLength(2);
  for(const label of ["Physicality","Hitting","Throwing"])expect(html).toContain(label);
  expect(html).not.toContain(athlete.pacific_email);expect(html).not.toContain(athlete.renpho_id);expect(html).not.toContain("Eligibility year");expect(html).toContain("Avery Northstar");expect(html).toContain("Athlete ID");expect(html).toMatch(/Jersey Number<\/dt><dd[^>]*>0<\/dd>/);
  expect(html).not.toContain('role="meter"');expect(html).not.toContain('data-value="0"');expect(html).not.toContain("Pacific n=0");expect(html).not.toContain("Need 5 comparable players");expect(html).not.toContain("Team comparison not available");expect(html).not.toMatch(/<details[^>]*\sopen(?:[ =>])/);
 });
 it.each([
  {type:"position",primary:"SS",secondary:null,field:["infield_velocity"],pitch:false},
  {type:"position",primary:"LF",secondary:"2B",field:["infield_velocity","outfield_velocity"],pitch:false},
  {type:"pitcher",primary:"P",secondary:null,field:[],pitch:true},
  {type:"two_way",primary:"CF",secondary:"P",field:["outfield_velocity"],pitch:true},
  {type:null,primary:"P",secondary:null,field:[],pitch:true},
  {type:"two_way",primary:null,secondary:null,field:[],pitch:true},
  {type:"position",primary:"C",secondary:"DH",field:[],pitch:false},
  {type:null,primary:"UT",secondary:"unknown SS",field:[],pitch:false},
  {type:null,primary:null,secondary:null,field:[],pitch:false},
 ])("uses exact recorded throwing positions for $type/$primary/$secondary",({type,primary,secondary,field,pitch})=>{
  const athlete=fictionalAthlete(type,primary,secondary),layout=getPlayerProfileLayout(model(),athlete.athlete_seasons[0]);expect(layout.fieldThrowing.map(c=>c.metric.key)).toEqual(field);expect(layout.pitching.length>0).toBe(pitch);expect(layout.hasThrowingRole).toBe(pitch||!!field.length);
 });
 it("keeps speed testing periods and legacy bat speed distinct while reordering cards",()=>{
  const performance=model([measurement("Home to First",4.2,"s"),measurement("Bat Speed",72,"mph")]),layout=getPlayerProfileLayout(performance,fictionalAthlete("position").athlete_seasons[0]);
  expect(layout.physicality.map(c=>c.metric.key)).toEqual(["weight","height","grip_strength","body_fat_pct"]);expect(layout.hitting.map(c=>c.metric.key)).toEqual(["max_exit_velocity","avg_exit_velocity","max_bat_speed","avg_bat_speed","smash_factor","max_distance"]);
  const speed=layout.speedAgility.find(c=>c.metric.key==="home_to_first")!;expect(speed).toBe(performance.hitting.find(c=>c.metric.key==="home_to_first"));expect(speed.latest).toMatchObject({measuredAt:"2026-09-03",period:"fall_2026",unit:"s",value:4.2});
  expect(layout.otherHitting.map(c=>c.metric.key)).toEqual(["bat_speed"]);expect(layout.hitting.find(c=>c.metric.key==="max_bat_speed")?.latest).toBeNull();expect(layout.hitting.find(c=>c.metric.key==="avg_bat_speed")?.latest).toBeNull();
  const html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete:fictionalAthlete("position"),performance}));expect(html).toContain("Bat Speed (Unspecified)");expect(html).toContain('data-value="72"');
 });
 it("shows actual latest dates, retains older data only in the model history, and keeps source information collapsed",()=>{
  const athlete=fictionalAthlete("position"),performance=model([measurement("Weight",170,"lb","2026-08-09"),measurement("Weight",171,"lb")]);const html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete,performance}));
  expect(html).toContain("Sep 3, 2026");expect(html).not.toContain("Aug 9, 2026");expect(html).toContain('data-value="171"');expect(performance.body.find(card=>card.metric.key==="weight")?.history).toHaveLength(2);expect(html).toContain("Sources &amp; Percentiles");expect(html).not.toMatch(/<details[^>]*\sopen(?:[ =>])/);
 });
 it("puts RENPHO content in Physicality and optional game content in its own tab",()=>{
  const html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete:fictionalAthlete("position"),performance:model(),physicalityDetails:createElement("p",null,"Fictional RENPHO slot"),games:createElement("p",null,"Fictional game slot"),history:createElement("details",null,createElement("summary",null,"Fictional history"))}));
  expect((html.match(/role="tab"/g)??[])).toHaveLength(4);const physicality=html.slice(html.indexOf('role="tabpanel"'),html.indexOf('role="tabpanel"',html.indexOf('role="tabpanel"')+1));expect(physicality).toContain("Fictional RENPHO slot");expect(html.slice(html.lastIndexOf('role="tabpanel"'))).toContain("Fictional game slot");
 });
 it("shows eligible percentile bars without transmitting another athlete's raw provenance",()=>{
  const readings=Array.from({length:5},(_,i)=>measurement("Weight",170+i,"lb","2026-09-03",`SYN-00${i+1}`));const performance=getPlayerPerformance({readings,athleteCode:"SYN-001",cohortAthleteCodes:readings.map(r=>r.athlete_code)}),html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete:fictionalAthlete("position"),performance}));
  expect(html).toContain('role="meter"');expect(html).toContain('data-percentile="0"');expect(html).toContain("Pacific n=5");expect(html).toContain('data-direction="neutral"');expect(html).not.toContain("fictional-SYN-002.csv");
 });
});
