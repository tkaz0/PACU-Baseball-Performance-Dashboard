"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { checkLocalWorkspaceAccess } from "@/lib/local-workspace-access";
import type { ImportRole } from "@/lib/local-workspace-permissions";

/** Local storage is mounted only after a fresh server check, including cached navigation. */
export function AdminWorkspaceBoundary({ userId, importRole, children }: { userId: string; importRole: ImportRole; children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<{ status: "checking" | "allowed" | "unavailable"; userId: string | null; pathname: string | null; importRole: ImportRole | null }>({ status: "checking", userId: null, pathname: null, importRole: null });
  const current = state.userId === userId && state.pathname === pathname && state.importRole === importRole;
  useEffect(() => {
    let active = true, checking = false;
    async function verify() {
      if (checking) return;
      checking = true;
      const result = await checkLocalWorkspaceAccess(userId, importRole);
      checking = false;
      if (!active) return;
      if (result.allowed) setState({ status: "allowed", userId, pathname, importRole });
      else {
        setState({ status: "unavailable", userId, pathname, importRole });
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
  }, [pathname, userId, importRole]);
  const unavailable = current && state.status === "unavailable";
  if (!current || state.status !== "allowed") return <main className="mx-auto max-w-xl px-6 py-16" aria-live="polite">
    <h1 className="page-title">{unavailable ? "Workspace Access Unavailable" : "Checking Workspace Access"}</h1>
    <p className="muted mt-4">{unavailable ? "Your staff session could not be verified. Reload to try again." : "Verifying your staff session before opening saved data."}</p>
    {unavailable && <a className="btn btn-secondary mt-6" href="/preview">Reload Workspace</a>}
  </main>;
  return children;
}
