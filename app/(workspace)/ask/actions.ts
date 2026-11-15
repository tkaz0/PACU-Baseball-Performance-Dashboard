"use server";
import { getAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { AiError, restoreNames, writeWithClaude } from "@/lib/ai-server";
import { ASK_SYSTEM } from "@/lib/ask-data";
import { loadAskContext } from "@/lib/ask-data-server";

const ASK_QUESTION_LIMIT = 500;

/** Staff-only question about the team's saved Fall data. Read-only; nothing is stored; names are restored on the server. */
export async function askTeamData(question: string): Promise<{ ok: true; answer: string } | { ok: false; error: string }> {
  const { access } = await getAccess();
  if (!access || !canImportPresentedAccess(access)) return { ok: false, error: "Ask the Data is available to coaches and admins." };
  const trimmed = typeof question === "string" ? question.trim() : "";
  if (!trimmed) return { ok: false, error: "Type a question first." };
  if (trimmed.length > ASK_QUESTION_LIMIT || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(trimmed)) return { ok: false, error: `Keep questions under ${ASK_QUESTION_LIMIT} characters.` };
  try {
    const context = await loadAskContext(access);
    const answer = await writeWithClaude({ system: ASK_SYSTEM, data: context.data, request: trimmed, maxTokens: 2000 });
    return { ok: true, answer: restoreNames(answer, context.names) };
  } catch (error) {
    return { ok: false, error: error instanceof AiError ? error.message : "That question couldn't be answered. Try again." };
  }
}
