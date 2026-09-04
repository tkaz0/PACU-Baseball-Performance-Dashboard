"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/env";
export async function confirmRecovery(form: FormData) {
  if (!hasSupabaseConfig()) redirect("/login");
  const tokenHash = String(form.get("token_hash") ?? "");
  if (!/^[a-f0-9]{40,128}$/i.test(tokenHash)) redirect("/login?error=reset");
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  if (error) redirect("/login?error=reset");
  redirect("/reset-password");
}
