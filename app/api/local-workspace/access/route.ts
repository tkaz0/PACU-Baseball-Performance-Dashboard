import { getAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

/** No local data crosses this endpoint; it only verifies current trusted access. */
export async function GET() {
  try {
    const { access, reason } = await getAccess();
    if (!access) return Response.json({ allowed: false }, { status: reason === "unauthenticated" ? 401 : reason === "configuration" ? 503 : 403, headers });
    if (!canImportPresentedAccess(access)) return Response.json({ allowed: false }, { status: 403, headers });
    return Response.json({ allowed: true, userId: access.user.id, importRole: access.roles.includes("admin") ? "admin" : "coach" }, { headers });
  } catch {
    return Response.json({ allowed: false }, { status: 503, headers });
  }
}
