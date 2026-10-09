import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));
import { PlayerPerformanceProfile } from "@/components/player-performance-profile";
import { getPlayerPerformance } from "@/lib/player-performance";
import { getPlayerProfileLayout, withoutUnclassifiedPitchVelocity } from "@/lib/player-profile-layout";
import type { RosterAthlete } from "@/lib/types";
import type { Measurement } from "@/lib/imports/engine";
function fictionalAthlete(playerType: string | null,primary: string|null="CF",secondary:string|null=null): RosterAthlete {
 return { id:"SYN-001",athlete_code:"SYN-001",first_name:"Fictional Avery",preferred_name:"Avery",last_name:"Northstar",pacific_email:"fictional.avery@example.com",profile_photo_url:null,created_at:"",updated_at:"",renpho_id:"FICTIONAL-RENPHO",
  athlete_seasons:[{athlete_id:"SYN-001",season:"2026-27",jersey_number:0,primary_position:primary,secondary_position:secondary,player_type:playerType,bats:"L",throws:"R",academic_class:"freshman",eligibility_year:1,graduation_year:2030,roster_status:"active"}]};
}
const measurement=(metric:string,value:number,unit:string,date="2026-09-03",code="SYN-001"):Measurement=>({id:`fictional-${code}-${metric}-${date}`,athlete_code:code,measured_at:date,source:"Fictional testing",metric,value,unit,source_file:`fictional-${code}.csv`,source_sheet:"CSV",source_row:2,file_hash:"a".repeat(64)});
const model=(readings:Measurement[]=[])=>getPlayerPerformance({readings,athleteCode:"SYN-001"});
describe("player profile tabs and presentation",()=>{
 it("renders five accessible tabs with Overview selected and separate session contexts",()=>{
  const athlete=fictionalAthlete("position"),html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete,performance:model()}));
  expect((html.match(/role="tab"/g)??[])).toHaveLength(5);expect((html.match(/role="tabpanel"/g)??[])).toHaveLength(5);expect((html.match(/aria-selected="true"/g)??[])).toHaveLength(1);expect((html.match(/hidden=""/g)??[])).toHaveLength(4);
  for(const label of ["Overview","Physicality","In-Game","Practice","Progress"])expect(html).toContain(label);
  expect(html).not.toContain(athlete.pacific_email);expect(html).not.toContain(athlete.renpho_id);expect(html).not.toContain("Eligibility year");expect(html).toContain("Avery Northstar");expect(html).toContain("PAC ID");expect(html).toMatch(/Jersey Number<\/dt><dd[^>]*>0<\/dd>/);
 expect(html).not.toContain('role="meter"');expect(html).not.toContain('data-value="0"');expect(html).not.toContain("Pacific n=0");expect(html).not.toContain("Need 5 comparable players");expect(html).not.toContain("Team comparison not available");expect(html).not.toMatch(/<details[^>]*\sopen(?:[ =>])/);
  expect(html).not.toContain("Stats Available");
 });
 it("summarizes only available snapshot metrics and points body-only profiles to Physicality",()=>{
  const performance=model([measurement("Weight",172,"lb","2026-09-02"),measurement("Height",70,"in","2026-09-03")]);
  const html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete:fictionalAthlete("position"),performance}));
  const overview=html.split('role="tabpanel"')[1];
  expect(overview).toContain("Body results are in Physicality");
  expect(overview).toMatch(/Stats Available<\/dt><dd[^>]*>2<\/dd>/);
  expect(overview).toContain('dateTime="2026-09-03"');
  expect(overview).not.toContain('dateTime="2026-09-02"');
  expect(overview).not.toContain('role="meter"');
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
  const athlete=fictionalAthlete(type,primary,secondary),layout=getPlayerProfileLayout(model([measurement("Infield Velocity",80,"mph"),measurement("Outfield Velocity",85,"mph"),measurement("Max Velocity",88,"mph")]),athlete.athlete_seasons[0]);expect(layout.fieldThrowing.map(c=>c.metric.key)).toEqual(field);expect(layout.pitching.length>0).toBe(pitch);expect(layout.hasThrowingRole).toBe(pitch||!!field.length);
 });
 it("keeps speed testing periods and legacy bat speed distinct while reordering cards",()=>{
  const performance=model([measurement("Home to First",4.2,"s"),measurement("Bat Speed",72,"mph"),measurement("Body Fat Percentage",18,"%")]),layout=getPlayerProfileLayout(performance,fictionalAthlete("position").athlete_seasons[0]);
  expect(layout.physicality.map(c=>c.metric.key)).toEqual([]);expect(layout.hitting.map(c=>c.metric.key)).toEqual([]);
  const speed=layout.speedAgility.find(c=>c.metric.key==="home_to_first")!;expect(speed).toBe(performance.hitting.find(c=>c.metric.key==="home_to_first"));expect(speed.latest).toMatchObject({measuredAt:"2026-09-03",period:"fall_2026",unit:"s",value:4.2});
  expect(layout.additionalBody.map(c=>c.metric.key)).toEqual(["body_fat_pct"]);
  expect(layout.otherHitting.map(c=>c.metric.key)).toEqual(["bat_speed"]);expect(layout.hitting.find(c=>c.metric.key==="max_bat_speed")?.latest).toBeUndefined();expect(layout.hitting.find(c=>c.metric.key==="avg_bat_speed")?.latest).toBeUndefined();
  const html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete:fictionalAthlete("position"),performance}));expect(html).toContain("Bat Speed (Unspecified)");expect(html).toContain('data-value="72"');
  expect(html).not.toContain('id="body-measurements"');const physicality=html.split('id="body-composition"')[1];expect(physicality).toContain('data-metric-key="body_fat_pct" data-value="18" data-unit="%"');
 });
 it("shows actual latest dates, retains older data only in the model history, and keeps source information collapsed",()=>{
  const athlete=fictionalAthlete("position"),performance=model([measurement("Weight",170,"lb","2026-08-09"),measurement("Weight",171,"lb")]);const html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete,performance}));
  expect(html).toContain("Sep 3, 2026");expect(html).not.toContain("Aug 9, 2026");expect(html).toContain('data-value="171"');expect(performance.body.find(card=>card.metric.key==="weight")?.history).toHaveLength(2);expect(html).toContain("Sources &amp; Percentiles");expect(html).not.toMatch(/<details[^>]*\sopen(?:[ =>])/);
 });
 it("puts RENPHO content in Physicality and keeps game stats out of the profile",()=>{
  const html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete:fictionalAthlete("position"),performance:model(),physicalityDetails:createElement("p",null,"Fictional RENPHO slot"),history:createElement("details",null,createElement("summary",null,"Fictional history"))}));
  const panels=html.split('role="tabpanel"');
  expect((html.match(/role="tab"/g)??[])).toHaveLength(5);expect(panels[1]).toContain('data-testid="player-overview"');expect(panels[1]).not.toContain("Fictional RENPHO slot");expect(panels[2]).toContain("Fictional RENPHO slot");expect(html).not.toContain('>Games</button>');
 });
 it.each([
  {type:"pitcher",primary:"P",hitting:false},
  {type:null,primary:"P",hitting:false},
  {type:"two_way",primary:"P",hitting:true},
  {type:"position",primary:"CF",hitting:true},
 ])("shows role-relevant tabs and insights for $type/$primary",({type,primary,hitting})=>{
  const athlete=fictionalAthlete(type,primary),performance=model([measurement("Max Exit Velocity",80,"mph","2026-09-01"),measurement("Max Exit Velocity",90,"mph","2026-09-03"),measurement("Home to First",4.5,"s","2026-09-01"),measurement("Home to First",4.2,"s","2026-09-04")]);
  const html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete,performance}));
  expect(html).toContain('>In-Game</button>');expect(html).toContain('>Practice</button>');expect((html.match(/role="tab"/g)??[])).toHaveLength(5);
  const overview=html.split('role="tabpanel"')[1];expect(overview.includes("Max Exit Velocity")).toBe(hitting);expect(overview.includes("Home to 1st")).toBe(hitting);
  expect(html.includes("Speed &amp; Agility")).toBe(hitting);expect(html.includes('data-metric-key="home_to_first"')).toBe(hitting);expect(html.includes("Sep 4, 2026")).toBe(hitting);
  expect(overview).toContain("Strengths");expect(overview).toContain("Areas to Work On");expect(/Biggest Jumps|Biggest jumps appear after a repeat test/.test(overview)).toBe(true);
 });
 it("keeps percentile bars off tab cards and never transmits another athlete's raw provenance",()=>{
  const readings=Array.from({length:5},(_,i)=>measurement("Weight",170+i,"lb","2026-09-03",`SYN-00${i+1}`));const performance=getPlayerPerformance({readings,athleteCode:"SYN-001",cohortAthleteCodes:readings.map(r=>r.athlete_code)}),html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete:fictionalAthlete("position"),performance}));
  expect(html).not.toContain('data-testid="player-percentile"');expect(html).not.toContain('data-ranking-metric="weight"');expect(html).not.toContain("fictional-SYN-002.csv");
 });
});

