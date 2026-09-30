import { getAccess } from "@/lib/auth";
import { GraphicsError, loadGraphicsLeaderboards, loadGraphicsPlayer } from "@/lib/graphics-server";
import type { GraphicsDataResponse } from "@/lib/graphics-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" };
const errorResponse = (error: string, status: number) => Response.json({ error }, { status, headers: privateHeaders });

/** Read-only POST: no statistics, roles, raw reports or publish destinations are accepted. */
export async function POST(request: Request) {
  try {
    const { access } = await getAccess();
    if (!access) return errorResponse("Sign in again to open Graphics.", 401);
    if (request.headers.get("origin") !== new URL(request.url).origin) return errorResponse("Open Graphics on the dashboard to load results.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return errorResponse("Choose a graphic and try again.", 400);
    const reader = request.body?.getReader();
    if (!reader) return errorResponse("Choose a graphic first.", 400);
    let size = 0; const chunks: Uint8Array[] = [];
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 2048) { await reader.cancel(); return errorResponse("The graphics request is too large.", 413); }
      chunks.push(chunk.value);
    }
    let payload: unknown;
    try { payload = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return errorResponse("Choose a graphic and try again.", 400); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return errorResponse("Choose a graphic first.", 400);
    const input = payload as Record<string, unknown>;
    let result: GraphicsDataResponse;
    if (input.kind === "player" && Object.keys(input).length === 2 && typeof input.athleteId === "string") {
      result = { kind: "player", data: await loadGraphicsPlayer(access, input.athleteId) };
    } else if (input.kind === "leaderboards" && Object.keys(input).length === 1) {
      result = { kind: "leaderboards", boards: await loadGraphicsLeaderboards(access) };
    } else return errorResponse("Choose a player or team leaderboard.", 400);
    return Response.json(result, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof GraphicsError) return errorResponse(error.message, error.status);
    return errorResponse("These results could not be verified. Please try again.", 503);
  }
}
