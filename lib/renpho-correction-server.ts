import "server-only";
import { requireAdminMutation } from "@/lib/auth";
import { normalizeRenphoId, RENPHO_ID_PATTERN } from "@/lib/imports/engine";
import { UUID_PATTERN } from "@/lib/types";

export type RenphoReportSwapItem = {
  fileHash: string;
  fromAthleteCode: string;
  toAthleteCode: string;
  /** Null explicitly leaves report ID aliases unchanged. */
  renphoId: string | null;
};
export type RenphoReportSwapInput = { requestId: string; reports: [RenphoReportSwapItem, RenphoReportSwapItem] };
export type RenphoReportSwapPreview = {
  fingerprint: string;
  reports: [RenphoReportSwapItem & { measurementCount: number; measuredAt: string; sourceFile: string }, RenphoReportSwapItem & { measurementCount: number; measuredAt: string; sourceFile: string }];
};
export type RenphoReportSwapReceipt = { requestId: string; measurementsMoved: number; aliasesMoved: number };
const hashPattern = /^[a-f0-9]{64}$/;
const codePattern = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function fields(value: Record<string, unknown>, names: string[]) { return Object.keys(value).sort().join(",") === [...names].sort().join(","); }
function request(value: unknown): RenphoReportSwapInput {
  if (!object(value) || !fields(value, ["requestId", "reports"]) || typeof value.requestId !== "string" || !UUID_PATTERN.test(value.requestId) || !Array.isArray(value.reports) || value.reports.length !== 2) throw new Error("Select two reports and review their player assignments.");
  const reports = value.reports.map(row => {
    if (!object(row) || !fields(row, ["fileHash", "fromAthleteCode", "toAthleteCode", "renphoId"]) || typeof row.fileHash !== "string" || !hashPattern.test(row.fileHash) || typeof row.fromAthleteCode !== "string" || !codePattern.test(row.fromAthleteCode) || typeof row.toAthleteCode !== "string" || !codePattern.test(row.toAthleteCode) || !(row.renphoId === null || typeof row.renphoId === "string")) throw new Error("Review the exact report files, player codes and optional report IDs.");
    const renphoId = row.renphoId === null ? null : normalizeRenphoId(row.renphoId);
    if (renphoId !== null && (!RENPHO_ID_PATTERN.test(renphoId) || new TextEncoder().encode(row.renphoId as string).byteLength > 512)) throw new Error("Use an exact RENPHO ID or leave its correction unselected.");
    return { fileHash: row.fileHash, fromAthleteCode: row.fromAthleteCode, toAthleteCode: row.toAthleteCode, renphoId };
  }) as RenphoReportSwapInput["reports"];
  const [a, b] = reports;
  if (a.fileHash === b.fileHash || a.fromAthleteCode === a.toAthleteCode || a.fromAthleteCode !== b.toAthleteCode || a.toAthleteCode !== b.fromAthleteCode || (a.renphoId !== null && a.renphoId === b.renphoId)) throw new Error("Choose two different reports that exchange players.");
  return { requestId: value.requestId.toLowerCase(), reports };
}
function verifiedPreview(data: unknown, input: RenphoReportSwapInput): data is RenphoReportSwapPreview {
  return object(data) && fields(data, ["fingerprint", "reports"]) && typeof data.fingerprint === "string" && hashPattern.test(data.fingerprint) && Array.isArray(data.reports) && data.reports.length === 2 && data.reports.every((row, i) => object(row) && fields(row, ["fileHash", "fromAthleteCode", "toAthleteCode", "renphoId", "measurementCount", "measuredAt", "sourceFile"]) && Object.entries(input.reports[i]).every(([key, value]) => row[key] === value) && Number.isSafeInteger(row.measurementCount) && (row.measurementCount as number) >= 1 && (row.measurementCount as number) <= 500 && typeof row.measuredAt === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(row.measuredAt) && Number.isFinite(Date.parse(row.measuredAt)) && typeof row.sourceFile === "string" && row.sourceFile.length >= 1 && row.sourceFile.length <= 300 && !/[\x00-\x1f\x7f]/.test(row.sourceFile));
}

/** Administrative correction only; source reports and observations remain unchanged. */
export async function previewRenphoReportSwap(value: unknown): Promise<RenphoReportSwapPreview> {
  const { supabase } = await requireAdminMutation();
  const input = request(value);
  const { data, error } = await supabase.rpc("admin_preview_renpho_report_swap", { p_request: input });
  if (error) throw new Error("The reports could not be reviewed. Check their current players and any selected report IDs.");
  if (!verifiedPreview(data, input)) throw new Error("The report correction preview could not be verified.");
  return data;
}

/** The same request and fingerprint may be retried after an uncertain response. */
export async function applyRenphoReportSwap(value: unknown, fingerprint: string): Promise<RenphoReportSwapReceipt> {
  const { supabase } = await requireAdminMutation();
  const input = request(value);
  if (typeof fingerprint !== "string" || !hashPattern.test(fingerprint)) throw new Error("Review the reports before saving the correction.");
  const { data, error } = await supabase.rpc("admin_apply_renpho_report_swap", { p_request: input, p_fingerprint: fingerprint, p_reviewed: true });
  if (error) throw new Error("The correction could not be confirmed. Retry the same reviewed correction, or review again if the reports changed.");
  if (!object(data) || !fields(data, ["requestId", "measurementsMoved", "aliasesMoved"]) || data.requestId !== input.requestId || !Number.isSafeInteger(data.measurementsMoved) || (data.measurementsMoved as number) < 2 || (data.measurementsMoved as number) > 1000 || data.aliasesMoved !== input.reports.filter(row => row.renphoId !== null).length) throw new Error("The correction receipt could not be verified. Retry this same reviewed correction.");
  return { requestId: data.requestId as string, measurementsMoved: data.measurementsMoved as number, aliasesMoved: data.aliasesMoved as number };
}
