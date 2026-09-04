import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { SubmitButton } from "@/components/submit-button";
import { requestReset } from "@/app/auth/actions";
import { hasSupabaseConfig } from "@/lib/env";
export const dynamic = "force-dynamic";
export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{sent?:string;error?:string}> }) {
  const params = await searchParams;
  const configured = hasSupabaseConfig();
  return <AuthFrame><h1 className="mb-3 text-3xl font-bold tracking-tight">Reset your password</h1><p className="muted mb-7 text-sm">Enter the email associated with your account.</p>{params.sent && <p role="status" className="notice notice-success mb-5">If an eligible account exists and email delivery is available, a reset link will be sent. Check your inbox and spam folder.</p>}{params.error && <p role="alert" className="notice notice-error mb-5">Check your email address and the connection setup, then try again.</p>}{!configured && <p className="notice mb-5">Connect Supabase using docs/SETUP.md before requesting a reset.</p>}<form action={requestReset} className="space-y-5"><label>Email address<input type="email" name="email" required maxLength={254} autoComplete="email" disabled={!configured} /></label><SubmitButton disabled={!configured} pendingText="Requesting link…" className="btn btn-primary w-full">Send reset link</SubmitButton></form><Link href="/login" className="mt-6 inline-block text-sm font-semibold text-pacu-red">Back to sign in</Link></AuthFrame>;
}
