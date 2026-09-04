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
  return <AuthFrame><p className="eyebrow muted">PACU Baseball Performance</p><h1 className="mb-2 text-3xl font-bold tracking-tight">Welcome back.</h1><p className="muted mb-8 text-sm">Sign in to your team workspace.</p>
    {!configured && <div className="notice mb-6">Setup needed: connect your development Supabase project using <code>.env.local</code>. Follow <code>docs/SETUP.md</code> in the project.</div>}
    {params.error && <p role="alert" className="notice notice-error mb-5">{params.error === "reset" ? "That reset link could not be verified. Request a new link." : "Unable to sign in. Check your credentials and try again."}</p>}
    {params.updated && <p role="status" className="notice notice-success mb-5">Password updated. Sign in with your new password.</p>}
    <form action={login} className="space-y-5"><label>Email address<input name="email" type="email" autoComplete="username" placeholder="you@example.com" required maxLength={254} disabled={!configured} /></label><label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={1024} disabled={!configured} /></label><div className="text-right"><Link href="/forgot-password" className="text-sm font-semibold text-pacu-red">Forgot password?</Link></div><SubmitButton pendingText="Signing in…" disabled={!configured} className="btn btn-primary w-full">Sign in <ArrowRight size={16} /></SubmitButton></form>
    {process.env.NEXT_PUBLIC_SYNTHETIC_DATA === "true" && <p className="mt-5 text-xs font-semibold text-pacu-red">Development environment · Synthetic athletes only</p>}
  </AuthFrame>;
}
