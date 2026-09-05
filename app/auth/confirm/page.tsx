import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { SubmitButton } from "@/components/submit-button";
import { confirmEmailLink } from "./actions";
export const dynamic = "force-dynamic";
type ConfirmParams = { token_hash?: string | string[]; type?: string | string[]; error?: string | string[] };

export default async function Confirm({ searchParams }: { searchParams: Promise<ConfirmParams> }) {
  const { token_hash, type, error } = await searchParams;
  if (type === "invite" && error === "invalid" && token_hash === undefined) {
    return <AuthFrame><h1 className="mb-3 text-3xl font-bold">Invitation unavailable</h1><p role="alert" className="muted mb-6 text-sm">We could not verify this invitation. The link may have expired or already been used. Ask your administrator for a fresh invitation. If you already created a password, sign in instead.</p><Link href="/login" className="btn btn-primary w-full">Go to sign in</Link><Link href="/forgot-password" className="mt-4 block text-center text-sm font-semibold text-pacu-red">Forgot your password?</Link></AuthFrame>;
  }
  if (type !== "recovery" && type !== "invite") redirect("/login?error=reset");
  if (typeof token_hash !== "string" || token_hash.trim() !== token_hash || !/^[a-f0-9]{40,128}$/i.test(token_hash) || error !== undefined) {
    redirect(type === "invite" ? "/auth/confirm?type=invite&error=invalid" : "/login?error=reset");
  }
  const invite = type === "invite";
  // GET renders a confirmation only. Email link scanners cannot consume the token here.
  return <AuthFrame><h1 className="mb-3 text-3xl font-bold">{invite ? "Accept your invitation" : "Reset your password"}</h1><p className="muted mb-6 text-sm">{invite ? "You have been invited to PACU Baseball Performance. Continue to verify this one-time invitation and choose your own password." : "Continue to verify this one-time link and choose a new password."}</p><form action={confirmEmailLink}><input type="hidden" name="token_hash" value={token_hash} /><input type="hidden" name="type" value={type} /><SubmitButton pendingText="Verifying link…">{invite ? "Continue account setup" : "Continue password reset"}</SubmitButton></form>{invite && <p className="muted mb-0 mt-5 text-xs">Your administrator manages your roles and athlete profile link. Accepting an invitation does not change those permissions.</p>}</AuthFrame>;
}
