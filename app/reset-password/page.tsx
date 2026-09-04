import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { SubmitButton } from "@/components/submit-button";
import { updatePassword } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/env";
export const dynamic = "force-dynamic";
export default async function ResetPassword({ searchParams }: { searchParams: Promise<{error?:string}> }) {
  if (!hasSupabaseConfig()) redirect("/login");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login?error=reset");
  const params = await searchParams;
  return <AuthFrame><h1 className="mb-3 text-3xl font-bold tracking-tight">Choose a new password</h1><p className="muted mb-7 text-sm">Use a unique password of 12–128 characters. A password manager can generate and remember one for you.</p>{params.error && <p role="alert" className="notice notice-error mb-5">{params.error === "password" ? "Use 12–128 characters and make sure both passwords match." : "Unable to update the password. It may not meet your project’s security requirements. Request a fresh reset link if needed."}</p>}<form action={updatePassword} className="space-y-5"><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label><label>Confirm new password<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label><SubmitButton pendingText="Updating password…" className="btn btn-primary w-full">Update password</SubmitButton></form></AuthFrame>;
}
