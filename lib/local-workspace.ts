import type { RosterAthlete } from "@/lib/types";
import Papa from "papaparse";
import { athleteCodeIndex, pacCodeForLegacy } from "@/lib/athlete-codes";
import { ROSTER_FIELDS, validateRosterValues, findRenphoAthlete, normalizeRenphoId, RENPHO_ID_PATTERN, MAX_RENPHO_ALIASES, type Measurement, type RosterField } from "@/lib/imports/engine";

export type ImportBatch = {
  id: string; kind: "roster" | "measurements"; fileName: string; source: string;
  importedAt: string; created: number; updated: number; unchanged: number;
  fileHash?: string; sheetName?: string; season?: string;
};
export type StoredMeasurement = Measurement & { batch_id: string };
export type LocalWorkspace = {
  version: 1; revision: number; mode: "sample" | "local";
  roster: RosterAthlete[]; measurements: StoredMeasurement[]; batches: ImportBatch[];
};
export type RenphoReportIdentity = { athleteCode: string; renphoId?: string; remember: boolean };
export const emptyWorkspace = (): LocalWorkspace => ({ version: 1, revision: 0, mode: "sample", roster: [], measurements: [], batches: [] });

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const str = (v: unknown, max = 300): v is string => typeof v === "string" && v.length <= max;
const optionalText = (v: unknown, max = 300) => v === null || str(v, max);
const optionalNumber = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v));
const CONTROL = /[\u0000-\u001f\u007f]/;
const SEASON = /^20\d{2}(-\d{2})?$/;
const FILE_HASH = /^[a-f0-9]{64}$/;
const IDENTITY_FIELDS = new Set<RosterField>(["athlete_code", "first_name", "preferred_name", "last_name", "pacific_email", "profile_photo_url", "renpho_id"]);
const rosterValues = (athlete: Record<string, unknown>, season?: Record<string, unknown>) => Object.fromEntries(
  ROSTER_FIELDS.map(field => [field, String((IDENTITY_FIELDS.has(field) ? athlete[field] : season?.[field]) ?? "")]),
) as Record<RosterField, string>;

