import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { SubmitButton } from "@/components/submit-button";
import { updatePassword } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/env";
export const dynamic = "force-dynamic";
export default async function ResetPassword({ searchParams }: { searchParams: Promise<{error?:string;setup?:string}> }) {
  if (!hasSupabaseConfig()) redirect("/login");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login?error=reset");
  const params = await searchParams;
  const invite = params.setup === "invite";
  return <AuthFrame><h1 className="mb-3 text-3xl font-bold tracking-tight">{invite ? "Choose your password" : "Choose a new password"}</h1><p className="muted mb-7 text-sm">Choose a password with at least 6 characters. No symbols or capital letters are required.</p>{params.error && <p role="alert" className="notice notice-error mb-5">{params.error === "password" ? "Use 6–128 characters and make sure both passwords match." : "Unable to save your password. Try again, or request a new reset link."}</p>}<form action={updatePassword} className="space-y-5">{invite && <input type="hidden" name="setup" value="invite" />}<label>New password<input name="password" type="password" autoComplete="new-password" minLength={6} maxLength={128} required /></label><label>Confirm new password<input name="confirm" type="password" autoComplete="new-password" minLength={6} maxLength={128} required /></label><SubmitButton pendingText={invite ? "Creating password…" : "Updating password…"} className="btn btn-primary w-full">{invite ? "Create password" : "Update password"}</SubmitButton></form></AuthFrame>;
}
