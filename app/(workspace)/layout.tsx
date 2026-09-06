import { requireAccess } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { AccessPreviewControl } from "@/components/access-preview-control";
import { AppearanceControl } from "@/components/appearance-control";
import { StaffAthleteSearch } from "@/components/staff-athlete-search";
import { loadStaffAthleteChoices } from "@/lib/staff-athlete-search-server";
import { logout } from "@/app/auth/actions";
import { LogOut, Eye } from "lucide-react";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const access = await requireAccess();
  const { user, roles, athleteId, actualRoles, preview, previewAthleteName } = access;
  const searchAthletes = await loadStaffAthleteChoices(access);
  const athletes = actualRoles.includes("admin") && !preview ? searchAthletes.map(a => ({ id: a.id, label: a.name })) : [];
  return <div className="workspace-shell">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-4">Skip to content</a>
    <Sidebar roles={roles} athleteId={athleteId} isPreview={!!preview} />
    <div className="app-body workspace-body">
      <header className="workspace-topbar">
        <p><span className="topbar-diamond" aria-hidden="true" />Pacific Baseball<span className="topbar-divider" aria-hidden="true">/</span><span className="text-gray-500">Private workspace</span></p>
        <div className="flex flex-wrap items-center gap-3">
          {roles.some(role => role === "admin" || role === "coach") && <StaffAthleteSearch athletes={searchAthletes} compact />}
          <AppearanceControl />
          <div className="text-right"><p className="mb-0 max-w-[220px] truncate text-sm">{user.email}</p><p className="mb-0 text-xs capitalize text-gray-500">{preview ? `As: ${preview.role}` : roles.join(" · ")}</p></div>
          {actualRoles.includes("admin") && <AccessPreviewControl preview={preview} athletes={athletes} />}
          <form action={logout}><button className="btn btn-secondary" aria-label="Sign out"><LogOut size={16} /><span className="hidden sm:inline">Sign out</span></button></form>
        </div>
      </header>
      {preview && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-6 py-4 lg:px-10" role="status"><div><p className="mb-1 flex items-center gap-2 font-bold text-pacu-red"><Eye size={17} aria-hidden="true" />Viewing as: <span className="capitalize">{preview.role}</span>{previewAthleteName && <span>· {previewAthleteName}</span>}</p><p className="mb-0 text-xs text-gray-600">{preview.role === "coach" ? "Coach tools are active. Reviewed imports save to shared player profiles under your account." : "Read-only player preview · Your administrator account remains signed in."} This view applies to private workspace tabs in this browser.</p></div></div>}
      <main id="main-content" className="workspace-main">{children}</main>
      <footer className="workspace-footer"><span>Pacific Baseball Performance</span><span>An independent project · Not an official university application</span></footer>
    </div>
  </div>;
}
