import { describe, expect, it } from "vitest";
import { profileHeaderResults } from "@/lib/profile-header-results";
import { getPlayerPerformance } from "@/lib/player-performance";
import { fallArsenalPitches } from "@/lib/pitch-arsenal";
import type { Measurement } from "@/lib/imports/engine";
import type { AthleteSeason } from "@/lib/types";

const season = (player_type: string): AthleteSeason => ({ athlete_id:"fictional", season:"2026-27", jersey_number:0, primary_position:player_type==="pitcher"?"P":"CF", secondary_position:null, player_type, bats:"L", throws:"R", academic_class:null, eligibility_year:null, graduation_year:null, roster_status:"active" });
const reading = (metric:string, value:number, unit:string, source="RENPHO", date="2026-09-11"):Measurement => ({ id:`fictional-${metric}-${source}`,athlete_code:"SYN-001",metric,value,unit,source,measured_at:date,file_hash:"a".repeat(64),source_file:"fictional.csv",source_sheet:"CSV",source_row:2 });
const model = (rows:Measurement[]) => getPlayerPerformance({readings:rows,athleteCode:"SYN-001"});
const pitchRows = (category:string, speed:number) => [reading("Pitch Type Max Velocity",speed,"mph",`Full Swing · ${category} · Slider`),reading("Pitch Type Average Spin",2301.2,"rpm",`Full Swing · ${category} · Slider`),reading("Pitch Type Spin Readings",12,"count",`Full Swing · ${category} · Slider`)];

describe("compact profile header results",()=>{
  it("retains exact hitting source, reading and date without manufacturing missing highlights",()=>{
    const rows=[reading("Max Exit Velocity",94.45,"mph","Full Swing · Intrasquad"),reading("Average Exit Velocity",82.34,"mph","Full Swing · Practice")];
    const results=profileHeaderResults(model(rows),season("position"),[]);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({key:"max_exit_velocity",value:"94.5 mph",date:"2026-09-11",guide:{value:94.45,source:"Full Swing · Intrasquad"}});
    expect(results[1].guide.source).toBe("Full Swing · Practice");
    expect(profileHeaderResults(model([]),season("position"),[])).toEqual([]);
  });
  it("keeps pitcher highlights pitch-specific, preferring game context over a higher practice reading",()=>{
    const rows=[...pitchRows("Intrasquad",84.12),...pitchRows("Practice",90.5),reading("Max Exit Velocity",100,"mph","Full Swing · Intrasquad"),reading("RENPHO Body Score",88,"points")];
    const results=profileHeaderResults(model(rows),season("pitcher"),fallArsenalPitches(rows,"2026-10-14"));
    expect(results.map(r=>r.key)).toEqual(["classified_max_velocity","classified_avg_spin","body_score"]);
    expect(results[0]).toMatchObject({label:"Slider · Max Velo",value:"84.1 mph",source:"Full Swing · Intrasquad · Fall best"});
    expect(results[1].value).toBe("2,301 RPM");
  });
  it("shows both disciplines for a two-way player and preserves neutral body measurements",()=>{
    const rows=[...pitchRows("Intrasquad",84),reading("Max Exit Velocity",93,"mph","Full Swing · Intrasquad"),reading("Muscle Mass",144,"lb")];
    const results=profileHeaderResults(model(rows),season("two_way"),fallArsenalPitches(rows,"2026-10-14"));
    expect(results.map(r=>r.key)).toEqual(["max_exit_velocity","classified_max_velocity","muscle_mass"]);
    expect(results[2].value).toBe("144 lb");
  });
  it("labels Fall bests, weighted averages and unavailable-summary session fallbacks with the correct dates",()=>{
    const rows=["Max Exit Velocity","Average Exit Velocity"].flatMap(metric=>[
      {...reading(metric,95,"mph","Full Swing · Intrasquad","2026-09-01"),id:`fictional-old-${metric}`,file_hash:"a".repeat(64)},
      {...reading(metric,90,"mph","Full Swing · Intrasquad","2026-10-01"),id:`fictional-new-${metric}`,file_hash:"b".repeat(64)},
    ]);
    const summaries = (["max_exit_velocity","avg_exit_velocity"] as const).map(metricKey=>({metricKey,source:"full swing · intrasquad",unit:"mph",value:metricKey==="max_exit_velocity"?95:92.5,bestDate:"2026-09-01",pooled:metricKey==="avg_exit_velocity",sampleCount:20,sampleUnit:"swings",teamValues:[95,92.5,90]}));
    const performance=getPlayerPerformance({readings:rows,athleteCode:"SYN-001",fallSummaries:summaries});
    const results=profileHeaderResults(performance,season("position"),[]);
    expect(results[0]).toMatchObject({value:"95.0 mph",source:"Full Swing · Intrasquad · Fall best",date:"2026-09-01",guide:{value:95}});
    expect(results[1]).toMatchObject({value:"92.5 mph",source:"Full Swing · Intrasquad · Fall average",date:"2026-10-01",guide:{value:92.5}});
    const fallback=profileHeaderResults(model(rows),season("position"),[]);
    expect(fallback.map(result=>[result.value,result.source,result.date])).toEqual([
      ["90.0 mph","Full Swing · Intrasquad · Latest session","2026-10-01"],
      ["90.0 mph","Full Swing · Intrasquad · Latest session","2026-10-01"],
    ]);
    const incomplete=getPlayerPerformance({readings:rows,athleteCode:"SYN-001",fallSummaries:[{...summaries[1],value:90,pooled:false}]});
    expect(profileHeaderResults(incomplete,season("position"),[])[1]).toMatchObject({value:"90.0 mph",source:"Full Swing · Intrasquad · Latest session"});
  });
});
