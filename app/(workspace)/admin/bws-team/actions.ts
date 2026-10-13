"use server";
import { requireAdminMutation } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/types";
import { validateBwsPlan, validateBwsSnapshot, type BwsSaveRequest, type BwsSnapshot } from "@/lib/bws-team";

export async function saveBwsTeamPlan(input: BwsSaveRequest): Promise<{ ok: true; plan: BwsSnapshot } | { ok: false; message: string }> {
  const access = await requireAdminMutation();
  let document;
  try {
    if (!input || typeof input.requestId !== "string" || !UUID_PATTERN.test(input.requestId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) throw new Error();
    document = validateBwsPlan(input.document);
  } catch { return { ok: false, message: "Check the team details before saving." }; }
  const { data, error } = await access.supabase.rpc("save_my_bws_team_plan", { p_request_id: input.requestId, p_expected_revision: input.expectedRevision, p_document: document });
  if (error) return { ok: false, message: error.code === "40001" ? "The saved plan changed in another tab. Reload before making more changes." : "The save was not confirmed. Retry this same change or reload to check it." };
  try {
    if (data?.requestId !== input.requestId || data?.savedRevision !== input.expectedRevision + 1) throw new Error();
    const plan = validateBwsSnapshot(data.plan);
    if (plan.revision < data.savedRevision || (plan.revision === data.savedRevision && (plan.lastRequestId !== input.requestId || JSON.stringify(canonical(plan.document)) !== JSON.stringify(canonical(document))))) throw new Error();
    return { ok: true, plan };
  } catch { return { ok: false, message: "The saved result could not be verified. Reload before continuing." }; }
}
const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, canonical(value)])) : v;
