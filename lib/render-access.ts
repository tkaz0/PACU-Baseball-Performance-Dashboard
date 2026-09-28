import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import type { Role } from "@/lib/types";

// React deduplicates only the current Server Component render. There is no TTL,
// shared user cache, or Next persistent cache. Each new request validates live access.
// Mutations, downloads and API entry points keep the fresh guards in lib/auth.ts.
const getRenderAccess = cache(getAccess);

export async function requireRenderAccess(allowed?: Role[]) {
  const { access, reason } = await getRenderAccess();
  if (!access) redirect(reason === "preview" ? "/access-preview-unavailable" : reason === "forbidden" ? "/access-denied" : "/login");
  if (allowed && !allowed.some(role => access.roles.includes(role))) redirect(access.preview ? "/overview?preview=read-only" : "/access-denied");
  return access;
}

export async function requireRenderImportAccess() {
  const access = await requireRenderAccess();
  if (!canImportPresentedAccess(access)) redirect(access.preview ? "/overview?preview=read-only" : "/access-denied");
  return access;
}
