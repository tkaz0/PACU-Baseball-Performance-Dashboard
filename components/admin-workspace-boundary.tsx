"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { checkLocalWorkspaceAccess } from "@/lib/local-workspace-access";

/** Local storage is mounted only after a fresh server check, including cached navigation. */
export function AdminWorkspaceBoundary({ userId, children }: { userId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<{ status: "checking" | "allowed" | "unavailable"; userId: string | null; pathname: string | null }>({ status: "checking", userId: null, pathname: null });
  const current = state.userId === userId && state.pathname === pathname;
  useEffect(() => {
    let active = true, checking = false;
    async function verify() {
      if (checking) return;
      checking = true;
      const result = await checkLocalWorkspaceAccess(userId);
      checking = false;
      if (!active) return;
      if (result.allowed) setState({ status: "allowed", userId, pathname });
      else {
        setState({ status: "unavailable", userId, pathname });
        if (result.destination) window.location.replace(result.destination);
      }
    }
    function visible() { if (document.visibilityState === "visible") void verify(); }
    void verify();
    window.addEventListener("focus", visible);
    window.addEventListener("pageshow", visible);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(visible, 30000);
    return () => {
      active = false; window.clearInterval(timer);
      window.removeEventListener("focus", visible); window.removeEventListener("pageshow", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [pathname, userId]);
  const unavailable = current && state.status === "unavailable";
  if (!current || state.status !== "allowed") return <main className="mx-auto max-w-xl px-6 py-16" aria-live="polite">
    <h1 className="page-title">{unavailable ? "Workspace Access Unavailable" : "Checking Workspace Access"}</h1>
    <p className="muted mt-4">{unavailable ? "Your administrator session could not be verified. Reload to try again." : "Verifying your administrator session before opening saved data."}</p>
    {unavailable && <a className="btn btn-secondary mt-6" href="/preview">Reload Workspace</a>}
  </main>;
  return children;
}
