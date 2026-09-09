"use client";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto my-16 max-w-lg rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-7"><span className="text-xs font-bold uppercase tracking-widest text-[var(--accent-readable)]">Pacific Baseball</span><h1 className="mt-4 text-2xl font-bold">This page couldn’t load.</h1><p className="text-sm leading-6 text-[var(--text-secondary)]">Try loading it again. If the problem continues, let your dashboard administrator know which page you were opening.</p><div className="mt-6 flex flex-wrap gap-3"><button type="button" className="btn btn-primary" onClick={reset}><RefreshCw size={16} aria-hidden="true" />Try again</button><Link className="btn btn-secondary" href="/overview">Back to workspace</Link></div></div>;
}
