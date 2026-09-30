import { createElement } from "react";
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatInfo } from "@/components/stat-info";
import { benchmarkGrade, benchmarkRows, blastReference, collegePitchReference, pacificBenchmark, statBenchmark, statRangeGuide, ungradedMetric, metricDirection } from "@/lib/stat-benchmarks";
import reference from "@/lib/nwc-benchmarks.json";

it("uses separate, inspectable D3 team and published-player populations",()=>{
 expect(reference.cohorts).toEqual({teams:9,publishedHitters:73,hitters:71,minimumAB:75,publishedPitchers:27,pitchers:27,minimumIP:20});
 const team=statBenchmark("batting_avg",{scope:"team"})!,player=statBenchmark("batting_avg")!;
 expect(team.n).toBe(9);expect(player.n).toBe(71);expect(team.cuts).not.toEqual(player.cuts);
 expect(team.url).toContain("nwcsports.com");expect(player.note).toContain("75 AB");
 expect(statBenchmark("pitching_r9")?.note).toContain("20 IP");
});
it("grades lower-is-better rates in reverse and gives each boundary exactly one band",()=>{
 const b=statBenchmark("pitching_bb9")!;
 expect(benchmarkGrade(0,b)).toBe(4);expect(benchmarkGrade(99,b)).toBe(0);
 for(let i=0;i<4;i++)expect(benchmarkGrade(b.cuts[i],b)).toBe(3-i);
 const avg=statBenchmark("batting_avg")!;
 expect(benchmarkGrade(0,avg)).toBe(0);expect(benchmarkGrade(1,avg)).toBe(4);
 expect(benchmarkRows("batting_avg",avg)).toHaveLength(5);
});
it("does not invent national ranges or judge pooled teams against individual Pacific players",()=>{
 const values=[1,2,3,4,5,6];
 expect(statBenchmark("qpa_pct")).toBeNull();
 expect(statBenchmark("qpa_pct",{scope:"team",cohort:values})).toBeNull();
 expect(statBenchmark("qpa_pct",{cohort:values})?.title).toBe("Pacific Player Comparison");
 expect(pacificBenchmark("max_exit_velocity",values.slice(0,4))).toBeNull();
 expect(pacificBenchmark("max_exit_velocity",[1,2,3,4,NaN])).toBeNull();
 expect(pacificBenchmark("muscle_mass",values)?.direction).toBe("neutral");
 expect(pacificBenchmark("classified_avg_spin",values)?.direction).toBe("neutral");
});
it("preserves tied ranges without claiming every fifth has a distinct threshold",()=>{
 const b=pacificBenchmark("max_bat_speed",[60,60,60,60,60],{unit:"mph"})!;
 expect(benchmarkRows("max_bat_speed",b).filter(r=>r.range==="No values in this band")).toHaveLength(2);
 expect(benchmarkGrade(60,b)).toBe(2);
 expect(benchmarkRows("max_bat_speed",b)[2].range).toBe("= 60.0 mph");
});
it("restricts Blast college targets to compatible average device readings",()=>{
 expect(blastReference("avg_bat_speed",{source:"blast_fall",unit:"mph"})).toContain("66–75");
 expect(blastReference("avg_bat_speed",{source:"Full Swing · Practice",unit:"mph"})).toBeNull();
 expect(blastReference("avg_bat_speed",{source:"Blast Motion · P95 · 2026-09-13:2026-09-20",unit:"mph"})).toBeNull();
 expect(blastReference("avg_bat_speed",{source:"blast_fall",unit:"km/h"})).toBeNull();
});
it("keeps published college pitch means separate from max values, generic types and incompatible units",()=>{
 const context={source:"Full Swing · Intrasquad · Four-Seam Fastball",unit:"mph"};
 expect(collegePitchReference("classified_avg_velocity",context)).toEqual({right:85,left:83,unit:"mph"});
 expect(collegePitchReference("classified_avg_spin",{source:"full swing · practice · Changeup",unit:"rpm"})).toEqual({right:1167,left:1629,unit:"rpm"});
 for(const metric of ["classified_max_velocity","classified_max_spin","avg_pitch_velocity","max_pitch_velocity"])
   expect(collegePitchReference(metric,context)).toBeNull();
 expect(collegePitchReference("classified_avg_velocity",{...context,unit:"km/h"})).toBeNull();
 for(const type of ["Fastball","Breaking Ball","Sweeper","Sinker","Other"])
   expect(collegePitchReference("classified_avg_velocity",{source:`Full Swing · Game · ${type}`,unit:"mph"})).toBeNull();
 expect(collegePitchReference("classified_avg_velocity",{source:"Rapsodo · Four-Seam Fastball",unit:"mph"})).toBeNull();
});
it("explains the external population and device while keeping Pacific grading separate",()=>{
 const html=renderToStaticMarkup(createElement(StatInfo,{metric:"classified_avg_spin",source:"Full Swing · Practice · Slider",unit:"rpm"}));
 for(const text of ["College Pitch Average","2086.0 RPM","2036.0 RPM","JUCO through D1","not a device-matched grade","averages, not maximums","No single ideal range"])
   expect(html).toContain(text);
 const max=renderToStaticMarkup(createElement(StatInfo,{metric:"classified_max_spin",source:"Full Swing · Practice · Slider",unit:"rpm"}));
 expect(max).not.toContain("College Pitch Average");
});
it("renders all five ranges, source and observed grade in the accessible information dialog",()=>{
 const html=renderToStaticMarkup(createElement(StatInfo,{metric:"pitching_whip",label:"WHIP",value:1.2}));
 for(const text of ["Poor","Below Average","Average","Good","Elite","NWC","Current","role=\"dialog\""])expect(html).toContain(text);
 expect(html).toContain("Lower is better");
 const neutral=renderToStaticMarkup(createElement(StatInfo,{metric:"height",cohort:[68,69,70,71,72],unit:"in"}));
 expect(neutral).toContain("Numerical position only");expect(neutral).not.toContain(">Elite<");
 const count=renderToStaticMarkup(createElement(StatInfo,{metric:"pumps"}));expect(count).toContain("playing time");expect(count).not.toContain(">Elite<");
});
it("keeps every published cutoff finite, ordered, and backed by at least five references",()=>{
 for(const scope of [reference.team,reference.player])for(const b of Object.values(scope)){
 expect(b.n).toBeGreaterThanOrEqual(5);expect(b.cuts).toHaveLength(4);expect(b.cuts.every(Number.isFinite)).toBe(true);expect(b.cuts).toEqual([...b.cuts].sort((a,b)=>a-b));
 }
});

