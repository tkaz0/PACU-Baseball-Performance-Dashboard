import { getAccess } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/types";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, reason } = await getAccess();
  if (!access) return Response.json({ error: "Access denied" }, { status: reason === "configuration" ? 503 : reason === "forbidden" ? 403 : 401 });
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await access.supabase.from("athletes").select("*, athlete_seasons(*)").eq("id",id).maybeSingle();
  if (error) return Response.json({ error: "Unable to load athlete" }, { status: 503 });
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
