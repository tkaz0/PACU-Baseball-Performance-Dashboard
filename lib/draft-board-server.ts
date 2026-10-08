import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canMutatePresentedAccess } from "@/lib/access-preview";
import { validateDraftSnapshot } from "@/lib/draft-board";

export async function loadDraftBoard(access: Awaited<ReturnType<typeof requireAccess>>) {
  if (!canMutatePresentedAccess(access)) throw new Error("Your private administrator workspace is required.");
  const { data, error } = await access.supabase.rpc("my_boxer_draft");
  if (error) throw new Error("The draft board could not be loaded. Refresh to try again.");
  return data === null ? null : validateDraftSnapshot(data);
}