it("shows recorded total muscle in Body Composition and Overview instead of a percentage", () => {
 const codes=Array.from({length:5},(_,i)=>`SYN-${String(i+1).padStart(3,"0")}`);
 const readings=codes.map((code,i)=>measurement("Muscle Mass",120+i*10,"lb","2026-09-03",code));
 readings.push(measurement("Muscle Mass Percentage",75,"%"));
 const performance=getPlayerPerformance({readings,athleteCode:codes[0],cohortAthleteCodes:codes});
 const html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete:fictionalAthlete("position"),performance}));
 expect(html).toContain('data-metric-key="muscle_mass" data-value="120" data-unit="lb"');
 expect(html).not.toContain('data-metric-key="muscle_mass_pct"');expect(html).not.toContain("Muscle Mass %");
 const overview=html.split('role="tabpanel"')[1];expect(overview).toContain('120<span class="hero-unit"> lb</span>');expect(overview).not.toContain('data-ranking-metric="muscle_mass"');
 expect(getPlayerProfileLayout(model([measurement("Muscle Mass Percentage",75,"%")]),fictionalAthlete("position").athlete_seasons[0]).additionalBody.find(c=>c.metric.key==="muscle_mass")?.latest).toBeUndefined();
});
it("ranks comparable hitting and pitching results in the Overview percentile list",()=>{
 const codes=Array.from({length:5},(_,i)=>`SYN-00${i+1}`),readings=codes.flatMap((code,i)=>[measurement("Max EV",90+i,"mph","2026-09-03",code),measurement("Max Velocity",80+i,"mph","2026-09-03",code),measurement("BB %",5+i,"%","2026-09-03",code)]);
 const performance=getPlayerPerformance({readings,athleteCode:codes[0],cohortAthleteCodes:codes}),html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete:fictionalAthlete("two_way","CF","P"),performance}));
 for(const key of ["max_exit_velocity","max_pitch_velocity","bb_pct"])expect(html).toContain(`data-ranking-metric="${key}"`);expect(html).not.toContain('data-testid="player-percentile"');
});

