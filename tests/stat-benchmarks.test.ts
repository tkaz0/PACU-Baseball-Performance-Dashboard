import { createElement } from "react";
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatInfo } from "@/components/stat-info";
import { benchmarkGrade, benchmarkRows, blastReference, pacificBenchmark, statBenchmark } from "@/lib/stat-benchmarks";
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