it("answers good-range questions with the actual supported numeric bands",()=>{
 for(const metric of ["batting_avg","batting_est_slg","pitching_k_bb","pitching_whip"]){
  const b=statBenchmark(metric)!;const rows=benchmarkRows(metric,b),guide=statRangeGuide(metric);
  expect(guide.heading).toBe("What is a good range?");expect(guide.summary).toContain(`Good: ${rows[3].range}`);expect(guide.summary).toContain(`Elite: ${rows[4].range}`);
 }
 expect(metricDirection("Pitch Type Average Velocity")).toBe("higher");
 expect(metricDirection("K/BB")).toBe("higher");
 expect(ungradedMetric("K/BB")).toBe(false);
 expect(statBenchmark("pitching_whip",{unit:"per9"})).toBeNull();
 expect(statBenchmark("pitching_whip",{unit:"decimal"})).not.toBeNull();
 expect(statBenchmark("batting_avg",{unit:"%"})).toBeNull();
});
it("never turns counts and chart measures into player grades even with a cohort",()=>{
 for(const key of ["punchies","base_hit","bb_outcome","classified_velocity_count","blast_swing_count","qpa_game_pa","pearson_r","r_squared","hitter_contact_map","pitch_mix_chart","pitch_separation_chart"]){
  expect(ungradedMetric(key),key).toBe(true);
  expect(pacificBenchmark(key,[1,2,3,4,5]),key).toBeNull();
  const guide=statRangeGuide(key,{cohort:[1,2,3,4,5]});expect(guide.summary.length,key).toBeGreaterThan(50);
 }
 expect(statRangeGuide("pearson_r").summary).toContain("−1 to +1");
 expect(statRangeGuide("r_squared").summary).toContain("no universal good cutoff");
 expect(statRangeGuide("classified_spin_count").detail).toContain("not a skill grade");
});
it("withholds numeric ideals for neutral, unsupported and undersized comparisons",()=>{
 for(const metric of ["height","weight","body_score","body_fat_pct","muscle_mass","classified_avg_spin","blast_attack_angle","bmr","whr"]){
  expect(metricDirection(metric),metric).toBe("neutral");
  expect(statRangeGuide(metric).heading,metric).toBe("No single ideal range");
  const b=pacificBenchmark(metric,[1,2,3,4,5]);expect(statRangeGuide(metric,{},b).heading).toBe("Typical recorded range");
 }
 expect(statRangeGuide("max_exit_velocity",{cohort:[1,2,3,4]}).heading).toBe("Good range unavailable");
 expect(statRangeGuide("Unconfirmed Team Field").detail).toContain("stays unavailable");
 expect(statRangeGuide("batting_production_plus").summary).toContain("100");
 expect(statRangeGuide("batting_production_plus").detail).toContain("not wRC+");
 const html=renderToStaticMarkup(createElement(StatInfo,{metric:"max_exit_velocity",percentile:95,unit:"mph"}));
 expect(html).toContain("Good range unavailable");expect(html).not.toContain("Current");expect(html).not.toContain("80–100th percentile");
});
it("never applies a Blast reference in the wrong valid metric unit",()=>{
 expect(blastReference("avg_bat_speed",{source:"blast_fall",unit:"deg"})).toBeNull();
 expect(blastReference("blast_time_to_contact",{source:"blast_fall",unit:"mph"})).toBeNull();
 expect(blastReference("avg_bat_speed",{source:"blast_fall"})).toBeNull();
 expect(statRangeGuide("Average Bat Speed",{source:"blast_fall",unit:"mph"}).summary).toContain("66–75 mph");
});
