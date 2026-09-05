"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/env";

type LinkType = "recovery" | "invite";
const invalidLink = (type: LinkType) => type === "invite" ? "/auth/confirm?type=invite&error=invalid" : "/login?error=reset";

async function verifyEmailLink(form: FormData, type: LinkType) {
  if (!hasSupabaseConfig()) redirect("/login");
  const tokens = form.getAll("token_hash");
  const tokenHash = tokens[0];
  if (tokens.length !== 1 || typeof tokenHash !== "string" || tokenHash.trim() !== tokenHash || !/^[a-f0-9]{40,128}$/i.test(tokenHash)) redirect(invalidLink(type));
  const supabase = await createClient();
  let verified = false;
  try {
    // Supabase verifies possession of this exact one-time link and establishes
    // its Auth session. No account roles or athlete links are assigned here.
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    verified = !error && !!data.user && !!data.session;
  } catch { /* Never include a private token or provider response in an error URL. */ }
  if (!verified) redirect(invalidLink(type));
  redirect(type === "invite" ? "/reset-password?setup=invite" : "/reset-password");
}

export async function confirmEmailLink(form: FormData) {
  const types = form.getAll("type");
  const type = types[0];
  if (types.length !== 1 || (type !== "recovery" && type !== "invite")) redirect("/login?error=reset");
  await verifyEmailLink(form, type);
}

/** Compatibility for already-rendered recovery forms; never accepts another link type. */
export async function confirmRecovery(form: FormData) {
  const types = form.getAll("type");
  if (types.length > 1 || (types.length === 1 && types[0] !== "recovery")) redirect("/login?error=reset");
  await verifyEmailLink(form, "recovery");
}
