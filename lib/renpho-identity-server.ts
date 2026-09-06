import "server-only";
import { requireAdminMutation, requireImportAccess } from "@/lib/auth";
import { normalizeRenphoId, RENPHO_ID_PATTERN, type Measurement } from "@/lib/imports/engine";
import { prepareReviewedPerformanceRows } from "@/lib/performance-import";
import type { PerformanceImportReceipt } from "@/lib/performance-server";
import { UUID_PATTERN } from "@/lib/types";

export type RenphoIdentity = { athlete_id: string; athlete_code: string };
export type RenphoMapping = { athlete_code: string; renpho_id: string };
export type RenphoMappingReceipt = { created: number; unchanged: number };
const codePattern = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
const fieldsMatch = (value: Record<string, unknown>, fields: string[]) => Object.keys(value).sort().join(",") === fields.sort().join(",");
function reportId(value: string, allowBlank = false): string {
  if (typeof value !== "string" || new TextEncoder().encode(value).byteLength > 512) throw new Error("Use a valid RENPHO ID.");
  const normalized = normalizeRenphoId(value);
  if (!(allowBlank && normalized === "") && !RENPHO_ID_PATTERN.test(normalized)) throw new Error("Use a valid RENPHO ID.");
  return normalized;
}
function counts(value: unknown, expected: number): value is RenphoMappingReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  return Number.isSafeInteger(r.created) && Number.isSafeInteger(r.unchanged) && (r.created as number) >= 0 &&
    (r.unchanged as number) >= 0 && (r.created as number) + (r.unchanged as number) === expected;
}

/** Returns one exact mapping to active staff; never returns the identifier registry. */
export async function lookupRenphoIdentity(renphoId: string): Promise<RenphoIdentity | null> {
  const { supabase } = await requireImportAccess();
  const normalized = reportId(renphoId);
  const { data, error } = await supabase.rpc("staff_match_renpho_id", { p_report_id: normalized });
  if (error) throw new Error("RENPHO player matching is unavailable. Try again before saving.");
  if (data === null) return null;
  if (!data || typeof data !== "object" || Array.isArray(data) || !fieldsMatch(data, ["athlete_id", "athlete_code"]) ||
    typeof data.athlete_id !== "string" || !UUID_PATTERN.test(data.athlete_id) ||
    typeof data.athlete_code !== "string" || !codePattern.test(data.athlete_code)) throw new Error("The RENPHO player match could not be verified.");
  return { athlete_id: data.athlete_id, athlete_code: data.athlete_code };
}

/** Caller supplies reviewed current permanent codes; no names/emails/Auth links are inferred. */
export async function saveRenphoMappings(mappings: unknown): Promise<RenphoMappingReceipt> {
  const { supabase } = await requireAdminMutation();
  if (!Array.isArray(mappings) || mappings.length < 1 || mappings.length > 200) throw new Error("Review 1–200 RENPHO ID mappings.");
  const seen = new Set<string>();
  const rows = mappings.map(row => {
    if (!row || typeof row !== "object" || Array.isArray(row) || !fieldsMatch(row, ["athlete_code", "renpho_id"]) ||
      typeof row.athlete_code !== "string" || !codePattern.test(row.athlete_code)) throw new Error("Review the permanent player codes and RENPHO IDs.");
    const normalized = reportId(row.renpho_id);
    if (seen.has(normalized)) throw new Error("A RENPHO ID appears more than once. Review the player assignments.");
    seen.add(normalized);
    return { athlete_code: row.athlete_code, renpho_id: normalized };
  });
  const { data, error } = await supabase.rpc("admin_upsert_renpho_ids", { p_mapping: rows, p_reviewed: true });
  if (error) throw new Error("RENPHO IDs were not saved. Check the player codes and any ID already assigned to another player.");
  if (!counts(data, rows.length) || !fieldsMatch(data, ["created", "unchanged"])) throw new Error("The RENPHO mapping result could not be verified. Refresh before retrying.");
  return { created: data.created, unchanged: data.unchanged };
}

/** Fresh SQL matching and numeric import share one transaction and actor lock. */
export async function importReviewedRenpho(measurements: readonly Measurement[], identity: { athleteCode: string; renphoId: string }): Promise<PerformanceImportReceipt> {
  const { supabase } = await requireImportAccess();
  if (!identity || typeof identity.athleteCode !== "string" || !codePattern.test(identity.athleteCode)) throw new Error("Select the reviewed player.");
  const normalized = reportId(identity.renphoId, true);
  const rows = prepareReviewedPerformanceRows(measurements);
  if (rows.some(row => row.athlete_code !== identity.athleteCode || row.source !== "RENPHO")) throw new Error("Review the player and RENPHO source for every reading.");
  const { data, error } = await supabase.rpc("staff_import_renpho", { p_report_id: normalized, p_athlete_code: identity.athleteCode, p_rows: rows });
  if (error) throw new Error("RENPHO readings were not saved. Recheck the report's player match and reviewed measurements.");
  if (!counts(data, rows.length) || !fieldsMatch(data as unknown as Record<string, unknown>, ["import_id", "created", "unchanged"]) ||
    typeof (data as Record<string, unknown>).import_id !== "string" || !UUID_PATTERN.test((data as Record<string, unknown>).import_id as string)) throw new Error("The import result could not be verified. Refresh shared measurements before retrying.");
  return { import_id: (data as Record<string, unknown>).import_id as string, created: data.created, unchanged: data.unchanged };
}
