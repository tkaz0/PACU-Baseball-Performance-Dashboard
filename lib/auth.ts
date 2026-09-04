import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/env";
import type { Role } from "@/lib/types";

export async function getAccess() {
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
export async function requireAccess(allowed?: Role[]) {
  const { access, reason } = await getAccess();
  if (!access) redirect(reason === "forbidden" ? "/access-denied" : "/login");
  if (allowed && !allowed.some(role => access.roles.includes(role))) redirect("/access-denied");
  return access;
}
