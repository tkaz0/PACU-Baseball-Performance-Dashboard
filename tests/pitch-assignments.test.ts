import { it, expect } from "vitest";
import { DEFAULT_PITCH_GUIDELINES, PITCH_TYPES, SELECTABLE_PITCH_TYPES, pitchTypeLabel, assignPitchRows, validatePitchAssignments, summarizeAssignedPitches, suggestPitchTypes } from "@/lib/imports/pitch-assignments";
import { groupPitchRanges, type FullSwingSession } from "@/lib/imports/full-swing-session";
const pitch=(sourceRow:number,velocity:number|null,spin:number|null):FullSwingSession["pitches"][number]=>({identity:"Fictional Pitcher",sourceRow,pitchNumber:sourceRow-1,velocity,spin});
it("suggests only the owner-defined speed/spin patterns, leaving boundaries and missing readings unknown",()=>{
 const result=suggestPitchTypes([pitch(2,80,2000),pitch(3,68,2400),pitch(4,70,1600),pitch(5,70,2000),pitch(6,80,null),pitch(7,90,2000),pitch(8,75,1900),pitch(9,85,2200),pitch(10,70,2200),pitch(11,70,1900)]);
 expect(result.map(r=>[r.sourceRow,r.pitchType])).toEqual([[3,"Breaking Ball"],[4,"Changeup"]]);
});
it("assigns an entire range, overrides one pitch, and keeps row labels when ranges change",()=>{
 const pitches=[pitch(2,80,2000),pitch(3,81,2050),pitch(4,69,1600)];
 let assignments=assignPitchRows([],groupPitchRanges(pitches)[0].sourceRows,"Four-Seam Fastball");
 assignments=assignPitchRows(assignments,[3],"Cutter");
 expect(assignments).toEqual([{sourceRow:2,pitchType:"Four-Seam Fastball"},{sourceRow:3,pitchType:"Cutter"}]);
 expect(groupPitchRanges(pitches,10,500).flatMap(r=>r.sourceRows).sort()).toEqual([2,3,4]);
 expect(assignPitchRows(assignments,[2],"")).toEqual([{sourceRow:3,pitchType:"Cutter"}]);
 expect(summarizeAssignedPitches(pitches,assignments).map(r=>r.pitchType)).toEqual(["Four-Seam Fastball","Cutter","Unassigned"]);
});
it("validates labels, bounds, duplicates and unexpected properties",()=>{
 for(const invalid of [[{sourceRow:1,pitchType:"Fastball"}],[{sourceRow:2,pitchType:"Guess"}],[{sourceRow:2,pitchType:"Slider",raw:"no"}],[{sourceRow:2,pitchType:"Slider"},{sourceRow:2,pitchType:"Curveball"}]])expect(()=>validatePitchAssignments(invalid)).toThrow();
});
it("does not turn missing spin into a zero in assigned summaries",()=>{
 expect(summarizeAssignedPitches([pitch(2,80,null),pitch(3,82,2000)],[{sourceRow:2,pitchType:"Fastball"},{sourceRow:3,pitchType:"Fastball"}])[0]).toMatchObject({count:2,averageVelocity:81,averageSpin:2000,spinCount:1});
});

it("lets pitcher guidelines vary without cross-player changes and withholds overlapping rules",()=>{
 const a=pitch(2,74,1700), b={...pitch(3,74,1700),identity:"Fictional Second Pitcher"};
 const guidelines={...DEFAULT_PITCH_GUIDELINES,changeMin:73,changeMax:75,changeSpinBelow:1800};
 expect(suggestPitchTypes([a,b],{[a.identity]:guidelines}).map(s=>s.sourceRow)).toEqual([2]);
 expect(suggestPitchTypes([pitch(4,70,1700)],{[a.identity]:{...DEFAULT_PITCH_GUIDELINES,breakingSpinAbove:1600}})).toEqual([]);
 expect(suggestPitchTypes([a],{[a.identity]:{...guidelines,changeMin:77}})).toEqual([]);
});

it("keeps legacy storage coordinates and labels readable but forbids new generic assignments",()=>{
 expect(PITCH_TYPES).toEqual(["Fastball", "Breaking Ball", "Four-Seam Fastball", "Two-Seam Fastball", "Sinker", "Cutter", "Slider", "Sweeper", "Curveball", "Changeup", "Splitter", "Knuckleball", "Other"]);
 expect(SELECTABLE_PITCH_TYPES).not.toContain("Fastball");
 expect(SELECTABLE_PITCH_TYPES).toContain("Four-Seam Fastball");
 const legacy=[{sourceRow:2,pitchType:"Fastball" as const}];
 expect(validatePitchAssignments(legacy)).toEqual(legacy);
 expect(assignPitchRows(legacy,[3],"Slider")).toEqual([...legacy,{sourceRow:3,pitchType:"Slider"}]);
 expect(()=>assignPitchRows([], [2], "Fastball")).toThrow("specific pitch type");
 expect(pitchTypeLabel("Fastball")).toBe("Unspecified Pitch");
 expect(pitchTypeLabel("Four-Seam Fastball")).toBe("4-Seam Fastball");
 expect(pitchTypeLabel("Two-Seam Fastball")).toBe("2-Seam Fastball");
 expect(pitchTypeLabel("Slider")).toBe("Slider");
});
it("does not infer a fastball subtype or let a family overlap become a changeup suggestion",()=>{
 expect(suggestPitchTypes([pitch(2,80,2000)])).toEqual([]);
 const overlapping={...DEFAULT_PITCH_GUIDELINES,fastMin:68,fastMax:72,fastSpinMin:1600,fastSpinMax:1900};
 expect(suggestPitchTypes([pitch(2,70,1700)],{"Fictional Pitcher":overlapping})).toEqual([]);
});
