import type { FullSwingSession } from "@/lib/imports/full-swing-session";
export const PITCH_TYPES = ["Fastball", "Breaking Ball", "Four-Seam Fastball", "Two-Seam Fastball", "Sinker", "Cutter", "Slider", "Sweeper", "Curveball", "Changeup", "Splitter", "Knuckleball", "Other"] as const;
export type PitchType = typeof PITCH_TYPES[number];
export type PitchAssignment = { sourceRow: number; pitchType: PitchType };
export type PitchAssignmentSnapshot = { version: number; assignments: PitchAssignment[] };
export function validatePitchAssignments(value: unknown): PitchAssignment[] {
  if (!Array.isArray(value) || value.length > 5000) throw new Error("Review the pitch assignments.");
  const seen = new Set<number>();
  return value.map(row => {
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).length !== 2 || !Number.isSafeInteger(row.sourceRow) || row.sourceRow < 2 || row.sourceRow > 5001 || seen.has(row.sourceRow) || !PITCH_TYPES.includes(row.pitchType)) throw new Error("Review the pitch assignments.");
    seen.add(row.sourceRow);
    return { sourceRow: row.sourceRow, pitchType: row.pitchType as PitchType };
  }).sort((a,b)=>a.sourceRow-b.sourceRow);
}
export function assignPitchRows(assignments: PitchAssignment[], sourceRows: number[], pitchType: PitchType | ""): PitchAssignment[] {
  const selected = new Set(sourceRows);
  return validatePitchAssignments([...assignments.filter(a=>!selected.has(a.sourceRow)), ...(pitchType ? sourceRows.map(sourceRow=>({sourceRow,pitchType})) : [])]);
}
export function summarizeAssignedPitches(pitches: FullSwingSession["pitches"], assignments: PitchAssignment[]) {
  const types = new Map(assignments.map(a=>[a.sourceRow,a.pitchType]));
  const groups = new Map<string, { identity: string; pitchType: PitchType | "Unassigned"; count: number; velocities: number[]; spins: number[] }>();
  for (const pitch of pitches) {
    const pitchType=types.get(pitch.sourceRow)??"Unassigned", key=JSON.stringify([pitch.identity,pitchType]);
    const g=groups.get(key)??{identity:pitch.identity,pitchType,count:0,velocities:[],spins:[]};
    g.count++; if(pitch.velocity!==null)g.velocities.push(pitch.velocity);if(pitch.spin!==null)g.spins.push(pitch.spin);groups.set(key,g);
  }
  const average=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  return [...groups.values()].map(g=>({identity:g.identity,pitchType:g.pitchType,count:g.count,averageVelocity:average(g.velocities),maxVelocity:g.velocities.length?Math.max(...g.velocities):null,velocityCount:g.velocities.length,averageSpin:average(g.spins),maxSpin:g.spins.length?Math.max(...g.spins):null,spinCount:g.spins.length}));
}

/** Team-requested starting ranges, not a validated pitch classifier. Suggestions need staff review. */
export type PitchGuidelines = {
  fastMin: number; fastMax: number; fastSpinMin: number; fastSpinMax: number;
  breakingMin: number; breakingMax: number; breakingSpinAbove: number;
  changeMin: number; changeMax: number; changeSpinBelow: number;
};
export const DEFAULT_PITCH_GUIDELINES: PitchGuidelines = { fastMin:75,fastMax:85,fastSpinMin:1900,fastSpinMax:2200,breakingMin:65,breakingMax:70,breakingSpinAbove:2200,changeMin:68,changeMax:72,changeSpinBelow:1900 };
export function validPitchGuidelines(g: PitchGuidelines): boolean {
  return Object.values(g).every(n=>Number.isFinite(n)&&n>=0) && g.fastMin<=g.fastMax && g.breakingMin<=g.breakingMax && g.changeMin<=g.changeMax && g.fastSpinMin<=g.fastSpinMax;
}
export function suggestPitchTypes(pitches: FullSwingSession["pitches"], guidelines: Readonly<Record<string,PitchGuidelines>> = {}) {
  return pitches.flatMap(p=>{
    if(p.velocity===null || p.spin===null)return [];
    const g=guidelines[p.identity]??DEFAULT_PITCH_GUIDELINES;
    if(!validPitchGuidelines(g))return [];
    const candidates: {pitchType:PitchType;reason:string}[]=[];
    if(p.velocity>=g.fastMin && p.velocity<=g.fastMax && p.spin>=g.fastSpinMin && p.spin<=g.fastSpinMax)candidates.push({pitchType:"Fastball",reason:`${g.fastMin}–${g.fastMax} mph and ${g.fastSpinMin}–${g.fastSpinMax} RPM.`});
    if(p.velocity>=g.changeMin && p.velocity<=g.changeMax && p.spin<g.changeSpinBelow)candidates.push({pitchType:"Changeup",reason:`${g.changeMin}–${g.changeMax} mph and spin below ${g.changeSpinBelow} RPM.`});
    if(p.velocity>=g.breakingMin && p.velocity<=g.breakingMax && p.spin>g.breakingSpinAbove)candidates.push({pitchType:"Breaking Ball",reason:`${g.breakingMin}–${g.breakingMax} mph and spin above ${g.breakingSpinAbove} RPM. Slider versus curveball needs review.`});
    // Overlapping customized rules do not silently prefer one pitch type.
    return candidates.length===1?[{sourceRow:p.sourceRow,...candidates[0]}]:[];
  });
}
