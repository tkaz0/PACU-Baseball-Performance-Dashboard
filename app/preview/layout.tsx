import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { PreviewSidebar } from "@/components/preview-sidebar";
import { LocalWorkspaceProvider, WorkspaceBanner } from "@/components/local-workspace";

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocalWorkspaceProvider>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-4">Skip to content</a>
      <PreviewSidebar />
      <div className="app-body">
        <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-4 lg:px-10">
          <p className="mb-0 text-sm font-semibold">Baseball workspace</p>
          <Link className="btn btn-secondary" href="/login"><LockKeyhole size={16} />Sign in to private workspace</Link>
        </header>
        <WorkspaceBanner />
        <main id="main-content" className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10">{children}</main>
        <footer className="px-6 pb-6 text-xs text-gray-500 lg:px-10">PACU Baseball Performance · An independent project, not an official university application.</footer>
      </div>
    </LocalWorkspaceProvider>
  );
}
