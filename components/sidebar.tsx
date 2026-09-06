"use client";
import Link from "next/link";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { UsersRound, Upload, ShieldCheck, UserRound, ChevronRight, Settings, BarChart3, ListOrdered, ClipboardList } from "lucide-react";
import type { Role } from "@/lib/types";
import { PacificBrand } from "@/components/pacific-brand";
import { workspaceHome } from "@/lib/workspace-home";
export function Sidebar({ roles, athleteId, isPreview = false }: { roles: Role[]; athleteId: string | null; isPreview?: boolean }) {
  const staff = roles.some(r => r === "admin" || r === "coach");
  const links = [
    ...(staff ? [{ href: "/roster", label: "Team Roster", icon: UsersRound }] : []),
    ...(athleteId ? [{ href: `/athletes/${athleteId}`, label: "My Profile", icon: UserRound }] : []),
    { href: "/game-stats", label: "Game Stats", icon: BarChart3 },
    { href: "/leaderboards", label: "Leaderboards", icon: ListOrdered },
    ...(staff && (!isPreview || roles.includes("coach")) ? [{ href: "/testing", label: "Testing", icon: ClipboardList }, { href: "/imports", label: "Information Imports", icon: Upload }] : []),
    ...(roles.includes("admin") && !isPreview ? [{ href: "/admin/rollout", label: "Team Rollout", icon: UsersRound }, { href: "/admin/access", label: "Account Access", icon: ShieldCheck }] : []),
    { href: "/settings", label: "Settings", icon: Settings }];
  return <aside className="sidebar baseball-sidebar"><Link href={workspaceHome({ roles, athleteId })} className="sidebar-brand-link" aria-label="Pacific Baseball Performance home"><PacificBrand compact /></Link><div className="sidebar-rule" /><p className="eyebrow hidden px-4 text-gray-500 min-[901px]:block">Workspace</p><WorkspaceNavigation links={links} /><div className="sidebar-bottom mt-auto px-4"><div className="mb-4 flex items-center justify-between border-t border-white/10 pt-6"><span className="text-sm font-semibold text-gray-200">Private Workspace</span><ChevronRight size={14} aria-hidden="true" /></div><p className="mb-1 text-xs text-gray-400">Profiles, results &amp; team access</p><p className="mt-6 text-xs leading-relaxed text-gray-400">An independent project.<br />Not an official university application.</p></div></aside>;
}
