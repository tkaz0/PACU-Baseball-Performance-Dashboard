import "server-only";
import { requireAdminMutation } from "@/lib/auth";
import { normalizeRenphoId, RENPHO_ID_PATTERN } from "@/lib/imports/engine";
import { UUID_PATTERN } from "@/lib/types";

export type RenphoReportReassignmentItem = { fileHash: string; fromAthleteCode: string; toAthleteCode: string; renphoIds: string[] };
export type RenphoReportReassignmentInput = { requestId: string; report: RenphoReportReassignmentItem };
export type RenphoReportReassignmentPreview = { fingerprint: string; report: RenphoReportReassignmentItem & { measurementCount: number; measuredAt: string; sourceFile: string } };
export type RenphoReportReassignmentReceipt = { requestId: string; measurementsMoved: number; aliasesMoved: number };
const hashPattern = /^[a-f0-9]{64}$/, codePattern = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function fields(value: Record<string, unknown>, names: string[]) { return Object.keys(value).sort().join(",") === [...names].sort().join(","); }
function request(value: unknown): RenphoReportReassignmentInput {
  if (!object(value) || !fields(value, ["requestId", "report"]) || typeof value.requestId !== "string" || !UUID_PATTERN.test(value.requestId)) throw new Error("Select a report and review its player assignment.");
  const row = value.report;
  if (!object(row) || !fields(row, ["fileHash", "fromAthleteCode", "toAthleteCode", "renphoIds"]) || typeof row.fileHash !== "string" || !hashPattern.test(row.fileHash) || typeof row.fromAthleteCode !== "string" || !codePattern.test(row.fromAthleteCode) || typeof row.toAthleteCode !== "string" || !codePattern.test(row.toAthleteCode) || row.fromAthleteCode === row.toAthleteCode || !Array.isArray(row.renphoIds) || row.renphoIds.length > 2) throw new Error("Review the exact report file and two different player codes.");
  const renphoIds = row.renphoIds.map(value => {
    if (typeof value !== "string" || new TextEncoder().encode(value).byteLength > 512) throw new Error("Review up to two exact report IDs.");
    const id = normalizeRenphoId(value);
    if (!RENPHO_ID_PATTERN.test(id)) throw new Error("Review up to two exact report IDs.");
    return id;
  });
  if (new Set(renphoIds).size !== renphoIds.length) throw new Error("Select each report ID only once.");
  return { requestId: value.requestId.toLowerCase(), report: { fileHash: row.fileHash, fromAthleteCode: row.fromAthleteCode, toAthleteCode: row.toAthleteCode, renphoIds } };
}
export async function previewRenphoReportReassignment(value: unknown): Promise<RenphoReportReassignmentPreview> {
  const { supabase } = await requireAdminMutation(); const input = request(value);
  const { data, error } = await supabase.rpc("admin_preview_renpho_report_reassignment", { p_request: input });
  if (error) throw new Error("The report could not be reviewed. Check its current player and any selected report IDs.");
  const row = object(data) ? data.report : null;
  if (!object(data) || !fields(data, ["fingerprint", "report"]) || typeof data.fingerprint !== "string" || !hashPattern.test(data.fingerprint) || !object(row) || !fields(row, ["fileHash", "fromAthleteCode", "toAthleteCode", "renphoIds", "measurementCount", "measuredAt", "sourceFile"]) || row.fileHash !== input.report.fileHash || row.fromAthleteCode !== input.report.fromAthleteCode || row.toAthleteCode !== input.report.toAthleteCode || JSON.stringify(row.renphoIds) !== JSON.stringify(input.report.renphoIds) || !Number.isSafeInteger(row.measurementCount) || (row.measurementCount as number) < 1 || (row.measurementCount as number) > 500 || typeof row.measuredAt !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(row.measuredAt) || !Number.isFinite(Date.parse(row.measuredAt)) || typeof row.sourceFile !== "string" || row.sourceFile.length < 1 || row.sourceFile.length > 300 || /[\x00-\x1f\x7f]/.test(row.sourceFile)) throw new Error("The report correction preview could not be verified.");
  return { fingerprint: data.fingerprint, report: { ...input.report, measurementCount: row.measurementCount as number, measuredAt: row.measuredAt, sourceFile: row.sourceFile } };
}
export async function applyRenphoReportReassignment(value: unknown, fingerprint: string): Promise<RenphoReportReassignmentReceipt> {
  const { supabase } = await requireAdminMutation(); const input = request(value);
  if (typeof fingerprint !== "string" || !hashPattern.test(fingerprint)) throw new Error("Review the report before saving its correction.");
  const { data, error } = await supabase.rpc("admin_apply_renpho_report_reassignment", { p_request: input, p_fingerprint: fingerprint, p_reviewed: true });
  if (error) throw new Error("The correction could not be confirmed. Retry this same reviewed correction, or review again if the report changed.");
  if (!object(data) || !fields(data, ["requestId", "measurementsMoved", "aliasesMoved"]) || data.requestId !== input.requestId || !Number.isSafeInteger(data.measurementsMoved) || (data.measurementsMoved as number) < 1 || (data.measurementsMoved as number) > 500 || data.aliasesMoved !== input.report.renphoIds.length) throw new Error("The correction receipt could not be verified. Retry this same reviewed correction.");
  return { requestId: data.requestId as string, measurementsMoved: data.measurementsMoved as number, aliasesMoved: data.aliasesMoved as number };
}
