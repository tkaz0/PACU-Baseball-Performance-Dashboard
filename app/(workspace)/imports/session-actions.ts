"use server";

import { revalidatePath } from "next/cache";
import { requireAdminMutation, requireImportAccess } from "@/lib/auth";
import { fullSwingSessionDatabasePayload, validateFullSwingSessionBundle, type FullSwingSessionReceipt, type FullSwingSessionState } from "@/lib/imports/full-swing-session-bundle";

const integer = (value: unknown, min=0): value is number => Number.isSafeInteger(value) && Number(value)>=min;
const object = (value: unknown): value is Record<string,unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const timestamp = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function receipt(value: unknown, requestId: string, fileHash: string): FullSwingSessionReceipt {
  if (!object(value) || value.requestId !== requestId || value.fileHash !== fileHash || !integer(value.revision,1) ||
    value.fullyPublished !== true || !timestamp(value.publishedAt) || !integer(value.measurementCount,1) || !integer(value.contactCount) ||
    !integer(value.sampleCount) || !integer(value.unresolvedPitchCount) || !object(value.measurements) ||
    !integer(value.measurements.created) || !integer(value.measurements.unchanged) ||
    value.measurements.created + value.measurements.unchanged !== value.measurementCount) throw new Error("Unverified session receipt");
  return { requestId,fileHash,revision:value.revision,created:value.measurements.created,unchanged:value.measurements.unchanged,
    measurementCount:value.measurementCount,contactCount:value.contactCount,sampleCount:value.sampleCount,publishedAt:value.publishedAt,unresolvedPitchCount:value.unresolvedPitchCount };
}
function refreshSessionViews() {
  for (const path of ["/imports","/imports/sessions","/leaderboards","/analytics","/compare","/overview","/testing/coverage","/admin/performance","/admin/csv-corrections"]) revalidatePath(path);
  revalidatePath("/athletes","layout");
}

export async function publishFullSwingSession(input: unknown): Promise<FullSwingSessionReceipt | {error:string}> {
  const access = await requireImportAccess();
  let bundle;
  try { bundle = validateFullSwingSessionBundle(input); } catch { return {error:"Review the complete original session, player matches, units and pitch labels before publishing."}; }
  if (bundle.replace) await requireAdminMutation();
  const payload = fullSwingSessionDatabasePayload(bundle);
  try {
    const {data,error} = await access.supabase.rpc("staff_publish_full_swing_session", {p_request_id:bundle.requestId,p_expected_revision:bundle.expectedRevision,p_payload:payload,p_replace:bundle.replace});
    if (error?.code === "40001") return {error:"This session or its pitch labels changed since review. Reopen the original CSV to load the saved version."};
    if (error?.code === "23505") return {error:"This file conflicts with saved results or a previous removal. Nothing from this session was published. Review the Session Library before continuing."};
    if (error) return {error:"Session publication was not confirmed. No partial session is saved by this workflow. Check the Session Library before retrying this same review."};
    const saved = receipt(data,bundle.requestId,bundle.fileHash);
    if (saved.measurementCount !== bundle.measurements.length || saved.sampleCount !== bundle.samples.length || saved.contactCount !== bundle.contacts.length || saved.unresolvedPitchCount !== bundle.unresolvedPitchCount) throw new Error("Incomplete receipt");
    refreshSessionViews();
    return saved;
  } catch { return {error:"The session receipt could not be confirmed. Check the Session Library before retrying this same review."}; }
}

export async function loadFullSwingSession(fileHash: string): Promise<FullSwingSessionState | {error:string}> {
  const {supabase} = await requireImportAccess();
  if (!hash(fileHash)) return {error:"Choose the original CSV again."};
  try {
    const {data,error} = await supabase.rpc("staff_full_swing_session_state",{p_file_hash:fileHash});
    if (error || !object(data) || !integer(data.revision)) throw new Error("Unverified state");
    if (data.revision === 0) return {revision:0,publishedAt:null,removedValues:[]};
    if (!timestamp(data.publishedAt) || !Array.isArray(data.removedValues) || data.removedValues.some(item=>typeof item!=="string" || !/^[1-9]\d{0,5}:(RelSpeed|SpinRate|ExitSpeed|Angle|Direction|BatSpeed|Distance)$/.test(item)) ||
      typeof data.fileName!=="string" || !data.fileName || typeof data.date!=="string" || !/^2026-(09|10|11|12)-\d{2}$/.test(data.date) ||
      !["game","intrasquad","practice"].includes(String(data.category)) || !["Live at Bat","Machine BP"].includes(String(data.mode))) throw new Error("Unverified state");
    return {revision:data.revision,publishedAt:data.publishedAt,removedValues:data.removedValues as string[],fileName:data.fileName,date:data.date,
      category:data.category as FullSwingSessionState["category"],mode:data.mode as FullSwingSessionState["mode"]};
  } catch { return {error:"The saved session could not be checked. Reload before publishing; existing results have not changed."}; }
}

export async function restoreFullSwingSession(input: {requestId:string;fileHash:string;expectedRevision:number;targetRevision:number}, reviewed: boolean): Promise<FullSwingSessionReceipt | {error:string}> {
  const {supabase} = await requireAdminMutation();
  if (reviewed !== true || !object(input) || Object.keys(input).sort().join(",")!=="expectedRevision,fileHash,requestId,targetRevision" ||
    !uuid(input.requestId) || !hash(input.fileHash) || !integer(input.expectedRevision,2) || !integer(input.targetRevision,1) || input.targetRevision>=input.expectedRevision)
    return {error:"Review the saved session and prior revision before restoring."};
  try {
    const {data,error} = await supabase.rpc("admin_restore_full_swing_session", {p_request_id:input.requestId,p_file_hash:input.fileHash,p_expected_revision:input.expectedRevision,p_target_revision:input.targetRevision});
    if(error?.code==="40001") return {error:"This session changed after review. Refresh the Session Library before restoring."};
    if(error) return {error:"The restore was not confirmed. Check the current session before retrying; prior individual removals are never silently restored."};
    const saved=receipt(data,input.requestId,input.fileHash);refreshSessionViews();return saved;
  } catch {return {error:"The restore receipt could not be verified. Check the Session Library before retrying this same request."};}
}
