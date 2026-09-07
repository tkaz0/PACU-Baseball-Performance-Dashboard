import "server-only";
import { requireAdminMutation } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/types";

export type RenphoReportCatalogItem = {
  fileHash: string;
  athleteCode: string;
  athleteName: string;
  sourceFile: string;
  measuredAt: string;
  measurementCount: number;
  hasHeight: boolean;
};

type ReportMetadata = {
  file_hash: string; athlete_id: string; source_file: string; measured_at: string;
  metric_key: string; observation_id: string; source_sheet: string;
};
type AthleteMetadata = { id: string; athlete_code: string; first_name: string; preferred_name: string | null; last_name: string };
const MEASUREMENT_FIELDS = "file_hash,athlete_id,source_file,measured_at,metric_key,observation_id,source_sheet";
const ATHLETE_FIELDS = "id,athlete_code,first_name,preferred_name,last_name";
const PAGE_SIZE = 500, MAX_MEASUREMENTS = 20000, MAX_ATHLETES = 1000, ATHLETES_PER_QUERY = 100;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exactFields = (value: Record<string, unknown>, fields: string) => Object.keys(value).sort().join(",") === fields.split(",").sort().join(",");
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.length > 0 && value.length <= max && !!value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
const validDate = (value: unknown): value is string => typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const fail = (): never => { throw new Error("The RENPHO report list could not be verified. Refresh before correcting a report."); };

/** Exact counts reject truncated provider pages and a changing catalog. */
async function readPages<T>(request: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown; count: number | null }>, parse: (row: unknown) => T, maximum: number): Promise<T[]> {
  const rows: T[] = []; let expectedCount: number | undefined;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await request(offset, offset + PAGE_SIZE - 1);
    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count === null || result.count < 0 || result.count > maximum
      || (expectedCount !== undefined && result.count !== expectedCount)) return fail();
    expectedCount = result.count;
    if (result.data.length !== Math.min(PAGE_SIZE, Math.max(0, expectedCount - offset))) return fail();
    rows.push(...result.data.map(parse));
    if (rows.length === expectedCount) return rows;
  }
}

function measurement(value: unknown): ReportMetadata {
  if (!object(value) || !exactFields(value, MEASUREMENT_FIELDS)
    || typeof value.file_hash !== "string" || !/^[a-f0-9]{64}$/.test(value.file_hash)
    || typeof value.athlete_id !== "string" || !UUID_PATTERN.test(value.athlete_id)
    || !text(value.source_file, 300) || !validDate(value.measured_at)
    || typeof value.source_sheet !== "string" || value.source_sheet.length > 255 || !/^RENPHO report · Page [1-9][0-9]*$/.test(value.source_sheet)
    || typeof value.metric_key !== "string" || !/^[a-z][a-z0-9_]{0,99}$/.test(value.metric_key)
    || !text(value.observation_id, 2000)) return fail();
  return value as ReportMetadata;
}

function athlete(value: unknown, allowedIds: ReadonlySet<string>): AthleteMetadata {
  if (!object(value) || !exactFields(value, ATHLETE_FIELDS)
    || typeof value.id !== "string" || !allowedIds.has(value.id)
    || typeof value.athlete_code !== "string" || !/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(value.athlete_code)
    || !text(value.first_name, 100) || !text(value.last_name, 100)
    || !(value.preferred_name === null || text(value.preferred_name, 100))) return fail();
  return value as AthleteMetadata;
}

/** Admin-only review metadata. No numeric readings, account details, or report images are selected. */
export async function loadRenphoReportCatalog(): Promise<RenphoReportCatalogItem[]> {
  const { supabase } = await requireAdminMutation();
  const measurements = await readPages((from, to) => supabase.from("performance_measurements")
    .select(MEASUREMENT_FIELDS, { count: "exact" }).eq("source", "RENPHO").like("source_sheet", "RENPHO report · Page %").order("observation_id", { ascending: true }).range(from, to), measurement, MAX_MEASUREMENTS);
  if (new Set(measurements.map(row => row.observation_id)).size !== measurements.length) return fail();
  const ids = [...new Set(measurements.map(row => row.athlete_id))].sort();
  if (ids.length > MAX_ATHLETES) return fail();
  const athletes: AthleteMetadata[] = [];
  for (let offset = 0; offset < ids.length; offset += ATHLETES_PER_QUERY) {
    const batchIds = ids.slice(offset, offset + ATHLETES_PER_QUERY), allowed = new Set(batchIds);
    const rows = await readPages((from, to) => supabase.from("athletes")
      .select(ATHLETE_FIELDS, { count: "exact" }).in("id", batchIds).order("id", { ascending: true }).range(from, to), value => athlete(value, allowed), batchIds.length);
    if (rows.length !== batchIds.length) return fail();
    athletes.push(...rows);
  }
  if (new Set(athletes.map(row => row.id)).size !== athletes.length || new Set(athletes.map(row => row.athlete_code)).size !== athletes.length) return fail();
  const byId = new Map(athletes.map(row => [row.id, row]));
  const reports = new Map<string, RenphoReportCatalogItem>();
  for (const row of measurements) {
    const owner = byId.get(row.athlete_id);
    if (!owner) return fail();
    const current = reports.get(row.file_hash);
    if (current) {
      if (current.athleteCode !== owner.athlete_code || current.measuredAt !== row.measured_at || current.measurementCount >= 500) return fail();
      // A byte-identical image may be renamed before a height-only backfill.
      // Keep one deterministic representative, matching the SQL preview.
      if (row.source_file < current.sourceFile) current.sourceFile = row.source_file;
      current.measurementCount++;
      current.hasHeight ||= row.metric_key === "height";
    } else {
      reports.set(row.file_hash, { fileHash: row.file_hash, athleteCode: owner.athlete_code,
        athleteName: `${owner.preferred_name || owner.first_name} ${owner.last_name}`, sourceFile: row.source_file,
        measuredAt: row.measured_at, measurementCount: 1, hasHeight: row.metric_key === "height" });
    }
  }
  return [...reports.values()].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt) || a.athleteName.localeCompare(b.athleteName, "en") || a.fileHash.localeCompare(b.fileHash));
}
