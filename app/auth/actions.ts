"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requestPasswordRecovery } from "@/lib/supabase/recovery";
import { createClient } from "@/lib/supabase/server";
import { appUrl, hasSupabaseConfig, supabaseConfig } from "@/lib/env";

function field(form: FormData, key: string) { return String(form.get(key) ?? ""); }
export async function login(form: FormData) {
  if (!hasSupabaseConfig()) redirect("/login?error=configuration");
  const email = field(form, "email").trim();
  const password = field(form, "password");
  if (!email || !password || email.length > 254 || password.length > 1024) redirect("/login?error=credentials");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=credentials");
  redirect("/overview");
}
export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) redirect("/access-denied?error=logout");
  redirect("/login");
}
export async function requestReset(form: FormData) {
  if (!hasSupabaseConfig()) redirect("/forgot-password?error=configuration");
  const email = field(form, "email").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) redirect("/forgot-password?error=email");
  const cookieStore = await cookies();
  // Generic outcome avoids disclosing account existence. Failed sends preserve
  // the verifier for the last successful request instead of replacing it.
  await requestPasswordRecovery({
    ...supabaseConfig(), email, redirectTo: `${appUrl()}/auth/callback`,
    cookies: {
      getAll: () => cookieStore.getAll(),
      // Proxy supplies the no-cache response headers for this Server Action.
      setAll(values) {
        values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
  redirect("/forgot-password?sent=1");
}
export async function updatePassword(form: FormData) {
  const password = field(form, "password");
  if (password.length < 12 || password.length > 128 || password !== field(form, "confirm")) redirect("/reset-password?error=password");
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?error=reset");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/reset-password?error=update");
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?updated=1");
}
