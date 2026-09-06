import "server-only";
import { requireImportAccess } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/types";
import { getTestingChecklist, isTestingEligible, isTestingRosterActive, pacificTestingDate, testingMetric, validTestingDate,
  type TestingAthlete, type TestingChecklist, type TestingObservation } from "@/lib/testing-checklist";

type StaffAccess = Awaited<ReturnType<typeof requireImportAccess>>;
const PAGE_SIZE = 500, MAX_ROSTER = 1000, MAX_OBSERVATIONS = 20000, ATHLETES_PER_QUERY = 100;
const rosterFields = "id,athlete_code,first_name,preferred_name,last_name,athlete_seasons";
const seasonFields = "season,jersey_number,primary_position,secondary_position,player_type,roster_status";
const readingFields = "observation_id,athlete_id,metric_key,value,unit,measured_at,source,imported_at,file_hash,source_sheet";
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exactFields = (value: Record<string, unknown>, fields: string) => Object.keys(value).sort().join(",") === fields.split(",").sort().join(",");
const textField = (value: unknown, max: number): value is string => typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const nullableText = (value: unknown, max: number): value is string | null => value === null || textField(value, max);
const fail = (): never => { throw new Error("The testing checklist could not be verified. Refresh before recording results."); };

/** Exact counts and deterministic pages prevent a provider limit becoming false missing data. */
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

function rosterAthlete(value: unknown): TestingAthlete {
  if (!object(value) || !exactFields(value, rosterFields) || typeof value.id !== "string" || !UUID_PATTERN.test(value.id)
    || typeof value.athlete_code !== "string" || !/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(value.athlete_code)
    || !textField(value.first_name, 100) || !value.first_name.trim() || !textField(value.last_name, 100) || !value.last_name.trim()
    || !nullableText(value.preferred_name, 100) || !Array.isArray(value.athlete_seasons) || value.athlete_seasons.length !== 1) return fail();
  const season = value.athlete_seasons[0];
  if (!object(season) || !exactFields(season, seasonFields) || season.season !== "2026-27"
    || (season.jersey_number !== null && (!Number.isSafeInteger(season.jersey_number) || (season.jersey_number as number) < 0 || (season.jersey_number as number) > 99))
    || !nullableText(season.primary_position, 100) || !nullableText(season.secondary_position, 100) || !nullableText(season.player_type, 100) || !nullableText(season.roster_status, 100)) return fail();
  return { id: value.id, athleteCode: value.athlete_code, name: `${value.preferred_name || value.first_name} ${value.last_name}`,
    jerseyNumber: season.jersey_number as number | null, primaryPosition: season.primary_position, secondaryPosition: season.secondary_position,
    playerType: season.player_type, rosterStatus: season.roster_status };
}

async function readRoster(access: StaffAccess): Promise<TestingAthlete[]> {
  const roster = await readPages((from, to) => access.supabase.from("athletes")
    .select(`id,athlete_code,first_name,preferred_name,last_name,athlete_seasons!inner(${seasonFields})`, { count: "exact" })
    .eq("athlete_seasons.season", "2026-27").order("id").range(from, to), rosterAthlete, MAX_ROSTER);
  if (new Set(roster.map(athlete => athlete.id)).size !== roster.length || new Set(roster.map(athlete => athlete.athleteCode)).size !== roster.length) return fail();
  return roster.filter(isTestingRosterActive).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.athleteCode.localeCompare(b.athleteCode));
}

export async function loadTestingRoster(): Promise<TestingAthlete[]> {
  return readRoster(await requireImportAccess());
}

function observation(value: unknown, athleteIds: ReadonlySet<string>, metricKeys: ReadonlySet<string>): TestingObservation {
  if (!object(value) || !exactFields(value, readingFields) || !textField(value.observation_id, 2000)
    || typeof value.athlete_id !== "string" || !athleteIds.has(value.athlete_id) || typeof value.metric_key !== "string" || !metricKeys.has(value.metric_key)
    || typeof value.value !== "number" || !Number.isFinite(value.value) || !textField(value.unit, 30)
    || typeof value.measured_at !== "string" || !validTestingDate(value.measured_at) || !textField(value.source, 100) || !value.source.trim()
    || typeof value.imported_at !== "string" || !Number.isFinite(Date.parse(value.imported_at))
    || typeof value.file_hash !== "string" || !/^[a-f0-9]{64}$/.test(value.file_hash)
    || typeof value.source_sheet !== "string" || value.source_sheet.length > 255 || /[\u0000-\u001f\u007f]/.test(value.source_sheet)) return fail();
  return { observationId: value.observation_id, athleteId: value.athlete_id, metricKey: value.metric_key, value: value.value, unit: value.unit,
    measuredAt: value.measured_at, source: value.source, importedAt: value.imported_at, fileHash: value.file_hash, sourceSheet: value.source_sheet };
}

export async function loadTestingChecklist(metricKey: string): Promise<TestingChecklist> {
  const access = await requireImportAccess();
  if (!testingMetric(metricKey)) throw new Error("Choose a valid testing measurement.");
  const today = pacificTestingDate();
  const roster = await readRoster(access);
  const athletes = roster.filter(athlete => isTestingEligible(athlete, metricKey));
  const readings: TestingObservation[] = [];
  if (today >= "2026-09-01") {
    // Bound URL length and query count; one batched query for a normal team roster.
    for (let offset = 0; offset < athletes.length; offset += ATHLETES_PER_QUERY) {
      const ids = athletes.slice(offset, offset + ATHLETES_PER_QUERY).map(athlete => athlete.id);
      const idSet = new Set(ids);
      const metricKeys = metricKey === "muscle_mass_pct" ? ["muscle_mass_pct", "weight", "muscle_mass"] : [metricKey];
      const metricSet = new Set(metricKeys);
      const page = await readPages((from, to) => {
        let query = access.supabase.from("performance_measurements").select(readingFields, { count: "exact" }).in("athlete_id", ids);
        query = metricKeys.length === 1 ? query.eq("metric_key", metricKey) : query.in("metric_key", metricKeys);
        return query.gte("measured_at", "2026-09-01").lte("measured_at", today < "2026-12-31" ? today : "2026-12-31").order("id").range(from, to);
      }, row => observation(row, idSet, metricSet), MAX_OBSERVATIONS - readings.length);
      readings.push(...page);
    }
  }
  if (new Set(readings.map(reading => reading.observationId)).size !== readings.length) return fail();
  return getTestingChecklist({ roster, observations: readings, metricKey, today });
}
