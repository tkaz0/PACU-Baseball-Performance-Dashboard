import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ClassifiedPitchResults } from "@/components/classified-pitch-results";
import { prepareClassifiedPitchResults, type PitchResultContext } from "@/lib/imports/classified-pitch-results";
import type { FullSwingSession } from "@/lib/imports/full-swing-session";
import type { PitchAssignment } from "@/lib/imports/pitch-assignments";
import { prepareReviewedPerformanceRows } from "@/lib/performance-import";

const context:PitchResultContext={fileName:"Fictional session.csv",fileHash:"a".repeat(64),date:"2026-09-11",category:"intrasquad",matches:[{identity:"Fictional Pitcher",athleteCode:"SYN-001"}]};
const session:FullSwingSession={date:context.date,eventCount:6,pitcherCount:2,batterCount:0,players:[],samples:[],table:{headers:[],rows:[],rowNumbers:[]},pitches:[
  {identity:"Fictional Pitcher",sourceRow:2,pitchNumber:1,velocity:80.123,spin:2000.123},
  {identity:"Fictional Pitcher",sourceRow:3,pitchNumber:2,velocity:82.456,spin:null},
  {identity:"Fictional Pitcher",sourceRow:4,pitchNumber:3,velocity:null,spin:2100.456},
  {identity:"Fictional Pitcher",sourceRow:5,pitchNumber:4,velocity:68.789,spin:2400.123},
  {identity:"Fictional Pitcher",sourceRow:6,pitchNumber:5,velocity:99,spin:9999},
  {identity:"Fictional Excluded",sourceRow:7,pitchNumber:6,velocity:95,spin:2500},
]};
const labels:PitchAssignment[]=[{sourceRow:2,pitchType:"Fastball"},{sourceRow:3,pitchType:"Fastball"},{sourceRow:4,pitchType:"Fastball"},{sourceRow:5,pitchType:"Slider"},{sourceRow:7,pitchType:"Fastball"}];
it("keeps reviewed per-type maxima, means and sample counts separate without rounding stored values",()=>{
 const rows=prepareClassifiedPitchResults(session,labels,context), fast=rows.filter(r=>r.source.endsWith("Fastball"));
 const value=(name:string)=>fast.find(r=>r.metric===name)?.value;
 expect(rows).toHaveLength(14);
 expect(value("Pitch Type Max Velocity")).toBe(82.456);
 expect(value("Pitch Type Average Velocity")).toBe((80.123+82.456)/2);
 expect(value("Pitch Type Average Spin")).toBe((2000.123+2100.456)/2);
 expect(value("Pitch Type Max Spin")).toBe(2100.456);
 expect(value("Pitch Type Count")).toBe(3);
 expect(value("Pitch Type Velocity Readings")).toBe(2);
 expect(value("Pitch Type Spin Readings")).toBe(2);
 expect(rows.every(r=>r.athlete_code==="SYN-001")).toBe(true);
 expect(prepareReviewedPerformanceRows(rows)).toHaveLength(14);
});
it("excludes unknown labels and keeps stable coordinates when another pitch type is not selected",()=>{
 expect(prepareClassifiedPitchResults(session,[],context)).toEqual([]);
 const all=prepareClassifiedPitchResults(session,labels,context);
 const only=prepareClassifiedPitchResults(session,labels.filter(l=>l.pitchType==="Slider"),context);
 expect(only).toEqual(all.filter(r=>r.source.endsWith("Slider")));
 expect(()=>prepareClassifiedPitchResults(session,[{sourceRow:999,pitchType:"Fastball"}],context)).toThrow();
 expect(()=>prepareClassifiedPitchResults(session,labels,{...context,date:"2026-09-12"})).toThrow();
});
it("does not manufacture velocity or spin readings from missing values",()=>{
 const missing={...session,pitches:[{...session.pitches[0],velocity:null,spin:null}]};
 const rows=prepareClassifiedPitchResults(missing,[labels[0]],context);
 expect(rows.map(r=>[r.metric,r.value])).toEqual([["Pitch Type Count",1],["Pitch Type Velocity Readings",0],["Pitch Type Spin Readings",0]]);
 const html=renderToStaticMarkup(createElement(ClassifiedPitchResults,{readings:rows}));
 expect(html).toContain("—");expect(html).not.toContain("0.0");
});
it("requires the classified source, Fall date, correct units and integer counts",()=>{
 const rows=prepareClassifiedPitchResults(session,labels,context);
 for(const changes of [{source:"Full Swing"},{measured_at:"2026-08-11"},{unit:"ft"},{metric:"pitch type count",unit:"count",value:1.5}])expect(()=>prepareReviewedPerformanceRows([{...rows[0],...changes}])).toThrow();
});
it("renders four one-decimal results, sample sizes and separate sessions for the latest actual date",()=>{
 const rows=prepareClassifiedPitchResults(session,labels,context);
 const earlier=rows.map(r=>({...r,measured_at:"2026-09-10",source_file:"Old fictional session.csv"}));
 const html=renderToStaticMarkup(createElement(ClassifiedPitchResults,{readings:[...rows,...earlier]}));
 for(const text of ["81.3","82.5","2050.3","2100.5","n=2","Fastball","Slider"])expect(html).toContain(text);
 expect(html).not.toContain("82.456");expect(html).not.toContain("Old fictional");expect(html).not.toContain("Fictional Excluded");
});
