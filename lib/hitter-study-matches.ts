import { attackPath, type HitterSwingProfile } from "@/lib/hitter-swing-profile";
import { HITTER_STUDY_REFERENCES, type HitterStudyReference } from "@/lib/hitter-study-references";
import { FEATURED_HITTER_STUDY_IDS } from "@/lib/hitter-study-featured";

/** Custom PAC browsing windows, not cross-device calibration or ideal ranges. */
export const HITTER_STUDY_WINDOWS = { attackAngle: 5, heightInches: 3, weightLb: 30 } as const;
export type HitterStudyMatches = {
  matches: readonly HitterStudyReference[];
  basis: "path_and_size" | "path_and_height" | "path_and_weight" | "path_only" | "none";
  sizeFallback: boolean;
};

const positive = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value > 0 ? value : null;
const validReference = (reference: HitterStudyReference) => Number.isSafeInteger(reference.id) && reference.id > 0 &&
  typeof reference.name === "string" && reference.name.trim().length > 0 &&
  attackPath(reference.attackAngle) !== null && Number.isSafeInteger(reference.competitiveSwings) && reference.competitiveSwings > 0 &&
  positive(reference.heightInches) !== null && positive(reference.weightLb) !== null;

export type HitterStudyPreferences = { bats?: string | null; batSpeedPercentile?: number | null };
const featured = new Set<number>(FEATURED_HITTER_STUDY_IDS);
function uniqueReferences(references: readonly HitterStudyReference[]) {
  const counts = new Map<number,number>();
  references.forEach(reference=>counts.set(reference.id,(counts.get(reference.id)??0)+1));
  return references.filter(reference=>validReference(reference)&&counts.get(reference.id)===1);
}
/** Rank each MLB hitter against the complete public qualified cohort, never a filtered watch list. */
export function proBatSpeedPercentile(reference: HitterStudyReference, references: readonly HitterStudyReference[] = HITTER_STUDY_REFERENCES): {value:number;sampleSize:number}|null {
  const cohort=uniqueReferences(references).filter(item=>item.averageBatSpeed!==null && Number.isFinite(item.averageBatSpeed) && item.averageBatSpeed>=0);
  if(cohort.length<5 || reference.averageBatSpeed===null || !cohort.some(item=>item.id===reference.id && item.averageBatSpeed===reference.averageBatSpeed))return null;
  const below=cohort.filter(item=>item.averageBatSpeed!<reference.averageBatSpeed!).length;
  const equal=cohort.filter(item=>item.averageBatSpeed===reference.averageBatSpeed).length;
  return {value:100*(below+(equal-1)/2)/(cohort.length-1),sampleSize:cohort.length};
}
export function compatibleBattingSide(own:string|null|undefined, professional:HitterStudyReference["bats"]) {
  const side=own?.trim().toUpperCase();
  return side!=="R"&&side!=="L" || professional===side || professional==="S";
}

/** Select study examples using coarse direction and listed size, without a similarity score. */
export function hitterStudyMatches(profile: HitterSwingProfile, references: readonly HitterStudyReference[] = HITTER_STUDY_REFERENCES, preferences?:HitterStudyPreferences): HitterStudyMatches {
  const angle = profile.attackAngle;
  const path = attackPath(angle);
  if (angle === null || !path || !profile.path || path.key !== profile.path.key || profile.summary?.issues.length) {
    return { matches: [], basis: "none", sizeFallback: false };
  }
  const idCounts = new Map<number, number>();
  for (const reference of references) idCounts.set(reference.id, (idCounts.get(reference.id) ?? 0) + 1);
  // Omit all ambiguous IDs instead of letting input order choose a conflicting record.
  const candidates = references.filter(reference => validReference(reference) && idCounts.get(reference.id) === 1 &&
    attackPath(reference.attackAngle)?.key === path.key && Math.abs(reference.attackAngle - angle) <= HITTER_STUDY_WINDOWS.attackAngle);
  if (!candidates.length) return { matches: [], basis: "none", sizeFallback: false };

  const height = profile.height?.unit === "in" ? positive(profile.height.value) : null;
  const weight = profile.weight?.unit === "lb" ? positive(profile.weight.value) : null;
  const hasSize = height !== null || weight !== null;
  const byAngle = (a: HitterStudyReference, b: HitterStudyReference) => Math.abs(a.attackAngle - angle) - Math.abs(b.attackAngle - angle) || a.id - b.id;

  const sizeCandidates = candidates.filter(reference =>
    (height === null || Math.abs(reference.heightInches - height) <= HITTER_STUDY_WINDOWS.heightInches) &&
    (weight === null || Math.abs(reference.weightLb - weight) <= HITTER_STUDY_WINDOWS.weightLb));
  const sizeDistance = (reference: HitterStudyReference) =>
    (height === null ? 0 : Math.abs(reference.heightInches - height) / HITTER_STUDY_WINDOWS.heightInches) +
    (weight === null ? 0 : Math.abs(reference.weightLb - weight) / HITTER_STUDY_WINDOWS.weightLb);
  const usesSize=hasSize&&sizeCandidates.length>0;
  let shortlist=usesSize?sizeCandidates:candidates;
  const result:HitterStudyMatches={matches:[],basis:usesSize ? height!==null&&weight!==null?"path_and_size":height!==null?"path_and_height":"path_and_weight":"path_only",sizeFallback:hasSize&&!usesSize};
  if(!preferences)return {...result,matches:[...shortlist].sort(usesSize?(a,b)=>sizeDistance(a)-sizeDistance(b)||byAngle(a,b):byAngle).slice(0,3)};
  const ownPercentile=typeof preferences.batSpeedPercentile==="number"&&Number.isFinite(preferences.batSpeedPercentile)&&preferences.batSpeedPercentile>=0&&preferences.batSpeedPercentile<=100 ? preferences.batSpeedPercentile : null;
  const percentiles=new Map(references.map(reference=>[reference.id,proBatSpeedPercentile(reference,references)?.value??null]));
  const exceptional=(reference:HitterStudyReference)=>{
    const proPercentile=percentiles.get(reference.id)??null;
    const hasSpeed=ownPercentile!==null&&proPercentile!==null;
    return ((usesSize&&(height!==null||weight!==null))||hasSpeed) && Math.abs(reference.attackAngle-angle)<=2 &&
      (height===null||Math.abs(reference.heightInches-height)<=1) && (weight===null||Math.abs(reference.weightLb-weight)<=15) &&
      (!hasSpeed||Math.abs(proPercentile!-ownPercentile!)<=15);
  };
  const sameSide=(reference:HitterStudyReference)=>compatibleBattingSide(preferences.bats,reference.bats);
  if(shortlist.filter(sameSide).length>=3)shortlist=shortlist.filter(reference=>sameSide(reference)||exceptional(reference));
  const fit=(reference:HitterStudyReference)=>{
    const parts=[Math.abs(reference.attackAngle-angle)/5];
    if(usesSize&&height!==null)parts.push(Math.abs(reference.heightInches-height)/3);
    if(usesSize&&weight!==null)parts.push(Math.abs(reference.weightLb-weight)/30);
    const proPercentile=percentiles.get(reference.id)??null;
    if(ownPercentile!==null&&proPercentile!==null)parts.push(Math.abs(proPercentile-ownPercentile)/25);
    return parts.reduce((sum,value)=>sum+value,0)/parts.length + (exceptional(reference)?0:(featured.has(reference.id)?0:.6)+(sameSide(reference)?0:.75));
  };
  return {...result,matches:[...shortlist].sort((a,b)=>fit(a)-fit(b)||a.id-b.id).slice(0,3)};
}
