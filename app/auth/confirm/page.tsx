import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { SubmitButton } from "@/components/submit-button";
import { confirmRecovery } from "./actions";
export const dynamic = "force-dynamic";
export default async function Confirm({ searchParams }: { searchParams: Promise<{token_hash?:string;type?:string}> }) {
  const { token_hash, type } = await searchParams;
  if (type !== "recovery" || !token_hash || !/^[a-f0-9]{40,128}$/i.test(token_hash)) redirect("/login?error=reset");
  // GET renders a confirmation only. Email link scanners cannot consume the token here.
  return <AuthFrame><h1 className="mb-3 text-3xl font-bold">Reset your password</h1><p className="muted mb-6 text-sm">Continue to verify this one-time link and choose a new password.</p><form action={confirmRecovery}><input type="hidden" name="token_hash" value={token_hash} /><SubmitButton pendingText="Verifying link…">Continue password reset</SubmitButton></form></AuthFrame>;
}
