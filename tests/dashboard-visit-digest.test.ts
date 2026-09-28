import {expect,it} from "vitest";
import {buildVisitDigest,visitMetricKey,type VisitReading,type VisitPlayer} from "@/lib/dashboard-visit-digest";
import {BLAST_MAIN_METRICS} from "@/lib/blast-fall";
import {BLAST_P95,blastSource} from "@/lib/blast-metrics";
const visit={since:"2026-09-20T00:00:00Z",viewedAt:"2026-09-27T00:00:00Z",record:true};
const reading=(id:string,value:number,importedAt:string,patch:Partial<VisitReading>={}):VisitReading=>({id,athleteId:"a",metric:"max_exit_velocity",label:"Max EV",source:"Full Swing · Intrasquad",unit:"mph",value,date:"2026-09-11",importedAt,...patch});
const run=(rows:VisitReading[])=>buildVisitDigest([{id:"a",name:"Fictional Player"}],rows,[],visit,"2026-09-26");
it("counts newly saved results once and recognizes backfilled Fall bests without inventing testing dates",()=>{
 const old=reading("1",90,"2026-09-19T00:00:00Z"),newer=reading("2",95,"2026-09-25T00:00:00Z");const r=run([old,newer,newer]);expect(r).toMatchObject({newResults:1,updatedPlayers:1,newBests:1});expect(r.bests[0]).toMatchObject({value:95,previous:90,measuredAt:"2026-09-11"});
});
it("keeps contexts and units separate and does not call first tests, ties, neutral body or spin personal bests",()=>{
 const old=reading("1",90,"2026-09-19T00:00:00Z");const patch=(metric:string)=>[reading(metric+"1",90,old.importedAt,{metric}),reading(metric+"2",100,"2026-09-25T00:00:00Z",{metric})];
 expect(run([old,reading("2",100,"2026-09-25T00:00:00Z",{source:"Full Swing · Practice"}),reading("3",120,"2026-09-25T00:00:00Z",{unit:"km/h"}),reading("4",90,"2026-09-25T00:00:00Z"),...patch("weight"),...patch("classified_max_spin")]).newBests).toBe(0);
});
it("recognizes lower timed bests but ignores future, other-player, count, non-Fall and invalid readings",()=>{
 const timed={metric:"home_to_first",unit:"s",source:"Player Metrics"};const a=reading("1",4.2,"2026-09-19T00:00:00Z",timed),b=reading("2",4.1,"2026-09-25T00:00:00Z",timed);
 expect(run([a,b,reading("3",99,"2026-09-28T00:00:00Z"),reading("4",99,b.importedAt,{athleteId:"b"}),reading("5",99,b.importedAt,{date:"2026-08-11"}),reading("6",99,b.importedAt,{metric:"classified_pitch_count"}),reading("7",0,b.importedAt,timed)] )).toMatchObject({newResults:1,newBests:1});
 expect(buildVisitDigest([{id:"a"}],[a,b],[],{...visit,since:null},"2026-09-26").newResults).toBe(0);
});

it("keeps pitcher-only, position-player and two-way updates aligned with their profile sections",()=>{
 const pair=(metric:string,unit:string,source="Full Swing · Intrasquad")=>[
  reading(`${metric}-old`,metric==="home_to_first"?4.2:80,"2026-09-19T00:00:00Z",{metric,unit,source}),
  reading(`${metric}-new`,metric==="home_to_first"?4.1:85,"2026-09-25T00:00:00Z",{metric,unit,source})
 ];
 const rows=[...pair("max_exit_velocity","mph"),...pair("home_to_first","s","Player Metrics"),...pair("max_pitch_velocity","mph"),...pair("classified_max_velocity","mph","Full Swing · Intrasquad · Fastball")];
 const result=(player:VisitPlayer)=>buildVisitDigest([player],rows,[],visit,"2026-09-26");
 expect(result({id:"a",playerType:"pitcher",position:"P"})).toMatchObject({newResults:2,newBests:2});
 expect(result({id:"a",playerType:"pitcher",position:"P"}).bests.every(b=>["max_pitch_velocity","classified_max_velocity"].includes(b.metric))).toBe(true);
 expect(result({id:"a",playerType:"position",position:"OF"})).toMatchObject({newResults:2,newBests:2});
 expect(result({id:"a",playerType:"two_way",position:"OF",secondaryPosition:"P"})).toMatchObject({newResults:4,newBests:4});
 // A pitching position still controls visibility when the explicit type has not caught up.
 expect(result({id:"a",playerType:"position",position:"OF",secondaryPosition:" p "})).toMatchObject({newResults:2,newBests:2});
});

