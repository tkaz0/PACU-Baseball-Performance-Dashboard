import "server-only";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/env";
import type { Role } from "@/lib/types";
import { ACCESS_PREVIEW_COOKIE, canImportPresentedAccess, canMutatePresentedAccess, resolveAccessPreview } from "@/lib/access-preview";

export async function getTrustedAccess() {
  if (!hasSupabaseConfig()) return { access: null, reason: "configuration" as const };
  const supabase = await createClient();
  // Fresh Auth validation plus live database authorization; neither cookies nor metadata confer roles.
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { access: null, reason: "unauthenticated" as const };
  const [account, roleResult, link] = await Promise.all([
    supabase.from("app_accounts").select("is_active").eq("user_id", user.id).maybeSingle(),
    supabase.from("account_roles").select("role").eq("user_id", user.id),
    supabase.from("account_athletes").select("athlete_id").eq("user_id", user.id).maybeSingle(),
  ]);
  if (account.error || roleResult.error || link.error) throw new Error("Unable to verify access. Check database setup and availability.");
  const roles = (roleResult.data ?? []).map((r: { role: Role }) => r.role);
  if (!account.data?.is_active || !roles.length) return { access: null, reason: "forbidden" as const };
  return { access: { supabase, user, roles, athleteId: (link.data?.athlete_id as string | undefined) ?? null }, reason: null };
}

export async function getAccess() {
  const trusted = await getTrustedAccess();
  if (!trusted.access) return { access: null, reason: trusted.reason };
  const actor = trusted.access;
  const presentation = resolveAccessPreview({ userId: actor.user.id, roles: actor.roles, athleteId: actor.athleteId }, (await cookies()).get(ACCESS_PREVIEW_COOKIE)?.value);
  if (!presentation) return { access: null, reason: "preview" as const };
  let previewAthleteName: string | null = null;
  if (presentation.preview?.role === "player") {
    // Admin RLS still authorizes the actor. Verify and scope the display on every request.
    const { data, error } = await actor.supabase.from("athletes").select("id,first_name,preferred_name,last_name").eq("id", presentation.athleteId!).maybeSingle();
    if (error) throw new Error("Unable to verify the player preview.");
    if (!data) return { access: null, reason: "preview" as const };
    previewAthleteName = `${data.preferred_name || data.first_name} ${data.last_name}`;
  }
  return { access: { ...actor, ...presentation, actualRoles: actor.roles, previewAthleteName }, reason: null };
}

export async function requireTrustedAccess(allowed?: Role[]) {
  const { access, reason } = await getTrustedAccess();
  if (!access) redirect(reason === "forbidden" ? "/access-denied" : "/login");
  if (allowed && !allowed.some(role => access.roles.includes(role))) redirect("/access-denied");
  return access;
}

export async function requireAccess(allowed?: Role[]) {
  const { access, reason } = await getAccess();
  if (!access) redirect(reason === "preview" ? "/access-preview-unavailable" : reason === "forbidden" ? "/access-denied" : "/login");
  if (allowed && !allowed.some(role => access.roles.includes(role))) redirect(access.preview ? "/overview?preview=read-only" : "/access-denied");
  return access;
}

/** Roster, identity and account management remain administrator-only. */
export async function requireAdminWorkspaceAccess() {
  const access = await requireAccess();
  if (!canMutatePresentedAccess(access)) redirect(access.preview ? "/overview?preview=read-only" : "/access-denied");
  return access;
}

export async function requireAdminMutation() {
  return requireAdminWorkspaceAccess();
}

export async function requireImportAccess() {
  const access = await requireAccess();
  if (!canImportPresentedAccess(access)) redirect(access.preview ? "/overview?preview=read-only" : "/access-denied");
  return access;
}
