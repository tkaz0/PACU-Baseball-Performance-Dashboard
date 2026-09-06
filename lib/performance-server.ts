import "server-only";
import { createHash } from "node:crypto";
import type { Measurement } from "@/lib/imports/engine";
import type { ImportBatch, StoredMeasurement } from "@/lib/local-workspace";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { requireAccess, requireImportAccess } from "@/lib/auth";
import { UUID_PATTERN, type Athlete } from "@/lib/types";
import { prepareReviewedPerformanceRows } from "@/lib/performance-import";
import { validatePlayerMetricValue, PLAYER_METRICS, type PlayerPercentileOverride } from "@/lib/player-performance";

export type PerformanceImportReceipt = { import_id: string; created: number; unchanged: number };
export type AthletePerformanceData = {
  measurements: StoredMeasurement[]; batches: ImportBatch[]; percentileOverrides: PlayerPercentileOverride[];
};
type Access = Awaited<ReturnType<typeof requireAccess>>;
const dateCell = (value: string) => /^20\d{2}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;

/** Caller must obtain explicit review approval before invoking this application mutation. */
export async function importReviewedPerformance(measurements: readonly Measurement[]): Promise<PerformanceImportReceipt> {
  const {supabase}=await requireImportAccess();
  const rows=prepareReviewedPerformanceRows(measurements);
  const {data,error}=await supabase.rpc("admin_import_performance",{p_rows:rows});
  if(error) throw new Error("Shared measurements were not saved. Recheck the reviewed identities, canonical metrics and existing source observations.");
  if(!data || !UUID_PATTERN.test(data.import_id) || !Number.isSafeInteger(data.created) || !Number.isSafeInteger(data.unchanged) || data.created<0 || data.unchanged<0 || data.created+data.unchanged!==rows.length) throw new Error("The import result could not be verified. Refresh shared measurements before retrying.");
  return { import_id: data.import_id, created: data.created, unchanged: data.unchanged };
}

type DatabaseMeasurement = {
  observation_id:string;athlete_id:string;metric_key:string;metric:string;unit:string;value:number;measured_at:string;
  source:string;source_file:string;source_sheet:string;source_row:number;file_hash:string;import_id:string;imported_at:string;
};
const measurementFields = new Set(["observation_id", "athlete_id", "metric_key", "metric", "unit", "value", "measured_at",
  "source", "source_file", "source_sheet", "source_row", "file_hash", "import_id", "imported_at"]);
const batchIdentity=(row:DatabaseMeasurement)=>`performance:${createHash("sha256").update(JSON.stringify([row.import_id,row.file_hash,row.source])).digest("hex")}`;

function readMeasurementPage(data: unknown, athleteId: string): DatabaseMeasurement[] {
  if (!Array.isArray(data) || data.length > 1000) throw new Error("Shared measurement page format is invalid.");
  return data.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Shared measurement page format is invalid.");
    const row = item as Record<string, unknown>;
    if (row.athlete_id !== athleteId) throw new Error("Athlete performance access could not be verified.");
    const strings = ["observation_id", "metric_key", "metric", "unit", "source", "source_file", "source_sheet", "file_hash", "import_id", "imported_at"];
    if (Object.keys(row).length !== measurementFields.size || Object.keys(row).some(key => !measurementFields.has(key)) ||
      strings.some(key => typeof row[key] !== "string" || (key !== "source_sheet" && !(row[key] as string).length)) ||
      typeof row.measured_at !== "string" || !dateCell(row.measured_at) ||
      typeof row.value !== "number" || !Number.isFinite(row.value) || row.value < 0 ||
      !Number.isSafeInteger(row.source_row) || (row.source_row as number) < 1 || (row.source_row as number) > 1000000 ||
      !/^[a-f0-9]{64}$/.test(row.file_hash as string) || !UUID_PATTERN.test(row.import_id as string) ||
      !Number.isFinite(Date.parse(row.imported_at as string))) throw new Error("Shared measurement page format is invalid.");
    return row as DatabaseMeasurement;
  });
}

/** Restrict on the server as well as RLS: a preview keeps its real administrator JWT. */
export async function loadAthletePerformance(access:Access, athlete:Pick<Athlete,"id"|"athlete_code">):Promise<AthletePerformanceData> {
  if(!UUID_PATTERN.test(athlete.id) || !canReadPresentedAthlete(access,athlete.id)) throw new Error("Athlete performance access denied.");
  const stored:DatabaseMeasurement[]=[];
  for(let offset=0;offset<=20000;offset+=1000) {
    const {data,error}=await access.supabase.rpc("athlete_performance_measurements", {p_athlete_id:athlete.id,p_offset:offset});
    if(error) throw new Error("Shared performance measurements could not be loaded.");
    const page=readMeasurementPage(data,athlete.id);
    stored.push(...page);
    if(stored.length>20000) throw new Error("This profile exceeds the supported measurement history. Ask an administrator to review the archive.");
    if(page.length<1000) break;
  }
  if(new Set(stored.map(row=>row.observation_id)).size!==stored.length) throw new Error("Measurement history changed while loading. Refresh this profile.");
  const measurements:StoredMeasurement[]=stored.map(row=>({id:row.observation_id,athlete_code:athlete.athlete_code,measured_at:row.measured_at,metric:row.metric,unit:row.unit,value:row.value,
    source:row.source,source_file:row.source_file,source_sheet:row.source_sheet,source_row:row.source_row,file_hash:row.file_hash,batch_id:batchIdentity(row)}));
  // Metadata is reconstructed from permitted observations; players never read admin import receipts.
  const batchMap=new Map<string,ImportBatch>();
  for(const row of stored) {
    const key=batchIdentity(row);
    const batch=batchMap.get(key)??{id:key,kind:"measurements",fileName:row.source_file,source:row.source,importedAt:row.imported_at,created:0,updated:0,unchanged:0,fileHash:row.file_hash,sheetName:row.source_sheet};
    batch.created+=1;batchMap.set(key,batch);
  }
  const {data,error}=await access.supabase.rpc("athlete_performance_summary",{p_athlete_id:athlete.id});
  if(error || !Array.isArray(data)) throw new Error("Team comparison summaries could not be loaded.");
  const percentileOverrides:PlayerPercentileOverride[]=data.map((item:unknown)=>{
    if(!item || typeof item!=="object") throw new Error("Team comparison summary format is invalid.");
    const r=item as Record<string,unknown>, definition=PLAYER_METRICS.find(metric=>metric.key===r.metricKey);
    if(!definition || typeof r.unit!=="string" || !definition.units.includes(r.unit) || r.direction!==definition.direction ||
      typeof r.measuredAt!=="string" || !dateCell(r.measuredAt) || (r.period!=="fall_2026" && r.period!=="summer_2026") ||
      typeof r.observedValue!=="number" || !validatePlayerMetricValue(definition.key,r.observedValue,r.unit) ||
      typeof r.source!=="string" || !r.source.trim() || !Number.isSafeInteger(r.sampleSize) || (r.sampleSize as number)<0 ||
      (r.value!==null && (typeof r.value!=="number" || !Number.isFinite(r.value) || r.value<0 || r.value>100)) ||
      ((r.sampleSize as number)<5 && r.value!==null)) throw new Error("Team comparison summary format is invalid.");
    return {athleteCode:athlete.athlete_code,metricKey:definition.key,measuredAt:r.measuredAt,observedValue:r.observedValue,source:r.source,
      value:r.value as number|null,sampleSize:r.sampleSize as number,period:r.period,unit:r.unit,direction:definition.direction};
  });
  return {measurements,batches:[...batchMap.values()],percentileOverrides};
}
