import "server-only";
import { requireImportAccess } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/types";
import { buildSessionLibrary, type SessionReadingMetadata, type SessionContactMetadata, type SessionLibraryPlayer, type SessionPublication } from "@/lib/session-library";

const readingFields = "observation_id,athlete_id,file_hash,source_file,source,metric_key,measured_at,imported_at";
const contactFields = "athlete_id,file_hash,source_file,source_row,category,played_on,imported_at";
const playerFields = "id,athlete_code,first_name,preferred_name,last_name";
const fail = (): never => { throw new Error("Saved sessions could not be verified. Refresh to load the current session library."); };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, fields: string) => Object.keys(value).sort().join(",") === fields.split(",").sort().join(",");
const text = (value: unknown, max = 300): value is string => typeof value === "string" && !!value.trim() && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const id = (value: unknown): value is string => typeof value === "string" && UUID_PATTERN.test(value);
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const date = (value: unknown): value is string => typeof value === "string" && /^2026-(09|10|11|12)-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const timestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));

async function pages<T>(request: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown; count: number | null }>, parse: (value: unknown) => T, maximum: number) {
  const rows: T[] = []; let expected: number | undefined;
  for (let offset = 0; ; offset += 500) {
    const result = await request(offset, offset + 499);
    if (result.error || !Array.isArray(result.data) || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0 || result.count > maximum || (expected !== undefined && result.count !== expected) || result.data.length !== Math.min(500, Math.max(0, result.count - offset))) return fail();
    expected = result.count; rows.push(...result.data.map(parse));
    if (rows.length === expected) return rows;
  }
}

function reading(value: unknown): SessionReadingMetadata {
  if (!object(value) || !exact(value, readingFields) || !text(value.observation_id, 2000) || !id(value.athlete_id) || !hash(value.file_hash) || !text(value.source_file) || !text(value.source, 100) || !/^(Full Swing|Blast Motion) · /.test(value.source) || !text(value.metric_key, 100) || !date(value.measured_at) || !timestamp(value.imported_at)) return fail();
  return { observationId: value.observation_id, athleteId: value.athlete_id, fileHash: value.file_hash, sourceFile: value.source_file, source: value.source, metricKey: value.metric_key, date: value.measured_at, savedAt: value.imported_at };
}
function contact(value: unknown): SessionContactMetadata {
  if (!object(value) || !exact(value, contactFields) || !id(value.athlete_id) || !hash(value.file_hash) || !text(value.source_file) || !Number.isSafeInteger(value.source_row) || (value.source_row as number) < 2 || (value.source_row as number) > 1000000 || !["game", "intrasquad", "practice"].includes(value.category as string) || !date(value.played_on) || !timestamp(value.imported_at)) return fail();
  return { athleteId: value.athlete_id, fileHash: value.file_hash, sourceFile: value.source_file, sourceRow: value.source_row as number, category: value.category as SessionContactMetadata["category"], date: value.played_on, savedAt: value.imported_at };
}
function player(value: unknown, allowed: Set<string>): SessionLibraryPlayer {
  if (!object(value) || !exact(value, playerFields) || !id(value.id) || !allowed.has(value.id) || !text(value.athlete_code, 40) || !text(value.first_name, 100) || !text(value.last_name, 100) || (value.preferred_name !== null && !text(value.preferred_name, 100))) return fail();
  return { id: value.id, code: value.athlete_code, name: `${value.preferred_name || value.first_name} ${value.last_name}` };
}

export function parseSessionPublications(value: unknown): SessionPublication[] {
  const fields = "fileHash,fileName,date,category,mode,eventCount,revision,measurementCount,sampleCount,contactCount,assignedCount,unresolvedPitchCount,excludedPlayerCount,removedValueCount,publishedAt,lastUpdatedAt,fullyPublished,restoreTargetRevision";
  if (!Array.isArray(value) || value.length > 1000) return fail();
  const rows = value.map(row => {
    if (!object(row) || !exact(row, fields) || !hash(row.fileHash) || !text(row.fileName) || !date(row.date) || !["game", "intrasquad", "practice"].includes(row.category as string) || !text(row.mode, 80)
      || !["eventCount", "measurementCount", "sampleCount", "contactCount", "assignedCount", "unresolvedPitchCount", "excludedPlayerCount", "removedValueCount"].every(field => Number.isSafeInteger(row[field]) && (row[field] as number) >= 0 && (row[field] as number) <= 100000)
      || !Number.isSafeInteger(row.revision) || (row.revision as number) < 1 || !timestamp(row.publishedAt) || !timestamp(row.lastUpdatedAt) || typeof row.fullyPublished !== "boolean"
      || !(row.restoreTargetRevision === null || (Number.isSafeInteger(row.restoreTargetRevision) && (row.restoreTargetRevision as number) >= 1 && (row.restoreTargetRevision as number) < (row.revision as number)))) return fail();
    if (!row.fullyPublished && row.restoreTargetRevision !== null) return fail();
    return row as SessionPublication;
  });
  if (new Set(rows.map(row => row.fileHash)).size !== rows.length) return fail();
  return rows;
}

/** Fresh staff authorization precedes every ordinary-session/RLS query; no numerical values or emails are loaded. */
export async function loadSessionLibrary() {
  const { supabase } = await requireImportAccess();
  const [readings, contacts, publicationResponse] = await Promise.all([
    pages((from, to) => supabase.from("performance_display_measurements").select(readingFields, { count: "exact" }).or("source.like.Full Swing · %,source.like.Blast Motion · %").gte("measured_at", "2026-09-01").lte("measured_at", "2026-12-31").order("observation_id").range(from, to), reading, 50000),
    pages((from, to) => supabase.from("full_swing_contacts").select(contactFields, { count: "exact" }).gte("played_on", "2026-09-01").lte("played_on", "2026-12-31").order("file_hash").order("source_row").range(from, to), contact, 50000),
    supabase.rpc("staff_full_swing_session_publications"),
  ]);
  if (publicationResponse.error) return fail();
  const publications = parseSessionPublications(publicationResponse.data);
  const ids = [...new Set([...readings, ...contacts].map(row => row.athleteId))].sort();
  if (ids.length > 1000) return fail();
  const players: SessionLibraryPlayer[] = [];
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100), allowed = new Set(batch);
    const found = await pages((from, to) => supabase.from("athletes").select(playerFields, { count: "exact" }).in("id", batch).order("id").range(from, to), value => player(value, allowed), batch.length);
    if (found.length !== batch.length || new Set(found.map(person => person.id)).size !== found.length) return fail();
    players.push(...found);
  }
  return buildSessionLibrary(readings, contacts, players, publications);
}
