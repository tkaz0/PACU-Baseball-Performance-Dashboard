import { expect, it } from "vitest";
import { blastProgress, pitchProgress } from "@/lib/session-progress";
import { blastSource } from "@/lib/blast-metrics";
import type { Measurement } from "@/lib/imports/engine";

const entry=(id:string,source:string,metric:string,value:number,unit:string,date:string,hash:string):Measurement=>({id,athlete_code:"PAC-0001",measured_at:date,source,metric,value,unit,source_file:"fictional.csv",source_sheet:"CSV",source_row:2,file_hash:hash});
const week=(suffix:string,start:string,end:string,speed:number,count:number)=>{
  const source=blastSource("average",start,end),hash=suffix.repeat(64);
  return [entry(`${suffix}-speed`,source,"Average Bat Speed",speed,"mph",end,hash),entry(`${suffix}-count`,source,"Blast Swing Count",count,"count",end,hash)];
};
it("shows distinct Blast weekly averages with swing samples and excludes P95 swings",()=>{
  const p95=blastSource("p95","2026-09-13","2026-09-20");
  const rows=[...week("a","2026-09-13","2026-09-20",62,15),...week("b","2026-09-21","2026-09-27",68,22),entry("peak",p95,"Peak Bat Speed (95th)",78,"mph","2026-09-20","c".repeat(64))];
  expect(blastProgress(rows).find(item=>item.key==="avg_bat_speed")?.points.map(point=>[point.value,point.count])).toEqual([[62,15],[68,22]]);
  expect(blastProgress([...rows,...week("d","2026-09-20","2026-09-24",71,8)])).toEqual([]);
});
it("keeps classified pitch families, contexts and files separate",()=>{
  const make=(suffix:string,context:string,type:string,date:string,velocity:number,spin:number)=>{
    const hash=suffix.repeat(64),source=`Full Swing · ${context} · ${type}`;
    return [entry(`${suffix}-v`,source,"Pitch Type Average Velocity",velocity,"mph",date,hash),entry(`${suffix}-vc`,source,"Pitch Type Velocity Readings",6,"count",date,hash),entry(`${suffix}-s`,source,"Pitch Type Average Spin",spin,"rpm",date,hash),entry(`${suffix}-sc`,source,"Pitch Type Spin Readings",5,"count",date,hash)];
  };
  const rows=[...make("a","Intrasquad","Fastball","2026-09-11",80,2000),...make("b","Game","Fastball","2026-09-20",82,2100),...make("c","Practice","Fastball","2026-09-18",78,1900),...make("d","Intrasquad","Slider","2026-09-11",69,2300)];
  expect(pitchProgress(rows,"in_game").find(item=>item.label==="Fastball · Average Velocity")?.points.map(point=>point.value)).toEqual([80,82]);
  expect(pitchProgress(rows,"practice").find(item=>item.label==="Fastball · Average Velocity")?.points.map(point=>point.value)).toEqual([78]);
  expect(pitchProgress(rows,"in_game").find(item=>item.label==="Slider · Average Spin")?.points[0].count).toBe(5);
});