it("keeps only available profile measurements and hides paused speed protocols without deleting them",()=>{
 const performance=model([measurement("Dominant Grip",110,"lb"),measurement("Non-Dominant Grip",105,"lb"),measurement("Steal Break",1,"s"),measurement("Steal Reaction",.3,"s"),measurement("Steal Start · 12–42 ft",2,"s"),measurement("12 ft Steal Start",1.5,"s")]);
 const html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete:fictionalAthlete("position"),performance}));
 for(const key of ["grip_dominant","grip_non_dominant","steal_start_12ft"])expect(html).toContain(`data-metric-key="${key}"`);
 for(const key of ["steal_break","steal_reaction","steal_12_42ft","max_exit_velocity","weight"])expect(html).not.toContain(`data-metric-key="${key}"`);
 expect(performance.hitting.find(c=>c.metric.key==="steal_reaction")?.history).toHaveLength(1);
});

it("shows earlier in-game readings separately from newer practice readings and cumulative stats", () => {
 const live={...measurement("Max Exit Velocity",85,"mph","2026-09-03"),source:"Full Swing · Intrasquad"};
 const practice={...measurement("Max Exit Velocity",95,"mph","2026-09-12"),source:"Full Swing · Hitting"};
 const html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete:fictionalAthlete("position"),performance:model([live,practice]),gameStats:createElement("p",null,"Fictional cumulative stats")}));
 const panels=html.split('role="tabpanel"');
 expect(panels[3]).toContain('data-value="85"');expect(panels[3]).not.toContain('data-value="95"');expect(panels[3]).toContain("Fictional cumulative stats");
 expect(panels[4]).toContain('data-value="95"');expect(panels[4]).not.toContain('data-value="85"');expect(panels[4]).not.toContain("Fictional cumulative stats");
});

