import { it, expect } from "vitest";
import { getPlayerPerformance } from "@/lib/player-performance";
import { reportTestingSelection } from "@/lib/player-report";
import type { Measurement } from "@/lib/imports/engine";
import type { AthleteSeason } from "@/lib/types";
const row=(metric:string,value:number,unit:string):Measurement=>({id:`fictional-${metric}`,athlete_code:"SYN-001",measured_at:"2026-09-15",source:"Fictional testing",metric,value,unit,source_file:"fictional.csv",source_sheet:"CSV",source_row:2,file_hash:"a".repeat(64)});
it("preserves all three core composition measurements and counts every omitted visible test",()=>{
  const performance=getPlayerPerformance({athleteCode:"SYN-001",readings:[row("Weight",180,"lb"),row("Height",72,"in"),row("Muscle Mass",145,"lb"),row("Body Fat Percentage",15,"%"),row("Body Score",90,"points"),row("Bat Speed",68,"mph"),row("Average Bat Speed",65,"mph"),row("Max Exit Velocity",100,"mph"),row("Home to First",4.2,"s")]});
  const report=reportTestingSelection(performance,undefined,5);
  expect([...report.chosen].map(c=>c.metric.key)).toEqual(["muscle_mass","body_fat_pct","body_score","weight","height"]);
  expect(report.hiddenTests).toBe(report.all.length-report.chosen.size);
  expect(report.hiddenTests).toBe(4);
});
it("does not add hitting or speed tests to a pitcher report",()=>{
  const performance=getPlayerPerformance({athleteCode:"SYN-001",readings:[row("Muscle Mass",145,"lb"),row("Max Exit Velocity",100,"mph"),row("Home to First",4.2,"s"),row("Max Velocity",88,"mph")]});
  const report=reportTestingSelection(performance,{player_type:"pitcher",primary_position:"P"} as AthleteSeason);
  expect(report.shownGroups.map(g=>g.label)).toEqual(["Physicality","Throwing"]);
  expect(report.all.map(c=>c.metric.key)).not.toContain("home_to_first");
});
