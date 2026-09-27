import { getAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { ExitMeetingError, loadExitMeetingReport } from "@/lib/exit-meeting-server";
import { parseExitMeetingOptions } from "@/lib/exit-meeting";
import { createExitMeetingPdf } from "@/lib/exit-meeting-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" };
const errorResponse = (error: string, status: number) => Response.json({ error }, { status, headers: privateHeaders });
export async function POST(request: Request) {
  try {
    const { access } = await getAccess();
    if (!access) return errorResponse("Sign in again to generate this report.", 401);
    if (!canImportPresentedAccess(access)) return errorResponse("Exit meetings are available to coaches and admins.", 403);
    if (request.headers.get("origin") !== new URL(request.url).origin) return errorResponse("Open Exit Meetings on the dashboard to generate a report.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return errorResponse("Review your report options and try again.", 400);
    // Bound body before JSON parsing; report content always comes from current authorized readers.
    const reader = request.body?.getReader(); let size = 0; const chunks: Uint8Array[] = [];
    if (!reader) return errorResponse("Choose a player first.", 400);
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 12000) { await reader.cancel(); return errorResponse("Meeting notes are too long.", 413); } chunks.push(chunk.value); }
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return errorResponse("Review your report options and try again.", 400); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).some(k => !["athleteId", "meetingDate", "talkingPoints"].includes(k)) || typeof payload.athleteId !== "string") return errorResponse("Choose a player and review your report options.", 400);
    let options; try { options = parseExitMeetingOptions(payload); } catch { return errorResponse("Choose a valid date and keep notes under 1,600 characters.", 400); }
    const report = await loadExitMeetingReport(access, payload.athleteId);
    const bytes = await createExitMeetingPdf(report, options);
    const filename = `PACU-Exit-Meeting-${report.code.replace(/[^A-Z0-9-]/g, "")}-${options.meetingDate}.pdf`;
    return new Response(new Uint8Array(bytes).buffer, { headers: { ...privateHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch (error) {
    if (error instanceof ExitMeetingError) return errorResponse(error.message, error.status);
    return errorResponse("The full report could not be verified. Please try again; no incomplete PDF was generated.", 503);
  }
}