/** Backups are data, never executable configuration. Reject incompatible or truncated files. */
export function validateWorkspace(value: unknown): LocalWorkspace {
  const fail = () => { throw new Error("This is not a valid PACU workspace backup. Your current data was not changed."); };
  if (!record(value) || value.version !== 1 || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0 || (value.mode !== "sample" && value.mode !== "local")) return fail();
  if (!Array.isArray(value.roster) || value.roster.length > 1000 || !Array.isArray(value.measurements) || value.measurements.length > 20000 || !Array.isArray(value.batches) || value.batches.length > 1000) return fail();
  const codes = new Set<string>();
  const emails = new Set<string>();
  const renphoIds = new Set<string>();
  for (const a of value.roster) {
    if (!record(a) || !str(a.athlete_code, 40) || !a.athlete_code || a.athlete_code !== a.athlete_code.trim().toUpperCase() || a.id !== a.athlete_code || codes.has(a.athlete_code) || !str(a.first_name, 80) || !a.first_name.trim() || a.first_name !== a.first_name.trim() || !str(a.last_name, 80) || !a.last_name.trim() || a.last_name !== a.last_name.trim() || !optionalText(a.preferred_name, 80) || !optionalText(a.pacific_email, 254) || !optionalText(a.profile_photo_url, 2048) || !str(a.created_at) || !str(a.updated_at) || !Array.isArray(a.athlete_seasons) || a.athlete_seasons.length > 100) return fail();
    if (validateRosterValues(rosterValues(a), 0).length) return fail();
    if (a.renpho_id !== undefined && !optionalText(a.renpho_id, 80)) return fail();
    if (a.renpho_ids !== undefined && (!Array.isArray(a.renpho_ids) || a.renpho_ids.length > MAX_RENPHO_ALIASES)) return fail();
    for (const id of [...(a.renpho_id ? [a.renpho_id] : []), ...(Array.isArray(a.renpho_ids) ? a.renpho_ids : [])]) {
      if (!str(id, 80) || !RENPHO_ID_PATTERN.test(id) || id !== normalizeRenphoId(id) || renphoIds.has(id)) return fail();
      renphoIds.add(id);
    }
    if (a.pacific_email) {
      const email = String(a.pacific_email);
      if (email !== email.trim().toLowerCase() || emails.has(email)) return fail();
      emails.add(email);
    }
    codes.add(a.athlete_code);
    if (a.athlete_code_aliases !== undefined && (!Array.isArray(a.athlete_code_aliases) || a.athlete_code_aliases.some(code => typeof code !== "string"))) return fail();
    const seasons = new Set<string>();
    for (const s of a.athlete_seasons) {
      if (!record(s) || s.athlete_id !== a.id || !str(s.season, 7) || !SEASON.test(s.season) || seasons.has(s.season) || !["jersey_number", "eligibility_year", "graduation_year"].every(k => optionalNumber(s[k])) || !["primary_position", "secondary_position", "player_type", "bats", "throws", "academic_class", "roster_status"].every(k => optionalText(s[k]))) return fail();
      if (validateRosterValues(rosterValues(a, s), 0).length) return fail();
      seasons.add(s.season);
    }
  }
  try { athleteCodeIndex(value.roster as RosterAthlete[]); } catch { return fail(); }
  const batchIds = new Set<string>();
  const measurementBatchIds = new Set<string>();
  for (const b of value.batches) {
    if (!record(b) || !str(b.id, 100) || !b.id || batchIds.has(b.id) || (b.kind !== "roster" && b.kind !== "measurements") || !str(b.fileName) || !str(b.source) || !str(b.importedAt) || !Number.isFinite(Date.parse(b.importedAt)) || !["created", "updated", "unchanged"].every(k => Number.isSafeInteger(b[k]) && (b[k] as number) >= 0)) return fail();
    if (b.fileHash !== undefined && (!str(b.fileHash, 64) || !FILE_HASH.test(b.fileHash))) return fail();
    if (b.sheetName !== undefined && (!str(b.sheetName, 255) || CONTROL.test(b.sheetName))) return fail();
    if (b.season !== undefined && (!str(b.season, 7) || !SEASON.test(b.season))) return fail();
    batchIds.add(b.id);
    if (b.kind === "measurements") measurementBatchIds.add(b.id);
  }
  const ids = new Set<string>();
  for (const m of value.measurements) {
    if (!record(m) || !str(m.id, 2000) || !m.id || ids.has(m.id) || !str(m.athlete_code, 40) || !codes.has(m.athlete_code) || !str(m.measured_at, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(m.measured_at) || !Number.isFinite(Date.parse(m.measured_at)) || new Date(m.measured_at).toISOString().slice(0, 10) !== m.measured_at || !str(m.metric) || !m.metric.trim() || !str(m.unit, 80) || !m.unit.trim() || typeof m.value !== "number" || !Number.isFinite(m.value) || !str(m.source) || !m.source.trim() || !str(m.source_file) || !str(m.source_sheet) || !str(m.file_hash, 128) || !Number.isSafeInteger(m.source_row) || (m.source_row as number) < 1 || !str(m.batch_id, 100) || !measurementBatchIds.has(m.batch_id)) return fail();
    ids.add(m.id);
  }
  if (value.mode === "sample" && (value.roster.length || value.measurements.length || value.batches.length)) return fail();
  return value as LocalWorkspace;
}

/** One deterministic identity change, including every local foreign key. */
export function migrateWorkspaceAthleteCodes(workspace: LocalWorkspace): LocalWorkspace {
  validateWorkspace(workspace);
  const index = athleteCodeIndex(workspace.roster);
  const mapping = new Map<string, string>();
  for (const athlete of workspace.roster) {
    const next = pacCodeForLegacy(athlete.athlete_code);
    if (!next) continue;
    if (index.has(next)) throw new Error("A PAC athlete ID conflicts with an existing identity. Your saved data was not changed.");
    mapping.set(athlete.athlete_code, next);
  }
  if (!mapping.size) return workspace;
  return validateWorkspace({
    ...workspace,
    roster: workspace.roster.map(athlete => {
      const next = mapping.get(athlete.athlete_code);
      return next ? { ...athlete, id: next, athlete_code: next,
        athlete_code_aliases: [...(athlete.athlete_code_aliases ?? []), athlete.athlete_code],
        athlete_seasons: athlete.athlete_seasons.map(season => ({ ...season, athlete_id: next })),
      } : athlete;
    }),
    measurements: workspace.measurements.map(reading => {
      const next = mapping.get(reading.athlete_code);
      return next ? { ...reading, athlete_code: next } : reading;
    }),
  });
}

/** Local CSV adds only the canonical ID; confirmed aliases remain in the JSON backup. */
export function exportLocalRosterCsv(roster: RosterAthlete[], season: string): string {
  if (!SEASON.test(season)) throw new Error("Select a valid roster season before exporting.");
  const rows = roster.filter(athlete => athlete.athlete_seasons.some(item => item.season === season)).map(athlete => {
    const seasonal = athlete.athlete_seasons.find(item => item.season === season)!;
    const combined = { ...athlete, ...seasonal };
    return ROSTER_FIELDS.map(field => combined[field] ?? "");
  });
  return Papa.unparse({ fields: [...ROSTER_FIELDS], data: rows }, { escapeFormulae: true });
}

/** Build one validated save: confirmed identity, measurements, and batch succeed together. */
export function prepareRenphoReport(workspace: LocalWorkspace, visibleRoster: RosterAthlete[], measurements: Measurement[], batch: ImportBatch, identity: RenphoReportIdentity): LocalWorkspace {
  const athlete = visibleRoster.filter(item => item.athlete_code === identity.athleteCode);
  if (athlete.length !== 1) throw new Error("Select an existing roster athlete for this report.");
  if (batch.kind !== "measurements" || measurements.some(item => item.athlete_code !== identity.athleteCode)) throw new Error("All report measurements must belong to the selected athlete.");
  const id = normalizeRenphoId(identity.renphoId ?? "");
  if (identity.remember && !id) throw new Error("A report ID is required before it can be remembered.");
  if (id) {
    const owner = findRenphoAthlete(visibleRoster, id);
    if (owner && owner !== identity.athleteCode) throw new Error("This RENPHO ID is already assigned to another athlete.");
  }
  const roster = visibleRoster.map(item => {
    if (!identity.remember || !id || item.athlete_code !== identity.athleteCode || item.renpho_id === id || item.renpho_ids?.includes(id)) return item;
    if ((item.renpho_ids?.length ?? 0) >= MAX_RENPHO_ALIASES) throw new Error("This athlete has reached the saved RENPHO ID limit.");
    return { ...item, renpho_ids: [...(item.renpho_ids ?? []), id] };
  });
  return validateWorkspace({
    ...workspace, mode: "local", roster,
    measurements: [...workspace.measurements, ...measurements.map(item => ({ ...item, batch_id: batch.id }))],
    batches: [...workspace.batches, batch],
  });
}

const DB_NAME = "pacu-local-workspace-v1";
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("workspace");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Browser storage is unavailable. Enable site storage before importing."));
    request.onblocked = () => reject(new Error("Close other PACU tabs and try again."));
  });
}
export async function readWorkspace(): Promise<LocalWorkspace> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("workspace", "readwrite"), store = tx.objectStore("workspace");
      const request = store.get("current");
      let current: LocalWorkspace = emptyWorkspace();
      let failure: unknown = new Error("Could not read saved data. Reload before importing.");
      request.onsuccess = () => {
        try {
          const previous = request.result ? validateWorkspace(request.result) : emptyWorkspace();
          current = migrateWorkspaceAthleteCodes(previous);
          if (current !== previous) { current = { ...current, revision: previous.revision + 1 }; store.put(current, "current"); }
        } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(current);
      tx.onabort = tx.onerror = () => reject(failure);
    });
  } finally { db.close(); }
}
/** Compare and save in one IndexedDB transaction, including across browser tabs. */
export async function writeWorkspace(next: LocalWorkspace, expectedRevision: number): Promise<LocalWorkspace> {
  const normalized = migrateWorkspaceAthleteCodes(next);
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("workspace", "readwrite");
      const store = tx.objectStore("workspace");
      const read = store.get("current");
      let failure = "Could not save. Your previous data is unchanged. Check available browser storage.";
      const saved = { ...normalized, revision: expectedRevision + 1 };
      read.onsuccess = () => {
        if ((read.result?.revision ?? 0) !== expectedRevision) { failure = "The workspace changed in another tab. Reload and preview this import again."; tx.abort(); return; }
        store.put(saved, "current");
      };
      tx.oncomplete = () => resolve(saved);
      tx.onabort = tx.onerror = () => reject(new Error(failure));
    });
  } finally { db.close(); }
}
