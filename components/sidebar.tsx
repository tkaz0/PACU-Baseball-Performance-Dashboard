"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UsersRound, Upload, ShieldCheck, UserRound, ChevronRight } from "lucide-react";
import type { Role } from "@/lib/types";
export function Sidebar({ roles, athleteId }: { roles: Role[]; athleteId: string | null }) {
  const path = usePathname();
  const staff = roles.some(r => r === "admin" || r === "coach");
  const links = [{ href: "/overview", label: "Overview", icon: LayoutDashboard },
    ...(staff ? [{ href: "/roster", label: "Master roster", icon: UsersRound }] : []),
    ...(athleteId ? [{ href: `/athletes/${athleteId}`, label: "My profile", icon: UserRound }] : []),
    ...(roles.includes("admin") ? [{ href: "/admin/import", label: "Roster import", icon: Upload }, { href: "/admin/access", label: "Account access", icon: ShieldCheck }] : [])];
  return <aside className="sidebar"><Link href="/overview" className="px-4 text-white no-underline"><span className="text-3xl font-black tracking-tight">PACU<span className="text-pacu-red">.</span></span><span className="mt-1 block text-xs font-semibold uppercase tracking-[.16em] text-gray-400">Baseball Performance</span></Link><div className="my-7 hidden border-t border-white/10 min-[901px]:block" /><p className="eyebrow hidden px-4 text-gray-500 min-[901px]:block">Workspace</p><nav aria-label="Main navigation">{links.map(({ href, label, icon: Icon }) => <Link className="nav-link" href={href} key={href} aria-current={path === href || path.startsWith(`${href}/`) ? "page" : undefined}><Icon size={18} /><span>{label}</span></Link>)}</nav><div className="sidebar-bottom mt-auto px-4"><div className="mb-4 flex items-center justify-between border-t border-white/10 pt-6"><span className="text-sm font-semibold text-gray-200">Phase 01</span><ChevronRight size={14} /></div><p className="mb-1 text-xs text-gray-400">Identity, access & roster</p><p className="mt-6 text-xs leading-relaxed text-gray-500">Independently owned by<br />Trevor Kazahaya</p></div></aside>;
}
