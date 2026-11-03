import { getAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { headshotSrc } from "@/lib/headshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 2_000_000;
/**
 * Same-origin copy of one public roster photo for the browser-built Print All PDF (staff only). The athletics
 * image service redirects without CORS headers, so the browser cannot embed the photo in a canvas directly.
 * Only reviewed goboxers.com roster image paths are accepted; nothing is stored or forwarded.
 */
export async function GET(request: Request) {
  const { access } = await getAccess();
  if (!access || !canImportPresentedAccess(access)) return new Response(null, { status: 403 });
  let target: URL;
  try { target = new URL(new URL(request.url).searchParams.get("src") ?? ""); } catch { return new Response(null, { status: 400 }); }
  const width = Number(target.searchParams.get("width"));
  const src = target.origin === "https://goboxers.com" && Number.isSafeInteger(width) && width > 0 && width <= 480 ? headshotSrc(target.pathname, width) : null;
  if (!src || src !== target.toString()) return new Response(null, { status: 400 });
  const upstream = await fetch(src, { redirect: "follow", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(10_000) }).catch(() => null);
  const type = upstream?.headers.get("content-type") ?? "";
  if (!upstream?.ok || !/^image\/(?:jpeg|png|webp)$/.test(type)) return new Response(null, { status: 502 });
  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return new Response(null, { status: 502 });
  return new Response(body, { headers: { "content-type": type, "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" } });
}
