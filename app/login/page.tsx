import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthFrame } from "@/components/auth-frame";
import { SubmitButton } from "@/components/submit-button";
import { login } from "@/app/auth/actions";
import { hasSupabaseConfig } from "@/lib/env";
export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string }> }) {
  const params = await searchParams;
  const configured = hasSupabaseConfig();
  return <AuthFrame><h1 className="login-title">Welcome Back</h1><p className="login-intro">Sign in to your Pacific Baseball workspace.</p>
    {!configured && <div className="notice mb-6">Sign-in is being set up. Please check back shortly.</div>}
    {params.error && <p role="alert" className="notice notice-error mb-5">{params.error === "reset" ? "That reset link could not be verified. Request a new link." : "Unable to sign in. Check your credentials and try again."}</p>}
    {params.updated && <p role="status" className="notice notice-success mb-5">Password updated. Sign in with your new password.</p>}
    <form action={login} className="space-y-5"><label>Email Address<input name="email" type="email" autoComplete="username" placeholder="you@example.com" required maxLength={254} disabled={!configured} /></label><label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={1024} disabled={!configured} /></label><div className="text-right"><Link href="/forgot-password" className="text-sm font-semibold text-pacu-red">Forgot Password?</Link></div><SubmitButton pendingText="Signing In…" disabled={!configured} className="btn btn-primary w-full">Sign In <ArrowRight size={16} aria-hidden="true" /></SubmitButton></form>
    <p className="login-invitation-note">Need an account? Ask your team administrator for an invitation.</p>
  </AuthFrame>;
}
