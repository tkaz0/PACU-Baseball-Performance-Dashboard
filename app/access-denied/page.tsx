import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { logout } from "@/app/auth/actions";
import { hasSupabaseConfig } from "@/lib/env";
export default function AccessDenied() {
  return <AuthFrame><h1 className="mb-3 text-3xl font-bold">Access unavailable</h1><p className="muted mb-7 text-sm">Your account is disabled, has not been configured, or does not have permission for this page. Contact your administrator.</p><div className="flex flex-wrap gap-3"><Link className="btn btn-secondary" href="/overview">Back to overview</Link>{hasSupabaseConfig() && <form action={logout}><button className="btn btn-primary">Sign out</button></form>}</div></AuthFrame>;
}