it("keeps the full Fall arsenal in the In-Game tab and hides only broad Full Swing velocity in the matching context", () => {
 const classified = [
  ["Pitch Type Average Velocity",81.123,"mph"], ["Pitch Type Max Velocity",84.456,"mph"], ["Pitch Type Velocity Readings",5,"count"],
  ["Pitch Type Average Spin",2001.234,"rpm"], ["Pitch Type Max Spin",2100.123,"rpm"], ["Pitch Type Spin Readings",3,"count"], ["Pitch Type Count",6,"count"],
 ].map(([metric,value,unit])=>({...measurement(String(metric),Number(value),String(unit),"2026-09-11"),source:"Full Swing · Intrasquad · Fastball"}));
 const genericGame={...measurement("Max Velocity",85,"mph","2026-09-11"),source:"Full Swing · Intrasquad"};
 const genericPractice={...measurement("Max Velocity",86,"mph","2026-09-12"),source:"Full Swing · Practice"};
 const manual={...measurement("Max Velocity",87,"mph","2026-09-13"),source:"Fictional manual testing"};
 const readings=[...classified,genericGame,genericPractice,manual];
 const performance=model(readings),original=structuredClone(performance);
 const html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{athlete:fictionalAthlete("pitcher","P"),performance,blastReadings:readings}));
 const panels=html.split('role="tabpanel"');
 expect(panels[1]).not.toContain("Full Pitch Arsenal");
 expect(panels[3]).toContain("Full Pitch Arsenal");expect(panels[3]).toContain("Unspecified Pitch");expect(panels[3]).toContain("81.1");expect(panels[3]).toContain("2,100");
 expect(panels[1]).not.toContain('data-value="85"');expect(panels[3]).not.toContain('data-value="85"');
 expect(panels[3]).toContain("Pitch Mix");expect(panels[3]).not.toContain("No in-game results");
 expect(panels[4]).toContain('data-value="86"');expect(panels[4]).toContain('data-value="87"');
 expect(performance).toEqual(original);
});

it("does not render pitcher result slots for a position-only profile", () => {
 const props={performance:model(),pitchResults:createElement("p",null,"Fictional in-game arsenal"),practicePitchResults:createElement("p",null,"Fictional practice arsenal")};
 const position=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{...props,athlete:fictionalAthlete("position")}));
 expect(position).not.toContain("Fictional in-game arsenal");expect(position).not.toContain("Fictional practice arsenal");
 const twoWay=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{...props,athlete:fictionalAthlete("two_way")}));
 expect(twoWay).toContain("Fictional in-game arsenal");expect(twoWay).toContain("Fictional practice arsenal");
});

it.each(["Game", "Intrasquad", "Practice"] as const)("replaces only the exact %s broad velocity source when that classified arsenal exists", category => {
 const sources=["Full Swing · Game","Full Swing · Intrasquad","Full Swing · Practice","Full Swing · Pitching","Fictional manual testing"];
 const performance=model(sources.map((source,index)=>({...measurement("Max Velocity",80+index,"mph",`2026-09-${11+index}`),source})));
 const original=structuredClone(performance), filtered=withoutUnclassifiedPitchVelocity(performance,[{category,average:true,maximum:true}]);
 const remaining=filtered.pitching.flatMap(card=>card.sourceCards??[card]).flatMap(card=>card.latest?[card.latest.source]:[]);
 expect(remaining).not.toContain(`Full Swing · ${category}`);
 for(const source of sources.filter(source=>source!==`Full Swing · ${category}`))expect(remaining).toContain(source);
 expect(performance).toEqual(original);
});

