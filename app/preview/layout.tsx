import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { PreviewSidebar } from "@/components/preview-sidebar";
import { LocalWorkspaceProvider, WorkspaceBanner } from "@/components/local-workspace";
import { LocalViewBanner, LocalViewBoundary, LocalViewControl } from "@/components/local-access";

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocalWorkspaceProvider>
      <div className="workspace-shell">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-4">Skip to content</a>
      <PreviewSidebar />
      <div className="app-body workspace-body">
        <header className="workspace-topbar">
          <p><span className="topbar-diamond" aria-hidden="true" />Pacific Baseball<span className="topbar-divider" aria-hidden="true">/</span><span className="text-gray-500">Performance workspace</span></p>
          <div className="workspace-topbar-actions"><LocalViewControl /><Link className="btn btn-secondary" href="/login"><LockKeyhole size={16} />Sign in to private workspace</Link></div>
        </header>
        <WorkspaceBanner />
        <LocalViewBanner />
        <main id="main-content" className="workspace-main"><LocalViewBoundary>{children}</LocalViewBoundary></main>
        <footer className="workspace-footer"><span>Pacific Baseball Performance</span><span>An independent project · Not an official university application</span></footer>
      </div>
      </div>
    </LocalWorkspaceProvider>
  );
}
