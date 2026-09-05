import "server-only";
import { createClient } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabaseConfig } from "@/lib/env";

export function invitationsEnabled() {
  return hasSupabaseConfig() && process.env.PACU_INVITATIONS_ENABLED === "true" &&
    Boolean(process.env.SUPABASE_AUTH_ADMIN_SECRET);
}

/** Auth provisioning only. Never use this privileged client for application data. */
export function createAuthAdministrator() {
  if (!invitationsEnabled()) throw new Error("Invitation setup is incomplete.");
  const { url } = supabaseConfig();
  return createClient(url, process.env.SUPABASE_AUTH_ADMIN_SECRET!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).auth.admin;
}
