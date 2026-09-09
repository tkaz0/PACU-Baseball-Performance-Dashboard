import { PacificLogo } from "@/components/pacific-brand";
export default function Loading() {
  return <div role="status" aria-live="polite" className="space-y-6"><div className="flex items-center gap-3"><PacificLogo className="w-7" decorative /><p className="m-0 text-sm font-semibold">Loading your workspace…</p></div><div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse"><div className="h-36 rounded-xl bg-[var(--surface-raised)]" /><div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map(key => <div key={key} className="h-44 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)]" />)}</div></div></div>;
}
