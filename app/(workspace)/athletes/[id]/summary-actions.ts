"use server";
import { getAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { AiError, writeWithClaude } from "@/lib/ai-server";
import { summaryData, SUMMARY_SYSTEM } from "@/lib/ai-summary";
import { loadExitMeetingReport } from "@/lib/exit-meeting-server";
import { UUID_PATTERN } from "@/lib/types";

/** Staff-only AI draft of a player's Fall recap. Nothing is saved; identity never leaves the server. */
export async function writePlayerSummary(athleteId: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const { access } = await getAccess();
  if (!access || !canImportPresentedAccess(access)) return { ok: false, error: "AI summaries are available to coaches and admins." };
  if (typeof athleteId !== "string" || !UUID_PATTERN.test(athleteId)) return { ok: false, error: "Choose a rostered player." };
  try {
    const report = await loadExitMeetingReport(access, athleteId);
    const text = await writeWithClaude({ system: SUMMARY_SYSTEM, data: summaryData(report), request: "Write the recap.", maxTokens: 1500 });
    return { ok: true, text };
  } catch (error) {
    return { ok: false, error: error instanceof AiError ? error.message : "The summary couldn't be written. Try again." };
  }
}
