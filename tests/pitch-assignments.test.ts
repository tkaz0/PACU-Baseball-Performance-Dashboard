import { it, expect } from "vitest";
import { DEFAULT_PITCH_GUIDELINES, assignPitchRows, validatePitchAssignments, summarizeAssignedPitches, suggestPitchTypes } from "@/lib/imports/pitch-assignments";
import { groupPitchRanges, type FullSwingSession } from "@/lib/imports/full-swing-session";
const pitch=(sourceRow:number,velocity:number|null,spin:number|null):FullSwingSession["pitches"][number]=>({identity:"Fictional Pitcher",sourceRow,pitchNumber:sourceRow-1,velocity,spin});
it("suggests only the owner-defined speed/spin patterns, leaving boundaries and missing readings unknown",()=>{
 const result=suggestPitchTypes([pitch(2,80,2000),pitch(3,68,2400),pitch(4,70,1600),pitch(5,70,2000),pitch(6,80,null),pitch(7,90,2000),pitch(8,75,1900),pitch(9,85,2200),pitch(10,70,2200),pitch(11,70,1900)]);
 expect(result.map(r=>[r.sourceRow,r.pitchType])).toEqual([[2,"Fastball"],[3,"Breaking Ball"],[4,"Changeup"],[8,"Fastball"],[9,"Fastball"]]);
});
it("assigns an entire range, overrides one pitch, and keeps row labels when ranges change",()=>{
 const pitches=[pitch(2,80,2000),pitch(3,81,2050),pitch(4,69,1600)];
 let assignments=assignPitchRows([],groupPitchRanges(pitches)[0].sourceRows,"Fastball");
 assignments=assignPitchRows(assignments,[3],"Cutter");
 expect(assignments).toEqual([{sourceRow:2,pitchType:"Fastball"},{sourceRow:3,pitchType:"Cutter"}]);
 expect(groupPitchRanges(pitches,10,500).flatMap(r=>r.sourceRows).sort()).toEqual([2,3,4]);
 expect(assignPitchRows(assignments,[2],"")).toEqual([{sourceRow:3,pitchType:"Cutter"}]);
 expect(summarizeAssignedPitches(pitches,assignments).map(r=>r.pitchType)).toEqual(["Fastball","Cutter","Unassigned"]);
});
it("validates labels, bounds, duplicates and unexpected properties",()=>{
 for(const invalid of [[{sourceRow:1,pitchType:"Fastball"}],[{sourceRow:2,pitchType:"Guess"}],[{sourceRow:2,pitchType:"Slider",raw:"no"}],[{sourceRow:2,pitchType:"Slider"},{sourceRow:2,pitchType:"Curveball"}]])expect(()=>validatePitchAssignments(invalid)).toThrow();
});
it("does not turn missing spin into a zero in assigned summaries",()=>{
 expect(summarizeAssignedPitches([pitch(2,80,null),pitch(3,82,2000)],[{sourceRow:2,pitchType:"Fastball"},{sourceRow:3,pitchType:"Fastball"}])[0]).toMatchObject({count:2,averageVelocity:81,averageSpin:2000,spinCount:1});
});

it("lets pitcher guidelines vary without cross-player changes and withholds overlapping rules",()=>{
 const a=pitch(2,88,2300), b={...pitch(3,88,2300),identity:"Fictional Second Pitcher"};
 const guidelines={...DEFAULT_PITCH_GUIDELINES,fastMin:85,fastMax:92,fastSpinMin:2100,fastSpinMax:2500};
 expect(suggestPitchTypes([a,b],{[a.identity]:guidelines}).map(s=>s.sourceRow)).toEqual([2]);
 expect(suggestPitchTypes([pitch(4,70,1700)],{[a.identity]:{...DEFAULT_PITCH_GUIDELINES,breakingSpinAbove:1600}})).toEqual([]);
 expect(suggestPitchTypes([a],{[a.identity]:{...guidelines,fastMin:95}})).toEqual([]);
});