it.each(["average", "maximum"] as const)("keeps the uncovered broad velocity statistic when only classified %s is available", available => {
 const performance=model([
  {...measurement("Average Velocity",81,"mph","2026-09-11"),source:"Full Swing · Intrasquad"},
  {...measurement("Max Velocity",85,"mph","2026-09-11"),source:"Full Swing · Intrasquad"},
 ]);
 const filtered=withoutUnclassifiedPitchVelocity(performance,[{category:"Intrasquad",average:available==="average",maximum:available==="maximum"}]);
 expect(filtered.pitching.find(card=>card.metric.key==="avg_pitch_velocity")?.latest?.value??null).toBe(available==="average"?null:81);
 expect(filtered.pitching.find(card=>card.metric.key==="max_pitch_velocity")?.latest?.value??null).toBe(available==="maximum"?null:85);
});

it("Quick View keeps the main body results and balance notice, with all indicators available in Full Detail",()=>{
 const athlete=fictionalAthlete("position");const readings=[measurement("Weight",180,"lb"),measurement("Height",72,"in"),measurement("Muscle Mass",140,"lb"),measurement("Body Fat Percentage",15,"%"),measurement("Visceral Fat",5,"level")].map(r=>({...r,source:"RENPHO"}));
 const props={athlete,performance:model(readings),selectedTab:"physicality" as const,navigationPath:"/athletes/fictional",muscleBalance:createElement("p",null,"Fictional balance review"),movementScreening:createElement("p",null,"Fictional movement details"),physicalityDetails:createElement("p",null,"Fictional report details")};
 const quick=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{...props,detail:"quick"})),full=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{...props,detail:"full"}));
 for(const html of [quick,full]){expect(html).toContain("Fictional balance review");expect(html).toContain('data-value="140"');expect(html).toContain('data-value="15"');expect(html).toContain("6′ 0″");}
 expect(quick).not.toContain("Fictional movement details");expect(quick).not.toContain("Fictional report details");expect(full).toContain("Fictional movement details");expect(full).toContain("Fictional report details");expect(quick).toContain("Full Detail includes");
 expect(quick).toContain('aria-pressed="true">Quick View');expect(full).toContain('aria-pressed="true">Full Detail');
});

it("places the complete Fall physicality radar only in Physicality, including routed Quick View", () => {
 const codes=Array.from({length:5},(_,i)=>`SYN-00${i+1}`);
 const readings=codes.flatMap((code,i)=>[["Muscle Mass",140+i,"lb"],["RENPHO Body Score",80+i,"points"],["Body Fat Percentage",15+i,"%"]].map(([metric,value,unit])=>({...measurement(String(metric),Number(value),String(unit),"2026-09-16",code),source:"RENPHO"})));
 const performance=getPlayerPerformance({readings,athleteCode:codes[0],cohortAthleteCodes:codes}),props={athlete:fictionalAthlete("two_way"),performance};
 const html=renderToStaticMarkup(createElement(PlayerPerformanceProfile,props)),panels=html.split('role="tabpanel"');
 expect(panels[1]).not.toContain('aria-label="Physicality percentile radar"');
 expect(panels[2]).toContain('aria-label="Physicality percentile radar"');
 const quick=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{...props,selectedTab:"physicality",detail:"quick"}));
 expect(quick).toContain('aria-label="Physicality percentile radar"');
 const overview=renderToStaticMarkup(createElement(PlayerPerformanceProfile,{...props,selectedTab:"overview"}));
 expect(overview).not.toContain('aria-label="Physicality percentile radar"');
 const incomplete=getPlayerPerformance({readings:readings.filter(row=>row.metric!=="RENPHO Body Score"),athleteCode:codes[0],cohortAthleteCodes:codes});
 expect(renderToStaticMarkup(createElement(PlayerPerformanceProfile,{...props,performance:incomplete,selectedTab:"physicality"}))).not.toContain('aria-label="Physicality percentile radar"');
});
