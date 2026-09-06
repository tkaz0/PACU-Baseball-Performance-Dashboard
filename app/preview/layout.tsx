import Link from "next/link";
import { LayoutDashboard, LogOut } from "lucide-react";
import { requireImportAccess } from "@/lib/auth";
import { logout } from "@/app/auth/actions";
import { PreviewSidebar } from "@/components/preview-sidebar";
import { LocalWorkspaceProvider, WorkspaceBanner } from "@/components/local-workspace";
import { LocalViewBanner, LocalViewBoundary, LocalViewControl } from "@/components/local-access";
import { AdminWorkspaceBoundary } from "@/components/admin-workspace-boundary";

export const dynamic = "force-dynamic";
export default async function PreviewLayout({ children }: { children: React.ReactNode }) {
  const access = await requireImportAccess();
  const importRole = access.roles.includes("admin") ? "admin" : "coach";
  return (
    <AdminWorkspaceBoundary userId={access.user.id} importRole={importRole}>
    <LocalWorkspaceProvider importRole={importRole}>
      <div className="workspace-shell">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-4">Skip to content</a>
      <PreviewSidebar />
      <div className="app-body workspace-body">
        <header className="workspace-topbar">
          <p><span className="topbar-diamond" aria-hidden="true" />Pacific Baseball<span className="topbar-divider" aria-hidden="true">/</span><span className="text-gray-500">Performance workspace</span></p>
          <div className="workspace-topbar-actions"><LocalViewControl /><Link className="btn btn-secondary" href="/overview"><LayoutDashboard size={16} />Team dashboard</Link><form action={logout}><button className="btn btn-secondary" aria-label="Sign out"><LogOut size={16} /><span className="hidden sm:inline">Sign out</span></button></form></div>
        </header>
        <WorkspaceBanner />
        <LocalViewBanner />
        <main id="main-content" className="workspace-main"><LocalViewBoundary>{children}</LocalViewBoundary></main>
        <footer className="workspace-footer"><span>Pacific Baseball Performance</span><span>An independent project · Not an official university application</span></footer>
      </div>
      </div>
    </LocalWorkspaceProvider>
    </AdminWorkspaceBoundary>
  );
}
