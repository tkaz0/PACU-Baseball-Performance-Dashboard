import type { Measurement } from "@/lib/imports/engine";
import { normalizePlayerMetric, validatePlayerMetricValue, PLAYER_METRICS } from "@/lib/player-performance";

export type ReviewedPerformanceRow = {
  observation_id: string; athlete_code: string; metric_key: string; measured_at: string;
  value: number; unit: string; source: string; source_file: string; source_sheet: string;
  source_row: number; file_hash: string;
};
type ExtraMetric = { key: string; units: readonly string[] };
const extraMetrics: ReadonlyMap<string, ExtraMetric> = new Map<string, ExtraMetric>([
  ...[
    ["Body Fat Mass", "body_fat_mass"], ["Bone Mass", "bone_mass"], ["Protein Mass", "protein_mass"],
    ["Body Water Mass", "body_water_mass"], ["Muscle Mass", "muscle_mass"], ["Skeletal Muscle Mass", "skeletal_muscle_mass"],
    ["Fat-Free Mass", "fat_free_mass"],
  ].map(([label,key]) => [label.toLowerCase(), { key, units: ["lb","kg"] }] as const),
  ...[
    ["Subcutaneous Fat", "subcutaneous_fat_pct"], ["Skeletal Muscle Percentage", "skeletal_muscle_pct"],
    ["Body Water Percentage", "body_water_pct"], ["Protein Percentage", "protein_pct"], ["Bone Mass Percentage", "bone_mass_pct"],
  ].map(([label,key]) => [label.toLowerCase(), { key, units: ["%"] }] as const),
  ["bmi", { key: "bmi", units: ["kg/m²"] }], ["bmr", { key: "bmr", units: ["kcal","kcal/day"] }],
  ["metabolic age", { key: "metabolic_age", units: ["years"] }], ["visceral fat", { key: "visceral_fat", units: ["index","grade"] }],
  ["skeletal muscle index", { key: "smi", units: ["kg/m²"] }], ["waist-to-hip ratio", { key: "whr", units: ["ratio"] }],
]);
const textCell = (value: unknown, maximum: number, allowEmpty=false): value is string => typeof value === "string" &&
  value.length <= maximum && (allowEmpty || value.length>0) && value===value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
const dateCell = (value: string) => /^20\d{2}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;

/** No health interpretation or unit conversion: canonical labels/aliases only. */
export function prepareReviewedPerformanceRows(measurements: readonly Measurement[]): ReviewedPerformanceRow[] {
  if (!Array.isArray(measurements) || measurements.length<1 || measurements.length>500) throw new Error("Review 1–500 measurements in one shared import.");
  const observations=new Set<string>(), coordinates=new Set<string>();
  const rows=measurements.map((m,index) => {
    const fail=():never => {throw new Error(`Observation ${index+1} has an unsupported metric, invalid value or incomplete source provenance. No shared data was changed.`);};
    if (!m || !textCell(m.id,2000) || !textCell(m.athlete_code,40) || !/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(m.athlete_code) ||
      !textCell(m.metric,300) || !textCell(m.unit,80) || !textCell(m.source,100) || !textCell(m.source_file,300) ||
      !textCell(m.source_sheet,255,true) || !textCell(m.file_hash,64) || !/^[a-f0-9]{64}$/.test(m.file_hash) ||
      !Number.isSafeInteger(m.source_row) || m.source_row<1 || m.source_row>1000000 || !dateCell(m.measured_at) || !Number.isFinite(m.value)) return fail();
    let position: unknown;
    try {position=JSON.parse(m.id.startsWith("observation:")?m.id.slice(12):"");} catch {return fail();}
    if (!Array.isArray(position) || position.length!==4 || position[0]!==m.file_hash || position[1]!==m.source_sheet || position[2]!==m.source_row ||
      !Number.isSafeInteger(position[3]) || position[3]<0 || position[3]>10000 || observations.has(m.id) || coordinates.has(JSON.stringify(position))) return fail();
    observations.add(m.id);coordinates.add(JSON.stringify(position));
    const profile=normalizePlayerMetric(m.metric,m.unit);
    const extra=extraMetrics.get(m.metric.toLowerCase());
    const extraUnit=m.unit.toLowerCase()==="lbs"?"lb":m.unit.toLowerCase();
    const metric_key=profile?.key ?? extra?.key, unit=profile?.unit ?? extraUnit;
    if (!metric_key || (profile ? !validatePlayerMetricValue(profile.key,m.value,unit) : !extra?.units.includes(unit) || m.value<0 || (unit==="%" && m.value>100))) return fail();
    return {observation_id:m.id,athlete_code:m.athlete_code,metric_key,measured_at:m.measured_at,value:m.value,unit,
      source:m.source,source_file:m.source_file,source_sheet:m.source_sheet,source_row:m.source_row,file_hash:m.file_hash};
  });
  if (new TextEncoder().encode(JSON.stringify(rows)).byteLength>1048576) throw new Error("This shared measurement import exceeds 1 MiB. Review a smaller batch.");
  return rows;
}

export type PerformanceImportReview = {
  rows: ReviewedPerformanceRow[]; candidateMeasurements: Measurement[];
  excluded: { index: number; metric: string; unit: string; reason: string }[];
  errors: { index: number | null; message: string }[]; canApply: boolean;
};

/** Unknown metric names are explicit exclusions; invalid recognized metrics block saving. */
export function reviewPerformanceImport(measurements: readonly Measurement[]): PerformanceImportReview {
  const review: PerformanceImportReview = { rows: [], candidateMeasurements: [], excluded: [], errors: [], canApply: false };
  if (!Array.isArray(measurements) || measurements.length>20000) {
    review.errors.push({index:null,message:"Choose a valid workspace with at most 20,000 measurements."});
    return review;
  }
  for (const [index, m] of measurements.entries()) {
    if (!m || typeof m.metric!=="string" || typeof m.unit!=="string") {
      review.errors.push({index,message:"This observation is not a valid measurement."});continue;
    }
    // Retry the label against known units only to distinguish unknown labels from bad units.
    const recognized=extraMetrics.has(m.metric.trim().toLowerCase()) || PLAYER_METRICS.some(definition=>definition.units.some(unit=>normalizePlayerMetric(m.metric,unit)!==null));
    if (!recognized) {
      review.excluded.push({index,metric:m.metric,unit:m.unit,reason:"This metric is not in the shared performance catalog."});continue;
    }
    try {
      const [row]=prepareReviewedPerformanceRows([m]);
      review.rows.push(row);
      // A backup may contain unknown properties. Only reviewed numerical fields may
      // cross the upload boundary; never forward the original object or its extras.
      review.candidateMeasurements.push({
        id:m.id,athlete_code:m.athlete_code,measured_at:m.measured_at,source:m.source,
        metric:m.metric,value:m.value,unit:m.unit,source_file:m.source_file,
        source_sheet:m.source_sheet,source_row:m.source_row,file_hash:m.file_hash,
      });
    } catch {
      review.errors.push({index,message:"Review this recognized metric's unit, value, athlete code, date and source provenance before sharing."});
    }
  }
  if (review.candidateMeasurements.length) {
    try {review.rows=prepareReviewedPerformanceRows(review.candidateMeasurements);} catch (error) {
      review.errors.push({index:null,message:error instanceof Error?error.message:"Review a smaller batch and remove duplicate observations."});
    }
  }
  review.canApply=review.rows.length>0 && review.errors.length===0;
  return review;
}
