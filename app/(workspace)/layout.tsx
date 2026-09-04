import { requireAccess } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { logout } from "@/app/auth/actions";
import { LogOut } from "lucide-react";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user, roles, athleteId } = await requireAccess();
  return <><a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-4">Skip to content</a><Sidebar roles={roles} athleteId={athleteId} /><div className="app-body"><header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-4 lg:px-10"><p className="mb-0 text-sm font-semibold">Team workspace</p><div className="flex flex-wrap items-center gap-4"><div className="text-right"><p className="mb-0 max-w-[240px] truncate text-sm">{user.email}</p><p className="mb-0 text-xs capitalize text-gray-500">{roles.join(" · ")}</p></div><form action={logout}><button className="btn btn-secondary" aria-label="Sign out"><LogOut size={16} /><span className="hidden sm:inline">Sign out</span></button></form></div></header>{process.env.NEXT_PUBLIC_SYNTHETIC_DATA === "true" && <div className="border-b border-red-100 bg-red-50 px-6 py-2 text-xs font-semibold text-pacu-red lg:px-10">Development environment · All roster data is synthetic</div>}<main id="main-content" className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10">{children}</main><footer className="px-6 pb-6 text-xs text-gray-500 lg:px-10">PACU Baseball Performance · An independent project, not an official university application.</footer></div></>;
}
