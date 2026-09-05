"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UsersRound, Upload, ShieldCheck, UserRound, ChevronRight } from "lucide-react";
import type { Role } from "@/lib/types";
import { PacificBrand } from "@/components/pacific-brand";
export function Sidebar({ roles, athleteId }: { roles: Role[]; athleteId: string | null }) {
  const path = usePathname();
  const staff = roles.some(r => r === "admin" || r === "coach");
  const links = [{ href: "/overview", label: "Overview", icon: LayoutDashboard },
    ...(staff ? [{ href: "/roster", label: "Team Roster", icon: UsersRound }] : []),
    ...(athleteId ? [{ href: `/athletes/${athleteId}`, label: "My Profile", icon: UserRound }] : []),
    ...(roles.includes("admin") ? [{ href: "/admin/import", label: "Roster Import", icon: Upload }, { href: "/admin/performance", label: "Shared Measurements", icon: Upload }, { href: "/admin/rollout", label: "Team Rollout", icon: UsersRound }, { href: "/admin/access", label: "Account Access", icon: ShieldCheck }] : [])];
  return <aside className="sidebar baseball-sidebar"><Link href="/overview" className="sidebar-brand-link" aria-label="Pacific Baseball Performance home"><PacificBrand compact /></Link><div className="sidebar-rule" /><p className="eyebrow hidden px-4 text-gray-500 min-[901px]:block">Workspace</p><nav aria-label="Main navigation">{links.map(({ href, label, icon: Icon }) => <Link className="nav-link" href={href} key={href} aria-current={path === href || path.startsWith(`${href}/`) ? "page" : undefined}><Icon size={18} aria-hidden="true" /><span>{label}</span></Link>)}</nav><div className="sidebar-bottom mt-auto px-4"><div className="mb-4 flex items-center justify-between border-t border-white/10 pt-6"><span className="text-sm font-semibold text-gray-200">Private Workspace</span><ChevronRight size={14} aria-hidden="true" /></div><p className="mb-1 text-xs text-gray-400">Profiles, results &amp; team access</p><p className="mt-6 text-xs leading-relaxed text-gray-400">An independent project.<br />Not an official university application.</p></div></aside>;
}
