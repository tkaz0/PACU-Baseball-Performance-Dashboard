import { requireAccess } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { AccessPreviewControl } from "@/components/access-preview-control";
import { logout } from "@/app/auth/actions";
import { LogOut, Eye } from "lucide-react";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, roles, athleteId, actualRoles, preview, previewAthleteName } = await requireAccess();
  let athletes: { id: string; label: string }[] = [];
  if (actualRoles.includes("admin") && !preview) {
    const { data, error } = await supabase.from("athletes").select("id,athlete_code,first_name,preferred_name,last_name").order("last_name").limit(1000);
    if (error) throw new Error("Unable to load player preview choices.");
    athletes = (data ?? []).map(a => ({ id: a.id, label: `${a.athlete_code} · ${a.preferred_name || a.first_name} ${a.last_name}` }));
  }
  return <div className="workspace-shell">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-4">Skip to content</a>
    <Sidebar roles={roles} athleteId={athleteId} />
    <div className="app-body workspace-body">
      <header className="workspace-topbar">
        <p><span className="topbar-diamond" aria-hidden="true" />Pacific Baseball<span className="topbar-divider" aria-hidden="true">/</span><span className="text-gray-500">Private workspace</span></p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right"><p className="mb-0 max-w-[220px] truncate text-sm">{user.email}</p><p className="mb-0 text-xs capitalize text-gray-500">{preview ? `As: ${preview.role}` : roles.join(" · ")}</p></div>
          {actualRoles.includes("admin") && <AccessPreviewControl preview={preview} athletes={athletes} />}
          <form action={logout}><button className="btn btn-secondary" aria-label="Sign out"><LogOut size={16} /><span className="hidden sm:inline">Sign out</span></button></form>
        </div>
      </header>
      {preview && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-6 py-4 lg:px-10" role="status"><div><p className="mb-1 flex items-center gap-2 font-bold text-pacu-red"><Eye size={17} aria-hidden="true" />Viewing as: <span className="capitalize">{preview.role}</span>{previewAthleteName && <span>· {previewAthleteName}</span>}</p><p className="mb-0 text-xs text-gray-600">Read-only preview · Your administrator account remains signed in. This view applies to private workspace tabs in this browser.</p></div></div>}
      {process.env.NEXT_PUBLIC_SYNTHETIC_DATA === "true" && <div className="border-b border-red-100 bg-red-50 px-6 py-2 text-xs font-semibold text-pacu-red lg:px-10">Development environment · All roster data is synthetic</div>}
      <main id="main-content" className="workspace-main">{children}</main>
      <footer className="workspace-footer"><span>Pacific Baseball Performance</span><span>An independent project · Not an official university application</span></footer>
    </div>
  </div>;
}