it("keeps temporarily hidden timed tests and unrelated field-throwing results out of activity",()=>{
 const rows=["steal_break","steal_reaction","steal_12_42ft"].map(metric=>reading(metric,4,"2026-09-25T00:00:00Z",{metric,unit:"s"}));
 rows.push(reading("if",80,"2026-09-25T00:00:00Z",{metric:"infield_velocity"}),reading("of",85,"2026-09-25T00:00:00Z",{metric:"outfield_velocity"}));
 const result=buildVisitDigest([{id:"a",playerType:"position",position:"CF"}],rows,[],visit,"2026-09-26");
 expect(result).toMatchObject({newResults:1,updatedPlayers:1,newBests:0});
 expect(buildVisitDigest([{id:"a",playerType:"position",position:"SS",secondaryPosition:"RF"}],rows,[],visit,"2026-09-26").newResults).toBe(2);
});

it("counts the five main Blast metrics with valid signed angles and separate P95 summaries, never as personal bests",()=>{
 const rows=(kind:"average"|"p95")=>BLAST_MAIN_METRICS.map((base,index)=>{
  const metric=kind==="p95"&&base.key==="avg_bat_speed"?BLAST_P95:base;
  return reading(`${kind}-${metric.key}`,metric.signed?-20:60+index,"2026-09-25T00:00:00Z",{metric:visitMetricKey(metric.label,metric.unit),label:metric.label,unit:metric.unit,date:"2026-09-20",source:blastSource(kind,"2026-09-13","2026-09-20")});
 });
 const newRows=[...rows("average"),...rows("p95")];
 const older=newRows.map(r=>({...r,id:`old-${r.id}`,value:r.value-1,importedAt:"2026-09-19T00:00:00Z"}));
 const result=run([...older,...newRows]);
 expect(result).toMatchObject({newResults:10,updatedPlayers:1,newBests:0,bests:[]});
 expect(buildVisitDigest([{id:"a",playerType:"pitcher",position:"P"}],newRows,[],visit,"2026-09-26").newResults).toBe(0);
});

it("rejects wrong Blast source, unit, date and signed-value contracts without hiding valid negative angles",()=>{
 const angle=reading("angle",-30,"2026-09-25T00:00:00Z",{metric:"blast_vertical_bat_angle",label:"Vertical Bat Angle",unit:"deg",date:"2026-09-20",source:blastSource("average","2026-09-13","2026-09-20")});
 const rows=[angle,
  {...angle,id:"wrong-source",source:"RENPHO"},
  {...angle,id:"wrong-date",date:"2026-09-19"},
  {...angle,id:"wrong-unit",unit:"mph"},
  {...angle,id:"nonfinite",value:NaN},
  {...angle,id:"negative-speed",metric:"avg_bat_speed",unit:"mph"},
  {...angle,id:"other-metric",metric:"blast_body_tilt"},
  {...angle,id:"count",metric:"blast_swing_count",unit:"count",value:30},
  {...angle,id:"wrong-kind",metric:"p95_bat_speed",unit:"mph",value:70},
 ];
 expect(run(rows)).toMatchObject({newResults:1,updatedPlayers:1,newBests:0});
 expect(visitMetricKey("Peak Hand Speed","mph")).toBe("blast_peak_hand_speed");
 expect(visitMetricKey("Attack Angle","deg")).toBe("blast_attack_angle");
 expect(visitMetricKey("Vertical Bat Angle","mph")).toBe("");
});
