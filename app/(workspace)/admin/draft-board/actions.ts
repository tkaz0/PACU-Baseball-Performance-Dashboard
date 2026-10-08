"use server";
import { requireAdminMutation } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/types";
import { validateDraftDocument, validateDraftSnapshot, type DraftSaveRequest, type DraftSnapshot } from "@/lib/draft-board";

export async function saveBoxerDraft(input: DraftSaveRequest): Promise<{ ok: true; board: DraftSnapshot } | { ok: false; message: string }> {
  const access = await requireAdminMutation();
  let document;
  try {
    if (!input || typeof input.requestId !== "string" || !UUID_PATTERN.test(input.requestId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) throw new Error();
    document = validateDraftDocument(input.document);
  } catch { return { ok: false, message: "Check the draft details before saving." }; }
  const { data, error } = await access.supabase.rpc("save_my_boxer_draft", { p_request_id: input.requestId, p_expected_revision: input.expectedRevision, p_document: document });
  if (error) return { ok: false, message: error.code === "40001" ? "The saved board changed in another tab. Reload the saved board before making another pick." : "The save was not confirmed. Retry this same change or reload the saved board to check it." };
  try {
    if (data?.requestId !== input.requestId || data?.savedRevision !== input.expectedRevision + 1) throw new Error();
    const board = validateDraftSnapshot(data.board);
    if (board.revision < data.savedRevision || (board.revision === data.savedRevision && (board.lastRequestId !== input.requestId || !sameDocument(board.document, document)))) throw new Error();
    return { ok: true, board };
  } catch { return { ok: false, message: "The saved result could not be verified. Reload the saved board before continuing." }; }
}
function sameDocument(a: unknown, b: unknown): boolean {
  const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, canonical(value)])) : v;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
