"use client";
import Link from "next/link";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

const RETRY_KEY = "pacu-error-retry";
/**
 * Right after a deploy, a browser can still hold the previous version's files and fail once. Reload
 * automatically one time per page per minute; a second failure shows the normal message.
 */
export default function ErrorPage() {
  useEffect(() => {
    try {
      const page = window.location.pathname + window.location.search, now = Date.now();
      const last = JSON.parse(window.sessionStorage.getItem(RETRY_KEY) ?? "null") as { page: string; at: number } | null;
      if (last && last.page === page && now - last.at < 60_000) return;
      window.sessionStorage.setItem(RETRY_KEY, JSON.stringify({ page, at: now }));
      window.location.reload();
    } catch { /* Storage blocked: keep the manual Try again button. */ }
  }, []);
  return <div className="mx-auto my-16 max-w-lg rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-7"><span className="text-xs font-bold uppercase tracking-widest text-[var(--accent-readable)]">Pacific Baseball</span><h1 className="mt-4 text-2xl font-bold">This page couldn’t load.</h1><p className="text-sm leading-6 text-[var(--text-secondary)]">Try loading it again. If the problem continues, let your dashboard administrator know which page you were opening.</p><div className="mt-6 flex flex-wrap gap-3"><button type="button" className="btn btn-primary" onClick={() => window.location.reload()}><RefreshCw size={16} aria-hidden="true" />Try again</button><Link className="btn btn-secondary" href="/overview">Back to workspace</Link></div></div>;
}
